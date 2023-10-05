/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { IronfishNode, NodeUtils, PromiseUtils } from '@ironfish/sdk'
import { Flags } from '@oclif/core'
import inspector from 'node:inspector'
import { IronfishCommand, SIGNALS } from '../command'
import {
  ConfigFlag,
  ConfigFlagKey,
  DataDirFlag,
  DataDirFlagKey,
  RpcHttpHostFlag,
  RpcHttpHostFlagKey,
  RpcHttpPortFlag,
  RpcHttpPortFlagKey,
  RpcTcpHostFlag,
  RpcTcpHostFlagKey,
  RpcTcpPortFlag,
  RpcTcpPortFlagKey,
  RpcTcpTlsFlag,
  RpcTcpTlsFlagKey,
  RpcUseHttpFlag,
  RpcUseHttpFlagKey,
  RpcUseIpcFlag,
  RpcUseIpcFlagKey,
  RpcUseTcpFlag,
  RpcUseTcpFlagKey,
  VerboseFlag,
  VerboseFlagKey,
  WalletRemoteFlags,
} from '../flags'
import { ONE_FISH_IMAGE } from '../images'

const DEFAULT_ACCOUNT_NAME = 'default'

export default class WalletStart extends IronfishCommand {
  static description = 'Start the wallet node'

  static flags = {
    ...WalletRemoteFlags,
    [VerboseFlagKey]: VerboseFlag,
    [ConfigFlagKey]: ConfigFlag,
    [DataDirFlagKey]: DataDirFlag,
    [RpcUseIpcFlagKey]: { ...RpcUseIpcFlag, allowNo: true },
    [RpcUseTcpFlagKey]: { ...RpcUseTcpFlag, allowNo: true },
    [RpcUseHttpFlagKey]: { ...RpcUseHttpFlag, allowNo: true },
    [RpcTcpTlsFlagKey]: RpcTcpTlsFlag,
    [RpcTcpHostFlagKey]: RpcTcpHostFlag,
    [RpcTcpPortFlagKey]: RpcTcpPortFlag,
    [RpcHttpHostFlagKey]: RpcHttpHostFlag,
    [RpcHttpPortFlagKey]: RpcHttpPortFlag,
    workers: Flags.integer({
      description:
        'Number of CPU workers to use for long-running operations. 0 disables (likely to cause performance issues), -1 auto-detects based on CPU cores',
    }),
    name: Flags.string({
      char: 'n',
      description: 'Name for the node',
      hidden: true,
    }),
    upgrade: Flags.boolean({
      allowNo: true,
      description: 'Run migrations when an upgrade is required',
    }),
    networkId: Flags.integer({
      char: 'i',
      default: undefined,
      description: 'Network ID of an official Iron Fish network to connect to',
    }),
    customNetwork: Flags.string({
      char: 'c',
      default: undefined,
      description:
        'Path to a JSON file containing the network definition of a custom network to connect to',
    }),
  }

  node: IronfishNode | null = null

  startDonePromise: Promise<void> | null = null

  async start(): Promise<void> {
    const [startDonePromise, startDoneResolve] = PromiseUtils.split<void>()
    this.startDonePromise = startDonePromise

    const { flags } = await this.parse(WalletStart)
    const { name, workers, upgrade, networkId, customNetwork } = flags

    if (
      workers !== undefined &&
      workers !== this.sdk.config.get('nodeWorkers')
    ) {
      this.sdk.config.setOverride('nodeWorkers', workers)
    }

    if (name !== undefined && name.trim() !== this.sdk.config.get('nodeName')) {
      this.sdk.config.setOverride('nodeName', name.trim())
    }

    if (
      upgrade !== undefined &&
      upgrade !== this.sdk.config.get('databaseMigrate')
    ) {
      this.sdk.config.setOverride('databaseMigrate', upgrade)
    }

    if (networkId !== undefined && customNetwork !== undefined) {
      throw new Error(
        'Cannot specify both the networkId and customNetwork flags at the same time',
      )
    }

    if (
      networkId !== undefined &&
      networkId !== this.sdk.config.get('networkId')
    ) {
      this.sdk.config.setOverride('networkId', networkId)
    }

    if (
      customNetwork !== undefined &&
      customNetwork !== this.sdk.config.get('customNetwork')
    ) {
      this.sdk.config.setOverride('customNetwork', customNetwork)
    }

    let validNodeClientConfig = false

    if (this.sdk.config.get('walletNodeTcpEnabled')) {
      if (this.sdk.config.get('walletNodeTlsEnabled')) {
        validNodeClientConfig =
          !!this.sdk.config.get('walletNodeTcpHost') &&
          !!this.sdk.config.get('walletNodeTcpPort') &&
          !!this.sdk.config.get('walletNodeRpcAuthToken')
      } else {
        validNodeClientConfig =
          !!this.sdk.config.get('walletNodeTcpHost') &&
          !!this.sdk.config.get('walletNodeTcpPort')
      }
    } else if (this.sdk.config.get('walletNodeIpcEnabled')) {
      validNodeClientConfig = !!this.sdk.config.get('walletNodeIpcPath')
    }

    if (!validNodeClientConfig) {
      this
        .log(`Cannot start the wallet: no node connection configuration specified.

Use 'ironfishw config:set' to connect to a node via TCP, TLS, or IPC.

Examples:

1) To connect to a node using IPC:

  # Enable node IPC connection
  $ ironfishw config:set walletNodeIpcEnabled true

  # Set node IPC path
  $ ironfishw config:set walletNodeIpcPath ~/.ironfish/ironfish.ipc

  ----------

  # Alternatively, start the wallet using CLI flags
  $ ironfishw start --node.ipc --node.ipc.path ~/.ironfish/ironfish.ipc

2) To connect to a node using TCP:

  # Enable node TCP connection
  $ ironfishw config:set walletNodeTcpEnabled true
  $ ironfishw config:set walletNodeTlsEnabled false

  # Set node TCP Host
  $ ironfishw config:set walletNodeTcpHost 0.tcp.domain.io

  # Set node TCP Port
  $ ironfishw config:set walletNodeTcpPort 8020

  ----------

  # Alternatively, start the wallet using CLI flags
  $ ironfishw start --node.tcp --node.tcp.host=0.tcp.domain.io --node.tcp.port=8020 --no-node.tcp.tls

3) To connect to a node using TLS:

  # Enable node TLS connection
  $ ironfishw config:set walletNodeTcpEnabled true
  $ ironfishw config:set walletNodeTlsEnabled true

  # Set node TCP Host
  $ ironfishw config:set walletNodeTcpHost 0.tcp.domain.io

  # Set node TCP Port
  $ ironfishw config:set walletNodeTcpPort 8020

  # Set node authentication token
  $ ironfishw config:set walletNodeRpcAuthToken supersecretvalue

  ----------

  # Alternatively, start the wallet using CLI flags
  $ ironfishw start --node.tcp --node.tcp.tls --node.tcp.host=0.tcp.domain.io --node.tcp.port=8020 --node.auth=supersecretvalue`)
      this.exit(1)
    }

    const node = await this.sdk.walletNode()
    const nodeName = this.sdk.config.get('nodeName').trim() || null

    this.log(`\n${ONE_FISH_IMAGE}`)
    this.log(`Version             ${node.pkg.version} @ ${node.pkg.git}`)
    this.log(`Wallet Node Name    ${nodeName || 'NONE'}`)
    if (inspector.url()) {
      this.log(`Inspector           ${String(inspector.url())}`)
    }
    this.log(` `)

    await NodeUtils.waitForOpen(node, () => this.closing)

    if (this.closing) {
      return startDoneResolve()
    }

    await node.start()

    if (node.internal.get('isFirstRun')) {
      await this.firstRun(node)
    }

    this.node = node

    startDoneResolve()
    this.listenForSignals()
    await node.waitForShutdown()
  }

  async closeFromSignal(signal: SIGNALS): Promise<void> {
    this.log(`Shutting down node after ${signal}`)
    await this.startDonePromise
    await this.node?.shutdown()
    await this.node?.closeDB()
  }

  private async firstRun(node: IronfishNode): Promise<void> {
    this.log('')
    this.log('Thank you for installing the Iron Fish Wallet Node.')

    if (!node.wallet.getDefaultAccount()) {
      await this.setDefaultAccount(node)
    }

    this.log('')
    node.internal.set('isFirstRun', false)
    await node.internal.save()
  }

  private async setDefaultAccount(node: IronfishNode): Promise<void> {
    if (!node.wallet.accountExists(DEFAULT_ACCOUNT_NAME)) {
      const account = await node.wallet.createAccount(DEFAULT_ACCOUNT_NAME, {
        setDefault: true,
      })

      this.log(`New default account created: ${account.name}`)
      this.log(`Account's public address: ${account.publicAddress}`)
    } else {
      this.log(`The default account is now: ${DEFAULT_ACCOUNT_NAME}`)
      await node.wallet.setDefaultAccount(DEFAULT_ACCOUNT_NAME)
    }

    this.log('')
  }
}
