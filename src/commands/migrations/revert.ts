/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { IronfishCommand } from '../../command'

export class RevertCommand extends IronfishCommand {
  static description = `revert the last run migration`

  static hidden = true

  async start(): Promise<void> {
    await this.parse(RevertCommand)

    const node = await this.sdk.node()
    await node.migrator.revert()
  }
}
