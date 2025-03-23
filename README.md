# akt03 - algokit trial, 20-Mar-2025

## Poject setup

After starting Codespace:
```
# set used node version
nvm use 22
# check node version
node -v
```

Check `algokit` installation, install if necessary
```
algokit --version
pipx install algokit
```

Start algorand localnet
```
algokit localnet reset
algokit localnet stop
algokit localnet start
```

Generate full stack Algorand project
```
algokit init
? Which of these options best describes the project you want to build? Smart Contracts & DApp Frontend 🎛️
? Which language would you like to use for the smart contract? TypeScript 📘
? Name of project / directory to create the project in: biz_kor
```

Go to contracts, load dependencies
```
cd projects/biz_kor-contracts
npm install
# or: algokit project bootstrap
```

Compile contract & make typed client
```
# compile contracts *.algo.ts in smart_contracts/biz_kor/
npm run build
```

Test contract
```
# run TS-Jest tests *.e2e.spec.ts in smart_contracts/biz_kor/
npm run test
```

Lint contracts
```
npm run lint
```

## Project use after git clone
```
nvm use 22
algokit localnet start
cd projects/biz_kor-contracts
npm install
# compile contracts *.algo.ts in smart_contracts/biz_kor/
npm run build
# run TS-Jest tests *.e2e.spec.ts in smart_contracts/biz_kor/
npm run test
```
