# ironfish-wallet

The Iron Fish Wallet CLI is a standalone process which provides account key management, transaction creation, and asset storage.

## Installation

The Iron Fish Standalone Wallet can be installed via [NPM](https://www.npmjs.com/package/ironfish-wallet):

```bash
$ npm i -g ironfish-wallet
```

Refer to the [Commands](#commands) section for usage details, or run:

```bash
$ ironfishw --help
```

## Setup

In order to start the standalone wallet, you must configure the process to point to a full Iron Fish Node.

### Connecting a Standalone Wallet to a Remote Node

```bash
# Enable TCP connection to the full node
$ ironfishw config:set walletNodeTcpEnabled true

# Set the TCP host of the full node
$ ironfishw config:set walletNodeTcpHost <node-host>

# Set the TCP port of the full node
$ ironfishw config:set walletNodeTcpPort <node-port>

# (Optional) If the full node has TLS enabled, set the RPC authentication token
$ ironfishw config:set walletNodeRpcAuthToken <auth-token>

# After the above commands are run, you can start the wallet
$ ironfishw start
```

Alternatively, you can pass (or override the existing configuration) via CLI flags:

```bash
$ ironfishw start --node.tcp --node.tcp.host=<node-tcp-host> --node.tcp.port=<node-tcp-port>
```

If TLS is set:

```bash
$ ironfishw start --node.tcp --node.tcp.host=<node-tcp-host> --node.tcp.port=<node-tcp-port> --node.tcp.tls --node.auth=taqueriaramirez
```

### Connecting a Standalone Wallet to a Local Node

If you have a local node running and wish to connect via IPC:

```bash
# Enable IPC connection to the full node
$ ironfishw config:set walletNodeIpcEnabled true

# Set the IPC path of the full node
$ ironfishw config:set walletNodeIpcPath <full-node-ipc-path>

# After the above commands are run, you can start the wallet
$ ironfishw start
```

Alternatively, you can pass (or override the existing configuration) via CLI flags:

```bash
$ ironfishw start --node.ipc --node.ipc.path=<full-node-ipc-path>
```

## Commands

The `ironfish-wallet` CLI has several commands to manage an Iron Fish wallet.

Appending `--help` to each command will provide help. For example:

```bash
$ ironfishw accounts --help
```

### Wallet

*  `ironfishw accounts`         - List all the accounts on the node
*  `ironfishw address`          - Display your account address
*  `ironfishw assets`           - Display the wallet's assets
*  `ironfishw balance`          - Display the account balance
*  `ironfishw balances`         - Display the account's balances for all assets
*  `ironfishw browse`           - Browse to your data directory
*  `ironfishw burn`             - Burn tokens and decrease supply for a given asset
*  `ironfishw config`           - Print out the entire config
*  `ironfishw create`           - Create a new account for sending and receiving coins
*  `ironfishw delete`           - Permanently delete an account
*  `ironfishw export`           - Export an account
*  `ironfishw faucet`           - Receive coins from the Iron Fish official testnet Faucet
*  `ironfishw help`             - Display help for ironfishw.
*  `ironfishw import`           - Import an account
*  `ironfishw migrations`       - List all the migration statuses
*  `ironfishw mint`             - Mint tokens and increase supply for a given asset
*  `ironfishw notes`            - Display the account notes
*  `ironfishw post`             - Post a raw transaction
*  `ironfishw prune`            - Removes expired transactions from the wallet
*  `ironfishw rename`           - Change the name of an account
*  `ironfishw repl`             - An interactive terminal to the node
*  `ironfishw rescan`           - Rescan the blockchain for transactions
*  `ironfishw send`             - Send coins to another account
*  `ironfishw start`            - Start the wallet node
*  `ironfishw status`           - Get status of an account
*  `ironfishw stop`             - Stop the wallet node
*  `ironfishw transaction`      - Display an account transaction
*  `ironfishw transactions`     - Display the account transactions
*  `ironfishw use`              - Change the default account used by all commands
*  `ironfishw which`            - Show the account currently used.

### Configuration

* `ironfishw config`            - Print out the entire config
* `ironfishw config:edit`       - Edit the config in your configured editor
* `ironfishw config:get`        - Print out one config value
* `ironfishw config:set`        - Set a value in the config
* `ironfishw config:unset`      - Unset a value in the config and fall back to default

### Migrations

* `ironfishw migrations`        - List all the migration statuses
* `ironfishw migrations:start`  - Run migrations

### Node

* `ironfishw node:status`       - Show the status of the full node

### RPC

* `ironfishw rpc:status`        - Show the status of the RPC layer
* `ironfishw rpc:token`         - Get or set the RPC auth token

### Workers

* `ironfishw workers:status`    - Show the status of the worker pool

## Development

Ensure you are running Node 20.x.

### Local Node Changes

If you need to test changes simulatenously to both the [`ironfish` SDK](https://github.com/iron-fish/ironfish/tree/master/ironfish) and this standalone wallet code base. In that case, you can link the wallet to the local instance of the `ironfish` SDK using the following steps:

In the [`ironfish`](https://github.com/iron-fish/ironfish/) repository:

```bash
# Build all packages
$ yarn build

# Navigate to the SDK directory
$ cd ironfish

# Link the SDK package
$ yarn link
```

After that, in this standalone wallet repository:

```bash
$ yarn link "@ironfish/sdk"
```
