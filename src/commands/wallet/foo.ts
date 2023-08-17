
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { CurrencyUtils, GetBalanceResponse, RpcClient, isNativeIdentifier } from '@ironfish/sdk'
import { Flags } from '@oclif/core'
import { IronfishCommand, IronfishRpcCommand } from '../../command'
import { RemoteFlags } from '../../flags'
import { renderAssetName } from '../../utils'
import { BalanceCommand } from './balance'

export class FooCommand extends BalanceCommand {
  static description =
    'Display the account balance\n\
  What is the difference between available to spend balance, and balance?\n\
  Available to spend balance is your coins from transactions that have been mined on blocks on your main chain.\n\
  Balance is your coins from all of your transactions, even if they are on forks or not yet included as part of a mined block.'

  static flags = {
    ...RemoteFlags,
    explain: Flags.boolean({
      default: false,
      description: 'Explain your balance',
    }),
    all: Flags.boolean({
      default: false,
      description: 'Also show unconfirmed balance',
    }),
    confirmations: Flags.integer({
      required: false,
      description: 'Minimum number of blocks confirmations for a transaction',
    }),
    assetId: Flags.string({
      required: false,
      description: 'Asset identifier to check the balance for',
    }),
  }

  static args = [
    {
      name: 'account',
      parse: (input: string): Promise<string> => Promise.resolve(input.trim()),
      required: false,
      description: 'Name of the account to get balance for',
    },
  ]

  async client(): Promise<RpcClient> {
    console.log('b', this)
    return this.sdk.connectRpc()
  }
}
