/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import {
  DatabaseIsLockedError,
  DatabaseOpenError,
  ErrorUtils,
  FileUtils,
  IronfishPKG,
} from '@ironfish/sdk'
import { WalletNode } from '@ironfish/sdk/build/src/walletNode'
import { execSync } from 'child_process'
import os from 'os'
import { getHeapStatistics } from 'v8'
import { IronfishCommand } from '../command'
import { LocalFlags } from '../flags'

const SPACE_BUFFER = 8

export default class Debug extends IronfishCommand {
  static description = 'Show debug information to help locate issues'
  static hidden = true

  static flags = {
    ...LocalFlags,
  }

  async start(): Promise<void> {
    const node = await this.sdk.walletNode()

    let dbOpen = true
    try {
      await node.openDB()
    } catch (err) {
      if (err instanceof DatabaseIsLockedError) {
        this.log('Database in use, skipping output that requires database.')
        this.log(
          'Stop the node and run the debug command again to show full output.\n',
        )
        dbOpen = false
      } else if (err instanceof DatabaseOpenError) {
        this.log(
          'Database cannot be opened, skipping output that requires database.\n',
        )
        this.log(ErrorUtils.renderError(err, true) + '\n')
        dbOpen = false
      }
    }

    let output = this.baseOutput(node)
    if (dbOpen) {
      output = new Map([...output, ...(await this.outputRequiringDB(node))])
    }

    this.display(output)
  }

  baseOutput(node: WalletNode): Map<string, string> {
    const cpus = os.cpus()
    const cpuNames = [...new Set(cpus.map((c) => c.model))]
    const cpuThreads = cpus.length

    const memTotal = FileUtils.formatMemorySize(os.totalmem())
    const heapTotal = FileUtils.formatMemorySize(
      getHeapStatistics().total_available_size,
    )

    const telemetryEnabled = this.sdk.config.get('enableTelemetry').toString()
    const assetVerificationEnabled = this.sdk.config
      .get('enableAssetVerification')
      .toString()

    let cmdInPath: boolean
    try {
      execSync('ironfish --help', { stdio: 'ignore' })
      cmdInPath = true
    } catch {
      cmdInPath = false
    }

    return new Map<string, string>([
      ['Iron Fish version', `${node.pkg.version} @ ${node.pkg.git}`],
      ['Iron Fish library', `${IronfishPKG.version} @ ${IronfishPKG.git}`],
      ['Operating system', `${os.type()} ${process.arch}`],
      ['CPU model(s)', `${cpuNames.toString()}`],
      ['CPU threads', `${cpuThreads}`],
      ['RAM total', `${memTotal}`],
      ['Heap total', `${heapTotal}`],
      ['Node version', `${process.version}`],
      ['ironfish in PATH', `${cmdInPath.toString()}`],
      ['Garbage Collector Exposed', `${String(!!global.gc)}`],
      ['Telemetry enabled', `${telemetryEnabled}`],
      ['Asset Verification enabled', `${assetVerificationEnabled}`],
    ])
  }

  async outputRequiringDB(node: WalletNode): Promise<Map<string, string>> {
    const output = new Map<string, string>()

    const headHashes = new Map<string, Buffer | null>()
    for await (const { accountId, head } of node.wallet.walletDb.loadHeads()) {
      headHashes.set(accountId, head?.hash ?? null)
    }

    for (const [accountId, headHash] of headHashes.entries()) {
      const account = node.wallet.getAccount(accountId)

      const response = headHash
        ? await node.wallet.chainGetBlock({ hash: headHash.toString('hex') })
        : null
      const headInChain = !!response
      const headSequence = response?.block?.sequence || 'null'

      const shortId = accountId.slice(0, 6)

      output.set(`Account ${shortId} uuid`, `${accountId}`)
      output.set(
        `Account ${shortId} name`,
        `${account?.name || `ACCOUNT NOT FOUND`}`,
      )
      output.set(
        `Account ${shortId} head hash`,
        `${headHash ? headHash.toString('hex') : 'NULL'}`,
      )
      output.set(
        `Account ${shortId} head in chain`,
        `${headInChain.toString()}`,
      )
      output.set(`Account ${shortId} sequence`, `${headSequence}`)
    }

    return output
  }

  display(output: Map<string, string>): void {
    // Get the longest key length to determine how big to make the space buffer
    let longestStringLength = 0
    for (const key of output.keys()) {
      if (key.length > longestStringLength) {
        longestStringLength = key.length
      }
    }

    const maxKeyWidth = longestStringLength + SPACE_BUFFER
    output.forEach((value, key) => {
      const spaceWidth = maxKeyWidth - key.length
      const spaceString = new Array(spaceWidth).join(' ')
      this.log(`${key}${spaceString}${value}`)
    })
  }
}
