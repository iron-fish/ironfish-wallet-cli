/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import {
  ApiNamespace,
  IronfishSdk,
  RpcClient,
  RpcMemoryClient,
} from '@ironfish/sdk'
import { WalletConfig } from '../walletConfig'
import { walletNode } from '../walletNode'

export async function connectRpcConfig(
  sdk: IronfishSdk,
  walletConfig: WalletConfig,
  forceLocal = false,
  forceRemote = false,
): Promise<Pick<RpcClient, 'config'>> {
  forceRemote = forceRemote || sdk.config.get('enableRpcTcp')

  if (!forceLocal) {
    if (forceRemote) {
      await sdk.client.connect()
      return sdk.client
    }

    const connected = await sdk.client.tryConnect()
    if (connected) {
      return sdk.client
    }
  }

  // This connection uses a wallet node since that is the most granular type
  // of node available. This can be refactored in the future if needed.
  const node = await walletNode({
    connectNodeClient: false,
    walletConfig: walletConfig,
    sdk: sdk,
  })

  const clientMemory = new RpcMemoryClient(
    sdk.logger,
    node.rpc.getRouter([ApiNamespace.config]),
  )
  return clientMemory
}

export type RpcClientWallet = Pick<
  RpcClient,
  'config' | 'rpc' | 'wallet' | 'worker'
>

export async function connectRpcWallet(
  sdk: IronfishSdk,
  walletConfig: WalletConfig,
  options: {
    forceLocal?: boolean
    forceRemote?: boolean
    connectNodeClient?: boolean
  } = {
    forceLocal: false,
    forceRemote: false,
    connectNodeClient: false,
  },
): Promise<RpcClientWallet> {
  const forceRemote = options.forceRemote || sdk.config.get('enableRpcTcp')

  if (!options.forceLocal) {
    if (forceRemote) {
      await sdk.client.connect()
      return sdk.client
    }

    const connected = await sdk.client.tryConnect()
    if (connected) {
      return sdk.client
    }
  }

  const namespaces = [
    ApiNamespace.config,
    ApiNamespace.rpc,
    ApiNamespace.wallet,
    ApiNamespace.worker,
  ]

  const node = await walletNode({
    connectNodeClient: !!options.connectNodeClient,
    sdk: sdk,
    walletConfig: walletConfig,
  })

  const clientMemory = new RpcMemoryClient(
    sdk.logger,
    node.rpc.getRouter(namespaces),
  )

  await node.waitForOpen()
  if (options.connectNodeClient) {
    await node.connectRpc()
  }

  return clientMemory
}
