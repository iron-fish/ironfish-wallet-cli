/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import {
  GetAccountStatusResponse,
  PromiseUtils,
  RpcResponseEnded,
} from '@ironfish/sdk'
import { CliUx, Flags } from '@oclif/core'
import { FlagInput } from '@oclif/core/lib/interfaces'
import blessed from 'blessed'
import { IronfishCommand } from '../command'
import { RemoteFlags } from '../flags'
import { connectRpcWallet } from '../utils/clients'

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
      const client = await connectRpcWallet(this.sdk, this.walletConfig, )

      const response = await client.wallet.getAccountsStatus({
        account,
      })

      this.renderStatus(response, flags, this.log.bind(this))

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

      const response = await client.wallet.getAccountsStatus({
        account: account,
      })

      let tableBody = ''

      // This is a workaround to display the CliUX.Table output in Blessed.
      // CliUX.Table does not return a string and instead prints to a custom function

      const logTable = (s: string) => {
        tableBody += s + '\n'
      }

      this.renderStatus(response, flags, logTable)

      statusText.setContent(tableBody)

      previousResponse = tableBody

      screen.render()
      await PromiseUtils.sleep(1000)
    }
  }

  renderStatus(
    response: RpcResponseEnded<GetAccountStatusResponse>,
    flags: FlagInput,
    printLine: (s: string) => void,
  ): void {
    CliUx.ux.table(
      response.content.accounts,
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
}
