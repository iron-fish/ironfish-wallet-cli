/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { CliUx } from '@oclif/core'
import { IronfishCommand } from '../command'
import { RemoteFlags } from '../flags'

export default class WalletStop extends IronfishCommand {
  static description = 'Stop the wallet node'

  static flags = {
    ...RemoteFlags,
  }

  startDonePromise: Promise<void> | null = null

  async start(): Promise<void> {
    await this.sdk.client.connect()

    CliUx.ux.action.start('Asking node to shut down...')

    await this.sdk.client.node.stopNode()

    CliUx.ux.action.stop('Done...')
  }
}
