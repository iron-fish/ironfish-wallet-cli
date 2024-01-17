/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { Config, FileSystem } from '@ironfish/sdk'
import * as yup from 'yup'

export type WalletConfigOptions = {
  walletNodeIpcEnabled: boolean
  walletNodeIpcPath: string
  walletNodeTcpEnabled: boolean
  walletNodeTcpHost: string
  walletNodeTcpPort: number
  walletNodeTlsEnabled: boolean
  walletNodeRpcAuthToken: string
}

const WALLET_CONFIG_DEFAULTS: WalletConfigOptions = {
  walletNodeIpcEnabled: false,
  walletNodeIpcPath: '',
  walletNodeTcpEnabled: false,
  walletNodeTcpHost: '',
  walletNodeTcpPort: 8020,
  walletNodeTlsEnabled: true,
  walletNodeRpcAuthToken: '',
}

export const WalletConfigOptionsSchema: yup.ObjectSchema<
  Partial<WalletConfigOptions>
> = yup
  .object({
    walletNodeIpcEnabled: yup.boolean(),
    walletNodeIpcPath: yup.string(),
    walletNodeTcpEnabled: yup.boolean(),
    walletNodeTcpHost: yup.string(),
    walletNodeTcpPort: yup.number(),
    walletNodeTlsEnabled: yup.boolean(),
    walletNodeRpcAuthToken: yup.string(),
  })
  .defined()

export class WalletConfig extends Config<WalletConfigOptions> {
  constructor(files: FileSystem, dataDir: string) {
    super(
      files,
      dataDir,
      {
        ...Config.GetDefaults(files, dataDir),
        ...WALLET_CONFIG_DEFAULTS,
      },
      undefined,
      WalletConfigOptionsSchema,
    )
  }
}
