/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import {
  Config as IronfishConfig,
  ConfigOptions,
  createRootLogger,
  DatabaseVersionError,
  ErrorUtils,
  InternalOptions,
  IronfishSdk,
  Logger,
  RpcConnectionError,
} from '@ironfish/sdk'
import { Command, Config } from '@oclif/core'
import { CLIError, ExitError } from '@oclif/core/lib/errors'
import {
  ConfigFlagKey,
  DataDirFlagKey,
  RpcAuthFlagKey,
  RpcHttpHostFlagKey,
  RpcHttpPortFlagKey,
  RpcTcpHostFlagKey,
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
  WalletNodeAuthFlagKey,
  WalletNodeIpcPathFlagKey,
  WalletNodeTcpHostFlagKey,
  WalletNodeTcpPortFlagKey,
  WalletNodeTcpTlsFlagKey,
  WalletNodeUseIpcFlagKey,
  WalletNodeUseTcpFlagKey,
} from './flags'
import { IronfishCliPKG } from './package'
import { hasUserResponseError } from './utils'
import { WalletConfig, WalletConfigOptions } from './walletConfig'

export type SIGNALS = 'SIGTERM' | 'SIGINT' | 'SIGUSR2'

export type FLAGS =
  | typeof DataDirFlagKey
  | typeof ConfigFlagKey
  | typeof RpcUseIpcFlagKey
  | typeof RpcUseTcpFlagKey
  | typeof RpcTcpHostFlagKey
  | typeof RpcTcpPortFlagKey
  | typeof RpcUseHttpFlagKey
  | typeof RpcHttpHostFlagKey
  | typeof RpcHttpPortFlagKey
  | typeof RpcTcpTlsFlagKey
  | typeof VerboseFlagKey
  | typeof RpcAuthFlagKey
  | typeof WalletNodeUseIpcFlagKey
  | typeof WalletNodeIpcPathFlagKey
  | typeof WalletNodeUseTcpFlagKey
  | typeof WalletNodeTcpHostFlagKey
  | typeof WalletNodeTcpPortFlagKey
  | typeof WalletNodeTcpTlsFlagKey
  | typeof WalletNodeAuthFlagKey

export abstract class IronfishCommand extends Command {
  // Yes, this is disabling the type system but any code
  // that may use this will not be executed until after
  // run() is called and it provides a lot of value
  sdk!: IronfishSdk

  walletConfig!: WalletConfig

  /**
   * Use this logger instance for debug/error output.
   * Actual command output should use `this.log` instead.
   */
  logger: Logger

  /**
   * Set to true when the command is closing so any async things in the command can interrupt and quit
   */
  closing = false

  constructor(argv: string[], config: Config) {
    super(argv, config)
    this.logger = createRootLogger().withTag(this.ctor.id)
  }

  abstract start(): Promise<void> | void

  async run(): Promise<void> {
    try {
      await this.start()
    } catch (error: unknown) {
      if (hasUserResponseError(error)) {
        this.log(error.codeMessage)

        if (error.codeStack) {
          this.sdk.logger.debug(error.codeStack)
        }

        this.exit(1)
      } else if (error instanceof ExitError) {
        throw error
      } else if (error instanceof CLIError) {
        throw error
      } else if (error instanceof RpcConnectionError) {
        this.log(`Cannot connect to your node, start your node first.`)
      } else if (error instanceof DatabaseVersionError) {
        this.log(error.message)
        this.exit(1)
      } else if (error instanceof Error) {
        // eslint-disable-next-line no-console
        console.error(ErrorUtils.renderError(error, true))
        this.exit(1)
      } else {
        throw error
      }
    }

    this.exit(0)
  }

  async init(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    const commandClass = this.constructor as any
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const { flags } = await this.parse(commandClass)

    // Get the flags from the flag object which is unknown
    const dataDirFlag = getFlag(flags, DataDirFlagKey)
    const configFlag = getFlag(flags, ConfigFlagKey)

    const configOverrides: Partial<ConfigOptions> = {}
    const internalOverrides: Partial<InternalOptions> = {}

    const rpcConnectIpcFlag = getFlag(flags, RpcUseIpcFlagKey)
    if (
      typeof rpcConnectIpcFlag === 'boolean' &&
      rpcConnectIpcFlag !== RpcUseIpcFlag.default
    ) {
      configOverrides.enableRpcIpc = rpcConnectIpcFlag
    }

    const rpcConnectTcpFlag = getFlag(flags, RpcUseTcpFlagKey)
    if (
      typeof rpcConnectTcpFlag === 'boolean' &&
      rpcConnectTcpFlag !== RpcUseTcpFlag.default
    ) {
      configOverrides.enableRpcTcp = rpcConnectTcpFlag
    }

    const rpcTcpHostFlag = getFlag(flags, RpcTcpHostFlagKey)
    if (typeof rpcTcpHostFlag === 'string') {
      configOverrides.rpcTcpHost = rpcTcpHostFlag
    }

    const rpcTcpPortFlag = getFlag(flags, RpcTcpPortFlagKey)
    if (typeof rpcTcpPortFlag === 'number') {
      configOverrides.rpcTcpPort = rpcTcpPortFlag
    }

    const rpcConnectHttpFlag = getFlag(flags, RpcUseHttpFlagKey)
    if (
      typeof rpcConnectHttpFlag === 'boolean' &&
      rpcConnectHttpFlag !== RpcUseHttpFlag.default
    ) {
      configOverrides.enableRpcHttp = rpcConnectHttpFlag
    }

    const rpcHttpHostFlag = getFlag(flags, RpcHttpHostFlagKey)
    if (typeof rpcHttpHostFlag === 'string') {
      configOverrides.rpcHttpHost = rpcHttpHostFlag
    }

    const rpcHttpPortFlag = getFlag(flags, RpcHttpPortFlagKey)
    if (typeof rpcHttpPortFlag === 'number') {
      configOverrides.rpcHttpPort = rpcHttpPortFlag
    }

    const rpcTcpTlsFlag = getFlag(flags, RpcTcpTlsFlagKey)
    if (
      typeof rpcTcpTlsFlag === 'boolean' &&
      rpcTcpTlsFlag !== RpcTcpTlsFlag.default
    ) {
      configOverrides.enableRpcTls = rpcTcpTlsFlag
    }

    const verboseFlag = getFlag(flags, VerboseFlagKey)
    if (
      typeof verboseFlag === 'boolean' &&
      verboseFlag !== VerboseFlag.default
    ) {
      configOverrides.logLevel = '*:verbose'
    }

    const rpcAuthFlag = getFlag(flags, RpcAuthFlagKey)
    if (typeof rpcAuthFlag === 'string') {
      internalOverrides.rpcAuthToken = rpcAuthFlag
    }

    this.sdk = await IronfishSdk.init({
      pkg: IronfishCliPKG,
      configOverrides: configOverrides,
      internalOverrides: internalOverrides,
      configName: typeof configFlag === 'string' ? configFlag : undefined,
      dataDir: typeof dataDirFlag === 'string' ? dataDirFlag : undefined,
      logger: this.logger,
    })

    this.walletConfig = new WalletConfig(this.sdk.fileSystem, this.sdk.dataDir)
    await this.walletConfig.load()

    const walletConfigOverrides: Partial<WalletConfigOptions> = {}

    // TODO: This is here for backawrds compatability to migrate wallet configs in the old
    await this.migrateOldConfig(this.sdk.config, this.walletConfig)

    const walletNodeUseIpcFlag = getFlag(flags, WalletNodeUseIpcFlagKey)
    if (typeof walletNodeUseIpcFlag === 'boolean') {
      walletConfigOverrides.walletNodeIpcEnabled = walletNodeUseIpcFlag
    }

    const walletNodeIpcPathFlag = getFlag(flags, WalletNodeIpcPathFlagKey)
    if (typeof walletNodeIpcPathFlag === 'string') {
      walletConfigOverrides.walletNodeIpcPath = walletNodeIpcPathFlag
    }

    const walletNodeUseTcpFlag = getFlag(flags, WalletNodeUseTcpFlagKey)
    if (typeof walletNodeUseTcpFlag === 'boolean') {
      walletConfigOverrides.walletNodeTcpEnabled = walletNodeUseTcpFlag
    }

    const walletNodeTcpHostFlag = getFlag(flags, WalletNodeTcpHostFlagKey)
    if (typeof walletNodeTcpHostFlag === 'string') {
      walletConfigOverrides.walletNodeTcpHost = walletNodeTcpHostFlag
    }

    const walletNodeTcpPortFlag = getFlag(flags, WalletNodeTcpPortFlagKey)
    if (typeof walletNodeTcpPortFlag === 'number') {
      walletConfigOverrides.walletNodeTcpPort = walletNodeTcpPortFlag
    }

    const walletNodeTcpTlsFlag = getFlag(flags, WalletNodeTcpTlsFlagKey)
    if (typeof walletNodeTcpTlsFlag === 'boolean') {
      walletConfigOverrides.walletNodeTlsEnabled = walletNodeTcpTlsFlag
    }

    const walletNodeAuthFlag = getFlag(flags, WalletNodeAuthFlagKey)
    if (typeof walletNodeAuthFlag === 'string') {
      walletConfigOverrides.walletNodeRpcAuthToken = walletNodeAuthFlag
    }

    Object.assign(this.walletConfig.overrides, walletConfigOverrides)
  }

  async migrateOldConfig(
    config: IronfishConfig,
    walletConfig: WalletConfig,
  ): Promise<void> {
    const keys: Array<keyof WalletConfigOptions> = [
      'walletNodeIpcPath',
      'walletNodeTcpEnabled',
      'walletNodeTcpHost',
      'walletNodeTcpPort',
      'walletNodeTlsEnabled',
      'walletNodeRpcAuthToken',
    ]

    for (const key of keys) {
      const configKey = key as keyof ConfigOptions

      if (config.isSet(configKey) && !walletConfig.isSet(key)) {
        const value = config.get(configKey)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        walletConfig.set(key, value as any)
        config.clear(key as keyof ConfigOptions)
      }
    }

    await walletConfig.save()
    await config.save()
  }

  listenForSignals(): void {
    const signals: SIGNALS[] = ['SIGINT', 'SIGTERM', 'SIGUSR2']

    for (const signal of signals) {
      const gracefulShutdown = (signal: NodeJS.Signals) => {
        if (this.closing) {
          return
        }

        // Allow 3 seconds for graceful termination
        setTimeout(() => {
          this.log('Force closing after 3 seconds')
          process.exit(1)
        }, 3000).unref()

        this.closing = true
        const promise = this.closeFromSignal(signal).catch((err) => {
          this.logger.error(`Failed to close ${ErrorUtils.renderError(err)}`)
        })

        void promise.then(() => {
          process.exit(0)
        })
      }

      process.once(signal, gracefulShutdown)
    }
  }

  closeFromSignal(signal: NodeJS.Signals): Promise<unknown> {
    throw new Error(`Not implemented closeFromSignal: ${signal}`)
  }
}

function getFlag(flags: unknown, flag: FLAGS): unknown | null {
  return typeof flags === 'object' && flags !== null && flag in flags
    ? // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      (flags as any)[flag]
    : null
}
