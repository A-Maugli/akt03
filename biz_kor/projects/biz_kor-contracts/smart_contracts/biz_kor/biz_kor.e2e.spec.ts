import { describe, test, expect, beforeAll, beforeEach } from 'vitest';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import * as algokit from '@algorandfoundation/algokit-utils';
import { registerDebugEventHandlers } from '@algorandfoundation/algokit-utils-debug';
import * as algosdk from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BizKorEClient, BizKorEFactory } from '../artifacts/biz_kor/BizKorEClient';

describe('BizKor', () => {
  const log = true; // skip console.log() calls
  const paramAppVersion = 'v1.4'; // app version
  const paramAssetPrice = BigInt(algosdk.algosToMicroalgos(1));
  const paramAssetAmountInitial = 10n; // pieces
  const paramSellPeriodLength = 1000; // sec
  const paramAssetValidityPeriod = 100n; // sec

  const localnet = algorandFixture();

  let acc1: algosdk.Address & TransactionSignerAccount & {account: algosdk.Account}; // token buyer
  let acc2: algosdk.Address & TransactionSignerAccount & algosdk.Account;  // app creator
  let client: BizKorEClient;

  const deploy = async () => {
    const res1 = localnet.algorand.account.random();
    acc1 = res1;
    await localnet.algorand.account.ensureFundedFromEnvironment(acc1, algokit.algos(10.25));
    if (log) console.log('acc1 address (token buyer):', acc1.addr.toString());

    acc2 = localnet.context.testAccount;
    await localnet.algorand.account.ensureFundedFromEnvironment(acc2, algokit.algos(10.25));
    if (log) console.log('acc2 address (app creator):', acc2.addr.toString());

    const factory = localnet.algorand.client.getTypedAppFactory(
      BizKorEFactory, 
      { defaultSender: acc2, }
    );
    const { appClient } = await factory.deploy({
      onUpdate: 'append',
      onSchemaBreak: 'append',
    });
    client = appClient;
    await client.appClient.fundAppAccount({amount: algokit.microAlgos(600_000)});
  }

  beforeAll(() => {
    algokit.Config.configure({
      populateAppCallResources: true,
      debug: false,
     traceAll: false,
    });
    registerDebugEventHandlers();
  });

  beforeEach(localnet.newScope);

  test('bootstrap', async () => {
    await deploy();
    await client.send.bootstrap({
      args: {
        assetPrice: paramAssetPrice,
        assetAmount: paramAssetAmountInitial,
        sellPeriodLength: paramSellPeriodLength,
        assetValidityPeriod: paramAssetValidityPeriod,
      },
      extraFee: algokit.transactionFees(1),
    })
    const globalState = await client.appClient.getGlobalState();
    expect(globalState.asa_total?.value).toBe(paramAssetAmountInitial);
    expect(globalState.asa_amt?.value).toBe(paramAssetAmountInitial);
    expect(globalState.asa_price?.value).toBe(paramAssetPrice);
  });

  test('getAppVersion', async () => {
    // const version = await client.send.getAppVersion();
    // expect(version.returns).toBe(paramAppVersion);
    // can do without blockchain txn
    const version = await client.newGroup().getAppVersion().simulate();
    expect(version.returns[0]).toBe(paramAppVersion);
  });

  test('getAppCreatorAddress', async () => {
    const appCreatorAddress = await client.send.getAppCreatorAddress();
    expect(Array.from(appCreatorAddress.return!))
    .toStrictEqual(Array.from(acc2.addr.publicKey));  
    // expected Uint8Array, received Array
  });

  test('getAssetAmountInitial', async () => {
    const assetAmountInitial = await client.send.getAssetAmountInitial();
    expect(assetAmountInitial.return).toBe(BigInt(paramAssetAmountInitial));
  });

  test('getAssetAmount', async () => {
    const assetAmountInitial = await client.send.getAssetAmount();
    expect(assetAmountInitial.return).toBe(BigInt(paramAssetAmountInitial));
  });

  test('getAssetPrice', async () => {
    const assetPrice = await client.send.getAssetPrice({args: {}});
    expect(assetPrice.return).toBe(BigInt(paramAssetPrice));
  });

  test('getAssetId', async () => {
    const assetId = await client.send.getAssetId();
    if (log) console.log('assetId: ', assetId.return);
    expect(assetId.return).toBeGreaterThan(BigInt(1_000));
  });

  test('getSellPeriodEnd', async () => {
    const sellPeriodEnd = await client.send.getSellPeriodEnd({args: {}});
    // get date/time
    const now = new Date();
    // get msec since 1970
    const millisecondsSinceEpoch = now.getTime();
    // get sec from msec
    const secondsSinceEpoch = Math.floor(millisecondsSinceEpoch / 1000);
    // check sellPeriodEnd
    if (log) console.log('sellPeriodEnd: ', sellPeriodEnd.return);
    expect(sellPeriodEnd.return)
    .toBeGreaterThan(BigInt(secondsSinceEpoch)); 
    // "algokit localnet reset" may be required to succeed
    expect(sellPeriodEnd.return)
    .toBeLessThan(BigInt(secondsSinceEpoch + paramSellPeriodLength));
  });

  test('getGlobalState', async () => {
    function stringToUint8Array(str: string): Uint8Array {
      return Uint8Array.from(str.split('').map(letter => letter.charCodeAt(0)));
    }

    const globalState = await client.appClient.getGlobalState();
    const apv = globalState.apv!.value;
    const apca = globalState.apca!.value as string;
    //const apcaExt = new algosdk.Address(apca); 
    const asaTotal = globalState.asa_total?.value;
    const asaAmt = globalState.asa_amt?.value;
    const asaPrice = globalState.asa_price?.value;
    const asa = globalState.asa.value;
    const end = globalState.end?.value;
    const asaV = globalState.asa_v?.value;

    expect(apv).toBe(paramAppVersion);
    ////expect(apcaExt).toBe(acc2.addr.toString());
    expect(asaTotal).toBe(paramAssetAmountInitial);
    expect(asaAmt).toBe(paramAssetAmountInitial);
    expect(asaPrice).toBe(paramAssetPrice);
    expect(asaV).toBe(paramAssetValidityPeriod);

    if (log) console.log('globalState:', globalState);
    if (log) console.log('globalState.apv (appVersion):', apv);
    if (log) console.log('globalState.apca (appCreatorAddress):', apca);
    if (log) console.log('apca.length:', apca.length);
    //if (log) console.log('apcaExt = apca.toString():', apcaExt);
    if (log) console.log('getGlobalState.asa_total (assetAmountInitial):', asaTotal);
    if (log) console.log('getGlobalState.asa_amt (assetAmount):', asaAmt);
    if (log) console.log('getGlobalState.asa_price (assetPrice):', asaPrice);
    console.log('getGlobalState.asa (asset):', asa);
    if (log) console.log('getGlobalState.end (sellPeriodEnd):', end);
    if (log) console.log('getGlobalState.asa_v (assetValidityPeriod):', asaV);
  });

  test('opt in to asset', async () => {
    const { algod } = localnet.context;
    const params = await algod.getTransactionParams().do();
    const result = await client.send.getAssetId();
    const asset = result.return as bigint;
    if (log) console.log(
      `Try to opt in to asset: ${asset} by address ${acc1.addr.toString()}`);
    const txn1 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: acc1.addr,
      receiver: acc1.addr,
      amount: 0,
      assetIndex: asset,
      suggestedParams: params,
    });
    const stxn1 = await acc1.signer([txn1], [0]);
    const txn2 = await algod.sendRawTransaction(stxn1).do();
    await algosdk.waitForConfirmation(algod, txn2.txid, 4);
  });

  test('buyAsset', async () => {
    const { algod, testAccount } = localnet.context
    //await deploy(algorand);
    const params = await algod.getTransactionParams().do();
    // Make a payment tx, to buy asset
    const appAddress = client.appClient.appAddress;
    if (log) console.log('testAccount address ', testAccount.addr.toString());
    if (log) console.log('appAddress ', appAddress.toString());
    if (log) console.log('appCreatorAddr ', acc2.addr.toString());
    const tx1 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: acc1.addr,
      receiver: appAddress,
      amount: paramAssetPrice,
      suggestedParams: params,
    });

    // Buy asset
    const {return: assetId} = await client.send.getAssetId();
    await client
      .newGroup()
      .buyAsset({
        args: { payment: tx1 },
        sender: acc1.addr,
        signer: acc1.signer,
        extraFee: algokit.transactionFees(4),
        assetReferences: [assetId!],
      })
      .send();
    // @todo: check that acc1 has got the asset
  });

  test('buyAsset 2nd time', async () => {
    const { algod, testAccount } = localnet.context
    const params = await algod.getTransactionParams().do()

    // Make a payment tx, to buy asset
    const appAddress = client.appClient.appAddress
    if (log) console.log('testAccount address ', testAccount.addr.toString());
    if (log) console.log('appAddress ', appAddress.toString());
    if (log) console.log('appCreatorAddr ', acc2.addr.toString());
    const tx1 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: acc1.addr,
      receiver: appAddress,
      amount: paramAssetPrice,
      suggestedParams: params,
    })

    // Buy asset, 2nd time => throw 
    try {
      const {return: assetId} = await client.send.getAssetId();
      await client.newGroup()
        .buyAsset({
          args: { payment: tx1 },
          sender: acc1.addr,
          signer: acc1.signer,
          extraFee: algokit.transactionFees(4),
          assetReferences: [assetId!],
        })
        .send()
    } catch (err) {
      console.log('*** this test should fail, as the buyer already has a coin ***') 
      // err.response.body.data.pc);
    }
  })

  test('sendAlgosToCreator', async () => {
    await client.send.sendAlgosToCreator({ 
      args: {}, 
      extraFee: algokit.transactionFees(1) 
    });
  });

  test('clawback', async () => {
    const {return: assetId} = await client.send.getAssetId();
    await client.send.clawback({ 
      args: {addr: acc1.addr.toString()}, 
      extraFee: algokit.transactionFees(1),
      assetReferences: [assetId!],
    });
  });

  test('buyAsset after clawback', async () => {
    const { algod, testAccount } = localnet.context;
    const params = await algod.getTransactionParams().do();
    // Make a payment tx, to buy asset
    const appAddress = client.appClient.appAddress;
    if (log) console.log('testAccount address ', testAccount.addr.toString());
    if (log) console.log('appAddress ', appAddress.toString());
    if (log) console.log('appCreatorAddr ', acc2.addr.toString());
    const tx1 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: acc1.addr,
      receiver: appAddress,
      amount: paramAssetPrice,
      suggestedParams: params,
    });

    // Buy asset
    const {return: assetId} = await client.send.getAssetId();
    await client.newGroup()
    .buyAsset({
      args: { payment: tx1 },
      sender: acc1.addr,
      signer: acc1.signer,
      extraFee: algokit.transactionFees(4),
      assetReferences: [assetId!]
    })
    .send();
    // @todo: check that acc1 has got the token
  });

  test('clawback again', async () => {
    const {return: assetId} = await client.send.getAssetId();
    await client.send.clawback( { 
      args: {addr: acc1.addr.toString() }, 
      extraFee: algokit.transactionFees(1),
      assetReferences: [assetId!],
    });
  });

  test('opt out buyer from asset', async () => {
    const { algod } = localnet.context
    const params = await algod.getTransactionParams().do();
    const {return: assetId} = await client.send.getAssetId();
    const appAddress = client.appClient.appAddress;
    if (log) console.log(
      `Try to opt out from asset ${assetId}, address ${acc1.addr.toString()}`);
    const txn1 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: acc1.addr,
      receiver: appAddress,
      closeRemainderTo: appAddress,
      amount: 0,
      assetIndex: assetId!,
      suggestedParams: params,
    });
    const stxn1 = await acc1.signer([txn1], [0]);
    const txn2 = await algod.sendRawTransaction(stxn1).do();
    await algosdk.waitForConfirmation(algod, txn2.txid, 4);
  });

  test('deleteAsset', async () => {
    const {return: assetId} = await client.send.getAssetId();
    await client.send.deleteAsset({
      args: {}, 
      extraFee: algokit.transactionFees(1),
      assetReferences: [assetId!],  
    });
  });

  test('deleteApplication', async () => {
    await client.send.deleteApplication({ 
      args: {}, 
      extraFee: algokit.transactionFees(1) 
    });
  });
});
