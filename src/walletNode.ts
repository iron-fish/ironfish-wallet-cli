/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import {
  ApiNamespace,
  Assert,
  AssetsVerifier,
  ConfigOptions,
  createRootLogger,
  DatabaseIsLockedError,
  DEFAULT_DATA_DIR,
  FileSystem,
  getNetworkDefinition,
  InternalStore,
  IronfishSdk,
  Logger,
  MetricsMonitor,
  Migrator,
  Network,
  Package,
  PromiseUtils,
  RpcHttpAdapter,
  RpcIpcAdapter,
  RpcServer,
  RpcSocketClient,
  RpcTcpAdapter,
  RpcTcpClient,
  RpcTlsAdapter,
  RpcTlsClient,
  SetTimeoutToken,
  VerifiedAssetsCacheStore,
  Wallet,
  WalletDB,
} from '@ironfish/sdk'
import { BlockHasher } from '@ironfish/sdk/build/src/blockHasher'
import { RpcIpcClient } from '@ironfish/sdk/build/src/rpc/clients/ipcClient'
import {
  calculateWorkers,
  WorkerPool,
} from '@ironfish/sdk/build/src/workerPool'
import { headerDefinitionToHeader } from './utils/block'
import { WalletConfig } from './walletConfig'

export enum Database {
  WALLET = 'wallet',
  BLOCKCHAIN = 'blockchain',
}

export class WalletNode {
  network: Network
  config: WalletConfig
  internal: InternalStore
  wallet: Wallet
  logger: Logger
  metrics: MetricsMonitor
  migrator: Migrator
  workerPool: WorkerPool
  files: FileSystem
  rpc: RpcServer
  pkg: Package
  assetsVerifier: AssetsVerifier
  nodeClient: RpcSocketClient | null

  started = false
  shutdownPromise: Promise<void> | null = null
  shutdownResolve: (() => void) | null = null

  private nodeClientConnectionWarned: boolean
  private nodeClientConnectionTimeout: SetTimeoutToken | null

  constructor({
    pkg,
    files,
    config,
    internal,
    wallet,
    network,
    metrics,
    workerPool,
    logger,
    assetsVerifier,
    nodeClient,
  }: {
    pkg: Package
    files: FileSystem
    config: WalletConfig
    internal: InternalStore
    wallet: Wallet
    network: Network
    metrics: MetricsMonitor
    workerPool: WorkerPool
    logger: Logger
    assetsVerifier: AssetsVerifier
    nodeClient: RpcSocketClient | null
  }) {
    this.files = files
    this.config = config
    this.internal = internal
    this.wallet = wallet
    this.network = network
    this.metrics = metrics
    this.workerPool = workerPool
    this.rpc = new RpcServer(this, internal)
    this.logger = logger
    this.pkg = pkg
    this.nodeClient = nodeClient
    this.assetsVerifier = assetsVerifier

    this.migrator = new Migrator({
      context: { config, wallet, files },
      logger,
      databases: [Database.WALLET],
    })

    this.nodeClientConnectionWarned = false
    this.nodeClientConnectionTimeout = null

    this.config.onConfigChange.on((key, value) =>
      this.onConfigChange(key, value),
    )
  }

  static async init({
    pkg: pkg,
    dataDir,
    config,
    internal,
    logger = createRootLogger(),
    metrics,
    files,
    nodeClient,
    customNetworkPath,
    networkId,
  }: {
    pkg: Package
    dataDir?: string
    config?: WalletConfig
    internal?: InternalStore
    logger?: Logger
    metrics?: MetricsMonitor
    files: FileSystem
    nodeClient: RpcSocketClient | null
    customNetworkPath?: string
    networkId?: number
  }): Promise<WalletNode> {
    logger = logger.withTag('walletnode')
    dataDir = dataDir || DEFAULT_DATA_DIR

    if (!config) {
      config = new WalletConfig(files, dataDir)
      await config.load()
    }

    if (!internal) {
      internal = new InternalStore(files, dataDir)
      await internal.load()
    }

    const verifiedAssetsCache = new VerifiedAssetsCacheStore(files, dataDir)
    await verifiedAssetsCache.load()

    const assetsVerifier = new AssetsVerifier({
      apiUrl: config.get('assetVerificationApi'),
      cache: verifiedAssetsCache,
      files,
      logger,
    })

    const numWorkers = calculateWorkers(
      config.get('nodeWorkers'),
      config.get('nodeWorkersMax'),
    )

    const workerPool = new WorkerPool({ metrics, numWorkers })

    metrics = metrics || new MetricsMonitor({ logger })

    const networkDefinition = await getNetworkDefinition(
      config,
      internal,
      files,
      customNetworkPath,
      networkId,
    )

    const network = new Network(networkDefinition)

    const walletDB = new WalletDB({
      location: config.walletDatabasePath,
      workerPool,
      files,
    })

    const wallet = new Wallet({
      config,
      database: walletDB,
      workerPool,
      consensus: network.consensus,
      nodeClient,
      chain: null,
      networkId: network.id,
    })

    return new WalletNode({
      pkg,
      network,
      files,
      config,
      internal,
      wallet,
      metrics,
      workerPool,
      logger,
      assetsVerifier,
      nodeClient,
    })
  }

  async openDB(): Promise<void> {
    const migrate = this.config.get('databaseMigrate')
    const initial = await this.migrator.isInitial()

    if (migrate || initial) {
      await this.migrator.migrate({
        quiet: !migrate,
        quietNoop: true,
      })
    }

    try {
      await this.wallet.open()
    } catch (e) {
      await this.wallet.close()
      throw e
    }
  }

  async closeDB(): Promise<void> {
    await this.wallet.close()
  }

  async start(): Promise<void> {
    this.shutdownPromise = new Promise((r) => (this.shutdownResolve = r))
    this.started = true

    // Work in the worker pool happens concurrently,
    // so we should start it as soon as possible
    this.workerPool.start()

    if (this.config.get('enableMetrics')) {
      this.metrics.start()
    }

    if (this.config.get('enableRpc')) {
      await this.rpc.start()
    }

    if (this.config.get('enableAssetVerification')) {
      this.assetsVerifier.start()
    }

    await this.connectRpc(true)
    await this.verifyGenesisBlockHash()
  }

  async verifyGenesisBlockHash(): Promise<void> {
    Assert.isNotNull(this.nodeClient)

    const response = await this.nodeClient.chain.getChainInfo()

    const nodeGenesisHash = Buffer.from(
      response.content.genesisBlockIdentifier.hash,
      'hex',
    )

    const blockHasher = new BlockHasher({
      consensus: this.network.consensus,
    })

    const rawGenesisHeader = headerDefinitionToHeader(
      this.network.genesis.header,
    )
    const walletGenesisHash = blockHasher.hashHeader(rawGenesisHeader)

    if (walletGenesisHash.equals(nodeGenesisHash)) {
      this.logger.info('Verified genesis block hash')
    } else {
      throw new Error(
        `Cannot sync from this node because the node's genesis block hash ${nodeGenesisHash.toString(
          'hex',
        )} does not match the wallet's genesis block hash ${walletGenesisHash.toString(
          'hex',
        )}`,
      )
    }
  }

  async connectRpc(startWallet?: boolean): Promise<void> {
    Assert.isNotNull(this.nodeClient)
    this.nodeClient.onClose.on(() => this.onDisconnectRpc(startWallet))
    await this.startConnectingRpc(startWallet)
  }

  private async startConnectingRpc(startWallet?: boolean): Promise<void> {
    Assert.isNotNull(this.nodeClient)
    const connected = await this.nodeClient.tryConnect()
    if (!connected) {
      if (!this.nodeClientConnectionWarned) {
        this.logger.warn(
          `Failed to connect to node on ${this.nodeClient.describe()}, retrying...`,
        )
        this.logger.warn('')
        this.nodeClientConnectionWarned = true
      }

      this.nodeClientConnectionTimeout = setTimeout(
        () => void this.startConnectingRpc(startWallet),
        5000,
      )
      return
    }

    this.nodeClientConnectionWarned = false
    this.logger.info('Successfully connected to node')

    if (startWallet) {
      this.wallet.start()
    }
  }

  private onDisconnectRpc = (startWallet?: boolean): void => {
    this.logger.info('')
    this.logger.info('Disconnected from node unexpectedly. Reconnecting.')
    void this.wallet.stop()

    void this.startConnectingRpc(startWallet)
  }

  /**
   * Try to open the node DB's and wait until they can be opened
   */
  async waitForOpen(abort?: null | (() => boolean)): Promise<void> {
    let logged = false

    while (!abort || !abort()) {
      const success = await this.openDB()
        .then(() => true)
        .catch((e) => {
          if (e instanceof DatabaseIsLockedError) {
            return false
          } else {
            throw e
          }
        })

      if (success) {
        return
      }

      if (!success && !logged) {
        logged = true
        this.logger.info(
          'Another node is using the database, waiting for that node to close.',
        )
      }

      await PromiseUtils.sleep(500)
    }
  }

  async waitForShutdown(): Promise<void> {
    await this.shutdownPromise
  }

  async shutdown(): Promise<void> {
    Assert.isNotNull(this.nodeClient)
    this.nodeClient.onClose.off(this.onDisconnectRpc)
    this.nodeClient.close()

    if (this.nodeClientConnectionTimeout) {
      clearTimeout(this.nodeClientConnectionTimeout)
    }

    await Promise.allSettled([
      this.wallet.stop(),
      this.rpc.stop(),
      this.assetsVerifier.stop(),
      this.metrics.stop(),
    ])

    // Do after to avoid unhandled error from aborted jobs
    await Promise.allSettled([this.workerPool.stop()])

    if (this.shutdownResolve) {
      this.shutdownResolve()
    }

    this.started = false
  }

  async onConfigChange<Key extends keyof ConfigOptions>(
    key: Key | string,
    newValue: ConfigOptions[Key] | unknown,
  ): Promise<void> {
    switch (key) {
      case 'enableMetrics': {
        if (newValue) {
          this.metrics.start()
        } else {
          this.metrics.stop()
        }
        break
      }
      case 'enableRpc': {
        if (newValue) {
          await this.rpc.start()
        } else {
          await this.rpc.stop()
        }
        break
      }
      case 'enableAssetVerification': {
        if (newValue) {
          this.assetsVerifier.start()
        } else {
          this.assetsVerifier.stop()
        }
        break
      }
    }
  }
}

export async function walletNode(options: {
  sdk: IronfishSdk
  connectNodeClient: boolean
  walletConfig: WalletConfig
  customNetworkPath?: string
  networkId?: number
}): Promise<WalletNode> {
  let nodeClient: RpcSocketClient | null = null

  if (options.connectNodeClient) {
    if (options.walletConfig.get('walletNodeTcpEnabled')) {
      if (options.walletConfig.get('walletNodeTlsEnabled')) {
        nodeClient = new RpcTlsClient(
          options.walletConfig.get('walletNodeTcpHost'),
          options.walletConfig.get('walletNodeTcpPort'),
          options.sdk.logger,
          options.walletConfig.get('walletNodeRpcAuthToken'),
        )
      } else {
        nodeClient = new RpcTcpClient(
          options.walletConfig.get('walletNodeTcpHost'),
          options.walletConfig.get('walletNodeTcpPort'),
          options.sdk.logger,
        )
      }
    } else if (options.walletConfig.get('walletNodeIpcEnabled')) {
      nodeClient = new RpcIpcClient(
        options.walletConfig.get('walletNodeIpcPath'),
        options.sdk.logger,
      )
    } else {
      throw new Error(`Cannot start the wallet: no node connection configuration specified.

Use 'ironfishw config:set' to connect to a node via TCP, TLS, or IPC.\n`)
    }
  }

  const node = await WalletNode.init({
    pkg: options.sdk.pkg,
    config: options.walletConfig,
    internal: options.sdk.internal,
    files: options.sdk.fileSystem,
    logger: options.sdk.logger,
    metrics: options.sdk.metrics,
    dataDir: options.sdk.dataDir,
    customNetworkPath: options.customNetworkPath,
    networkId: options.networkId,
    nodeClient,
  })

  const namespaces = [
    ApiNamespace.config,
    ApiNamespace.faucet,
    ApiNamespace.rpc,
    ApiNamespace.wallet,
    ApiNamespace.worker,
    ApiNamespace.node,
  ]

  if (options.sdk.config.get('enableRpcIpc')) {
    await node.rpc.mount(
      new RpcIpcAdapter(
        options.sdk.config.get('ipcPath'),
        options.sdk.logger,
        namespaces,
      ),
    )
  }

  if (options.sdk.config.get('enableRpcHttp')) {
    await node.rpc.mount(
      new RpcHttpAdapter(
        options.sdk.config.get('rpcHttpHost'),
        options.sdk.config.get('rpcHttpPort'),
        options.sdk.logger,
        namespaces,
      ),
    )
  }

  if (options.sdk.config.get('enableRpcTcp')) {
    if (options.sdk.config.get('enableRpcTls')) {
      await node.rpc.mount(
        new RpcTlsAdapter(
          options.sdk.config.get('rpcTcpHost'),
          options.sdk.config.get('rpcTcpPort'),
          options.sdk.fileSystem,
          options.sdk.config.get('tlsKeyPath'),
          options.sdk.config.get('tlsCertPath'),
          options.sdk.logger,
          namespaces,
        ),
      )
    } else {
      await node.rpc.mount(
        new RpcTcpAdapter(
          options.sdk.config.get('rpcTcpHost'),
          options.sdk.config.get('rpcTcpPort'),
          options.sdk.logger,
          namespaces,
        ),
      )
    }
  }

  return node
}
