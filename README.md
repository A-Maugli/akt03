# akt03 - algokit trial, 20-Mar-2025

## Project setup

After starting Codespace:
```
# install node 22
nvm install 22
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

Start Algorand local node
```
algokit localnet reset
algokit localnet stop
algokit localnet start
```

Set port visibility
```
# Go to Ports Tab.
# "Add Ports" 4001, 4002, 8980 if they do not exist
# Set port visibility of ports 4001, 4002 and 8980:
# Right click on the port in the Visibility column, select Port Visibility | Public
```

Start Algorand blockchain explorer
```
algokit explore
```

Generate full stack Algorand project
```
algokit init
? Which of these options best describes the project you want to build? Smart Contracts & DApp Frontend 🎛️
? Which language would you like to use for the smart contract? TypeScript 📘
? Name of project / directory to create the project in: biz_kor
```
Note: by default, algorand-typescript compiler was used, not TealScript.

### Contracts

Go to contracts, load dependencies
```
cd projects/biz_kor-contracts
npm install
# or: algokit project bootstrap all
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

### React frontend

Go to frontend, load dependencies
```
cd ../biz_kor-frontend
algokit project bootstrap all
```

Run React frontend in dev mode
```
algokit explore
npm run dev
```


## Project use after git clone

### Init environment
```
nvm use 22
algokit localnet start
# Go to Ports Tab.
# "Add Ports" 4001, 4002, 8980 if they do not exist
# Set port visibility of ports 4001, 4002 and 8980:
# Right click on the port in the Visibility column, select Port Visibility | Public
algokit explore
```

### Contracts
```
cd projects/biz_kor-contracts
npm install
# compile contracts *.algo.ts in smart_contracts/biz_kor/
npm run build
```

### Frontend
```
# run TS-Jest tests *.e2e.spec.ts in smart_contracts/biz_kor/
npm run test
```
