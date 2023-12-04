/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { KeyStore } from '@ironfish/sdk/build/src/fileStores/keyStore'
import { FileSystem } from '@ironfish/sdk/build/src/fileSystems'
import * as yup from 'yup'

export type WalletConfigOptions = {
  /**
   * When the wallet listens for incoming unconfirmed transactions, limit the
   * number of transactions the wallet can queue up before it starts dropping them.
   */
  walletGossipTransactionsMaxQueueSize: number

  /**
   * Enable standalone wallet process to connect to a node via IPC
   */
  walletNodeIpcEnabled: boolean
  walletNodeIpcPath: string

  /**
   * Enable standalone wallet process to connect to a node via TCP
   */
  walletNodeTcpEnabled: boolean
  walletNodeTcpHost: string
  walletNodeTcpPort: number
  walletNodeTlsEnabled: boolean
  walletNodeRpcAuthToken: string
  walletSyncingMaxQueueSize: number
}

const WALLET_CONFIG_DEFAULTS: WalletConfigOptions = {
  walletNodeIpcEnabled: false,
  walletNodeIpcPath: '',
  walletGossipTransactionsMaxQueueSize: 1000,
  walletNodeTcpEnabled: false,
  walletNodeTcpHost: '',
  walletNodeTcpPort: 8020,
  walletNodeTlsEnabled: true,
  walletNodeRpcAuthToken: '',
  walletSyncingMaxQueueSize: 100,
}

export const WalletConfigOptionsSchema: yup.ObjectSchema<
  Partial<WalletConfigOptions>
> = yup
  .object({
    walletGossipTransactionsMaxQueueSize: yup.number(),
    walletNodeIpcEnabled: yup.boolean(),
    walletNodeIpcPath: yup.string(),
    walletNodeTcpEnabled: yup.boolean(),
    walletNodeTcpHost: yup.string(),
    walletNodeTcpPort: yup.number(),
    walletNodeTlsEnabled: yup.boolean(),
    walletNodeRpcAuthToken: yup.string(),
    walletSyncingMaxQueueSize: yup.number(),
  })
  .defined()

export class WalletConfig extends KeyStore<WalletConfigOptions> {
  constructor(files: FileSystem, dataDir: string) {
    super(
      files,
      'config.wallet.json',
      WALLET_CONFIG_DEFAULTS,
      dataDir,
      WalletConfigOptionsSchema,
    )
  }
}
