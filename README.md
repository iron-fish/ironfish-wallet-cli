# ironfish-wallet

Standalone wallet CLI

## Link to a local instance of the ironfish SDK 

There will be times where you will need to make changes simulatenously to both the ironfish sdk and the wallet. In that case, you can link the wallet to the local instance of the ironfish sdk using the following steps: 

In the Ironfish repo: 
```bash
yarn build 
cd ironfish
yarn link
```

After that, in the wallet repo: 
```bash
yarn link "@ironfish/sdk"
```
