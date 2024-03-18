/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { PromiseUtils, RpcAccountStatus } from '@ironfish/sdk'
import { CliUx, Flags } from '@oclif/core'
import { FlagInput } from '@oclif/core/lib/interfaces'
import blessed from 'blessed'
import { IronfishCommand } from '../command'
import { RemoteFlags } from '../flags'
import { connectRpcWallet, RpcClientWallet } from '../utils/clients'

export class StatusCommand extends IronfishCommand {
  static description = `Get status of an account`

  static flags = {
    ...RemoteFlags,
    ...CliUx.ux.table.flags(),
    follow: Flags.boolean({
      char: 'f',
      default: false,
      description: 'Follow the status of the node live',
    }),
  }

  async start(): Promise<void> {
    const { args, flags } = await this.parse(StatusCommand)
    const follow = flags.follow as boolean | undefined
    const account = args.account as string | undefined

    if (!follow) {
      const client = await connectRpcWallet(this.sdk, this.walletConfig)
      const accounts = await this.getAccountsStatus(client, account)
      this.renderStatus(accounts, flags, this.log.bind(this))
      this.exit(0)
    }

    // Console log will create display issues with Blessed
    this.logger.pauseLogs()

    const screen = blessed.screen({ smartCSR: true, fullUnicode: true })
    const statusText = blessed.text()
    screen.append(statusText)

    let previousResponse = ''

    while (true) {
      const connected = await this.sdk.client.tryConnect()

      if (!connected) {
        statusText.clearBaseLine(0)

        if (previousResponse) {
          statusText.setContent(previousResponse)

          statusText.insertTop('Node: Disconnected \n')
        } else {
          statusText.setContent('Node: STOPPED')
        }

        screen.render()
        await PromiseUtils.sleep(1000)
        continue
      }

      statusText.clearBaseLine(0)

      const client = await connectRpcWallet(this.sdk, this.walletConfig)

      const accounts = await this.getAccountsStatus(client, account)

      let tableBody = ''

      // This is a workaround to display the CliUX.Table output in Blessed.
      // CliUX.Table does not return a string and instead prints to a custom function

      const logTable = (s: string) => {
        tableBody += s + '\n'
      }

      this.renderStatus(accounts, flags, logTable)

      statusText.setContent(tableBody)

      previousResponse = tableBody

      screen.render()
      await PromiseUtils.sleep(1000)
    }
  }

  renderStatus(
    accounts: RpcAccountStatus[],
    flags: FlagInput,
    printLine: (s: string) => void,
  ): void {
    CliUx.ux.table(
      accounts,
      {
        name: {
          header: 'Account Name',
          minWidth: 11,
        },
        id: {
          header: 'Account ID',
        },
        headHash: {
          header: 'Head Hash',
        },
        headInChain: {
          header: 'Head In Chain',
        },
        sequence: {
          header: 'Head Sequence',
        },
      },
      {
        printLine,
        ...flags,
      },
    )
  }

  async getAccountsStatus(
    client: RpcClientWallet,
    account?: string | undefined,
  ): Promise<RpcAccountStatus[]> {
    if (account) {
      return await client.wallet
        .getAccountStatus({ account })
        .then((r) => [r.content.account])
    }

    return await client.wallet
      .getAccountsStatus()
      .then((r) => r.content.accounts)
  }
}
