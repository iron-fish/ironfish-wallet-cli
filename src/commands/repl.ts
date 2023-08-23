/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import {
  ApiNamespace,
  NodeUtils,
  RpcMemoryClient,
} from '@ironfish/sdk'
import { Flags } from '@oclif/core'
import fs from 'fs/promises'
import repl from 'node:repl'
import path from 'path'
import { IronfishCommand } from '../command'
import {
  ConfigFlag,
  ConfigFlagKey,
  DataDirFlag,
  DataDirFlagKey,
  VerboseFlag,
  VerboseFlagKey,
} from '../flags'

export default class Repl extends IronfishCommand {
  static description = 'An interactive terminal to the node'

  static flags = {
    [VerboseFlagKey]: VerboseFlag,
    [ConfigFlagKey]: ConfigFlag,
    [DataDirFlagKey]: DataDirFlag,
    opendb: Flags.boolean({
      description: 'open the databases',
      allowNo: true,
    }),
  }

  async start(): Promise<void> {
    const { flags } = await this.parse(Repl)

    const namespaces = [
      ApiNamespace.config,
      ApiNamespace.rpc,
      ApiNamespace.wallet,
      ApiNamespace.worker,
    ]

    const node = await this.sdk.walletNode()
    const client = new RpcMemoryClient(
      this.logger,
      node.rpc.getRouter(namespaces),
    )

    if (flags.opendb) {
      await NodeUtils.waitForOpen(node)
    }

    this.log('Examples:')
    this.log('\n  List all account names')
    this.log(`  > wallet.listAccounts().map((a) => a.name)`)
    this.log(`\n  Get the balances of an account`)
    this.log(`  > const account =  await wallet.getAccountByName('default')`)
    this.log(`  > await wallet.getBalances(account)`)
    this.log('')

    const historyPath = path.join(node.config.tempDir, 'repl_history.txt')
    await fs.mkdir(node.config.tempDir, { recursive: true })
    this.log(`Storing repl history at ${historyPath}`)
    this.log('Type .exit or press CTRL+C to quit')

    const server = repl.start('> ')
    server.context.sdk = this.sdk
    server.context.client = client
    server.context.node = node
    server.context.wallet = node.wallet

    // Setup command history file
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    server.setupHistory(historyPath, () => {})

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    await new Promise(() => {})
  }
}
