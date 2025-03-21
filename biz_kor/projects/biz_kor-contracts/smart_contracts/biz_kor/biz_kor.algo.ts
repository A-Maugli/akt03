import { arc4, Contract, GlobalState, uint64, assert, assertMatch, Global, itxn, Txn, 
  gtxn, Asset, Account, Uint64, bytes} from '@algorandfoundation/algorand-typescript';

// App for "Bizalmi Kör Tulajdonrész Opciós Vételi Jog"
//  - bootstrap creates the ASA (Algorand Standars Asset), with the specified parameters
//  - buyAsset is called to buy an ASA
//  - clawback is to send back an "expired" coin to the app

// History:
//  v1.0, 07-Apr-2024, LG
//    - in buyAsset, asset_id is also passed as param in the txn foreign array.
//      See tests, "assets: [Number(asset_id)],"
//      Otherwise "unavailable asset" error occurs
//  v1.1, 14-Apr-2024, LG
//    - added appVersion as a global key-value pair
//    - added getters for global values
//    - modified buyAsset, payment is due to the app address (formerly: app creator address)
//    - added sendAlgos, to send Algos back from the app to the app creator address
//    - added clawback, to force moving back assets from a given address to the app address
//    - added deleteAsset, to delete assets from the app
//    - modified deleteApplication
//  v1.2, 22-Apr-2024, LG
//    - mod clawback, to increase assetAmount
//    - mod buyAsset, to unfreeze assetId first (test cycle: buy, clawback, buy)
//    - mod buyAsset, make buyer to opt into asset
//    - mod bootstrap, new param: asaValidityPeriod
//  v1.3, 23-Apr-2024, LG
//    - mod buyAsset, opt in comes first, before unfreeze
//    - optimize buyAsset: do not check rekeyTo, closeRemainderTo
//    - add clawbackNoIncAmount
//  v1.4, 19-Mar-2025, LG
//    - rewrite using algorand-typescript, 1.0.0-beta.25
//    - problem: appCreatorAddress = GlobalState<Account>({ key: 'apca', initialValue: Global.creatorAddress });
//      - Account is used for Address type, I didn't found Address type
//      - const globalState = await client.appClient.getGlobalState();
//          const apca = algosdk.base64ToBytes(globalState.apca?.value);  
//              // ez egy 31 byte-os string. Bug?
//              // apca.valueRaw nem elérhető. Bug? Feature?
//    - problem:   getAppCreatorAddress(): bytes {...}
//      - if Account is used instead of bytes, then
//          "Client generation failed for BizKorE.arc56.json."
//    - strange: asset:Asset and assetId:uint64 are different.
//          assetId=asset.id
//    - strange: getGlobalState.asset az assetId-t tartalmazzas, lásd e2s.spec.ts
//    - problem:     
//        getAssetID111(): Asset {
//          let asset = this.asset.value;
//          return asset;
//        }
//      critical: Compilation exited with status 2
//    - question: instead of this.asset.value, assetReferences array can 
//      also be used, then Txn.assets(0) is an asset. What is the guarantee 
//      that our asset will be populated to the 0th location?


export class BizKorE extends arc4.Contract {
  appVersion = GlobalState<string>(
    { key: 'apv', initialValue: 'v1.4' });
  appCreatorAddress = GlobalState<Account>(
    { key: 'apca', initialValue: Global.creatorAddress });
  assetAmountInitial = GlobalState<uint64>(
    { key: 'asa_total', initialValue: 0 });
  assetAmount = GlobalState<uint64>(
    { key: 'asa_amt', initialValue: 0 });
  assetPrice = GlobalState<uint64>(
    { key: 'asa_price', initialValue: 0 });
  asset = GlobalState<Asset>(
    { key: 'asa', initialValue: Asset()});
  //assetId = GlobalState<uint64>(
  //  { key: 'asa_id', initialValue: 0 });
  sellPeriodEnd = GlobalState<uint64>(
    { key: 'end', initialValue: 0 });
  assetValidityPeriod = GlobalState<uint64>(
    { key: 'asa_v', initialValue: 0 });

  /**
   * Empty createApplication
   */
  public createApplication(): void {
    // this.appCreatorAddress.value = Global.creatorAddress;
  }

  /**
   * create ASA, set global key values
   * @param assetPrice ASA price in microAlgos
   * @param assetAmount ASA inital amount in pieces
   * @param sellPeriodLength sell period length in secs
   * @param assetValidityPeriod asset validity in secs, after that time it can be clawbacked
   */
  public bootstrap(
    assetPrice: uint64, 
    assetAmount: uint64, 
    sellPeriodLength: uint64, 
    assetValidityPeriod: uint64) {

    assertMatch(Txn, { sender: Global.creatorAddress },
      'Allow only the app creator to call this method'
    );

    assert(this.assetAmountInitial.value === 0, 
      'bootstrap has been already called');

    // create an asset
    const assetConfig = itxn.assetConfig({
      total: assetAmount,
      decimals: 0,
      assetName: 'Bizalmi Kör Zseton',
      unitName: 'BKTOVJ1',
      url: 'https://algorand.hu/bk/bktovj.html',
      defaultFrozen: false,
      manager: Global.currentApplicationAddress,
      reserve: Global.currentApplicationAddress,
      freeze: Global.currentApplicationAddress,
      clawback: Global.currentApplicationAddress,
    })
    .submit();
    this.asset.value = assetConfig.createdAsset;

    // set global values
    this.assetAmountInitial.value = assetAmount;
    this.assetAmount.value = assetAmount;
    this.assetPrice.value = assetPrice;
    this.sellPeriodEnd.value = Global.latestTimestamp + sellPeriodLength;
    this.assetValidityPeriod.value = assetValidityPeriod;
  }

  /**
   * get app creator address
   * @returns app creator address
   */
  public getAppCreatorAddress(): bytes {
    return this.appCreatorAddress.value.bytes;
  }

  /**
   * get app version
   * @returns app version
   */
  public getAppVersion(): string {
    return this.appVersion.value;
  }

  /**
   * get asa initial amount
   * @returns asa amount minted initially
   */
  public getAssetAmountInitial(): uint64 {
    return this.assetAmountInitial.value;
  }

  /**
   * get asa amount
   * @returns sellable asa amount
   */
  public getAssetAmount(): uint64 {
    return this.assetAmountInitial.value;
  }

  /**
   * get asa price
   * @returns asa price in microAlgos
   */
  public getAssetPrice(): uint64 {
    return this.assetPrice.value;
  }

  /**
   * get asa id
   * @returns asa id
   */
  public getAssetId(): uint64 {
    const asset = this.asset.value;
    return asset.id;
  }

  /**
   * get end of sell period
   * @returns end of sell period as absolute time in sec, from 01-Jan-1970
   */
  public getSellPeriodEnd(): uint64 {
    return this.sellPeriodEnd.value;
  }

  /**
   * Buy 1 piece of the asset
   * @param payment txn, where amount is equal to assetPrice, receiver is app address
   */
  public buyAsset(payment: gtxn.PaymentTxn): void {
    /// Ensure asset selling period hasn't ended yet
    assert(Global.latestTimestamp <= this.sellPeriodEnd.value, 
      'Sell period ended');

    /// Ensure that buyer hasn't bought earlier this asset
    const asset = this.asset.value;
      // instead of this.asset.value, assetReferences array can also be used, then Txn.assets(0) is an asset.
      // Question: what is the guarantee that our asset can be accessed in the 0th location?
    const assetBalance = asset.balance(payment.sender);
    ////assert(assetBalance === assetBalance1, 'internal error');
    assert(assetBalance === 0, 'Asset already bought');

    /// Verify payment transaction: receiver is the app, amount is the asset price
    assertMatch(payment, 
      {
        sender: Txn.sender,
        receiver: Global.currentApplicationAddress,
        amount: { greaterThanEq: this.assetPrice.value, lessThanEq: this.assetPrice.value },
      },
      'Amount sent should be equal to asset price');

    /// Is there still an asset to sell? (this can be optimized away)
    assert(this.assetAmount.value > 0, 'No more ASA to sell');

    /// Opt into asset, unconditionally
    itxn.assetTransfer({
      xferAsset: asset.id,
      assetAmount: 0,
      assetReceiver: Global.currentApplicationAddress,
    })
    .submit();

    /// Unfreeze asset
    itxn.assetFreeze({
      freezeAsset: asset.id,
      freezeAccount: Txn.sender,
      frozen: false,
    })
    .submit();

    /// Send asset to the buyer
    itxn.assetTransfer({
      xferAsset: asset.id,
      assetReceiver: Txn.sender,
      assetAmount: 1,
    })
    .submit();

    /// Freeze the asset at the buyer's address (this can be optimized away)
    itxn.assetFreeze({
      freezeAsset: asset.id,
      freezeAccount: Txn.sender,
      frozen: true,
    })
    .submit();

    // Decrease asset amount (this can be optimized away)
    this.assetAmount.value = this.assetAmount.value - 1;
  }

  /**
   * Send Algos from the app address to the app creator address
   */
  public sendAlgosToCreator(): void {
    assertMatch(Txn, { sender: Global.creatorAddress }, 
      'Allow only the app creator to call this method');

    /// Send back all the Algos above minAmount to the app creator
    const minAmount = Uint64(600_000); // uAlgos
    const balance = Global.currentApplicationAddress.balance;
    if (balance > minAmount) {
      itxn.payment({
        receiver: Global.creatorAddress,
        amount: balance - minAmount,
      })
      .submit();
    }
  }

  /**
   * Clawback asset to app & inc amount
   * @param addr address from which to clawback asset
   */
  public clawback(addr: Account): void {
    assertMatch(Txn, { sender: Global.creatorAddress }, 
      'Allow only the app creator to call this method');

    /// Clawback assets to app
    const asset = this.asset.value;
    itxn.assetTransfer({
      xferAsset: asset.id,
      assetAmount: 1,
      assetSender: addr,
      assetReceiver: Global.currentApplicationAddress,
    })
    .submit();

    /// Inc asset amount
    this.assetAmount.value = this.assetAmount.value + 1;
  }

  /**
   * Clawback asset to app without incrementing amount
   * This method is called when the property has been bought
   * @param addr address from which to clawback asset
   */
  public clawbackNoIncAmount(addr: Account): void {
    assertMatch(Txn, { sender: Global.creatorAddress }, 
      'Allow only the app creator to call this method');

    /// Clawback assets to app
    const asset = this.asset.value;
    itxn.assetTransfer({
      xferAsset: asset.id,
      assetAmount: 1,
      assetSender: addr,
      assetReceiver: Global.currentApplicationAddress,
    })
    .submit();
  }

  /**
   * Delete asset within app
   */
  public deleteAsset(): void {
    assertMatch(Txn, { sender: Global.creatorAddress },
      'Allow only the app creator to call this method');
    /* OR alternatively
    assert(Txn.sender === Global.creatorAddress, 
      'Allow only the app creator to call this method');
    */

    /// Delete asset
    const asset=this.asset.value;
    itxn.assetConfig({
      configAsset: asset.id,
    })
    .submit();
  }

  /**
   * Delete app with ABI method
   */
  public deleteApplication(): void {
    assertMatch(Txn, { sender: Global.creatorAddress }, 
      'Allow only the app creator to call this method'
    );

    /// Send back Algos to app creator account
    itxn.payment({
      receiver: Global.creatorAddress,
      amount: 0,
      closeRemainderTo: Global.creatorAddress,
    })
    .submit();
  }
}
