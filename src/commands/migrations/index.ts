/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { IronfishCommand } from '../../command'
import {
  ConfigFlag,
  ConfigFlagKey,
  DataDirFlag,
  DataDirFlagKey,
} from '../../flags'
import { walletNode } from '../../walletNode'

export class StatusCommand extends IronfishCommand {
  static description = `List all the migration statuses`

  static flags = {
    [ConfigFlagKey]: ConfigFlag,
    [DataDirFlagKey]: DataDirFlag,
  }

  async start(): Promise<void> {
    await this.parse(StatusCommand)

    const node = await walletNode({
      sdk: this.sdk,
      walletConfig: this.walletConfig,
      connectNodeClient: false,
    })

    await node.migrator.check()
  }
}
