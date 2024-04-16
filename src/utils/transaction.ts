/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import {
  createRootLogger,
  CurrencyUtils,
  GetUnsignedTransactionNotesResponse,
  Logger,
  PromiseUtils,
  RawTransaction,
  RpcAsset,
  RpcClient,
  TimeUtils,
  TransactionStatus,
  UnsignedTransaction,
} from '@ironfish/sdk'
import { CliUx } from '@oclif/core'
import { getAssetsByIDs } from './asset'

export async function renderUnsignedTransactionDetails(
  client: RpcClient,
  unsignedTransaction: UnsignedTransaction,
  account?: string,
  logger?: Logger,
): Promise<void> {
  logger = logger ?? createRootLogger()

  let response
  if (unsignedTransaction.notes.length > 0) {
    response = await client.wallet.getUnsignedTransactionNotes({
      account,
      unsignedTransaction: unsignedTransaction.serialize().toString('hex'),
    })
  }

  const assetIds = collectAssetIds(unsignedTransaction, response?.content)
  const assetLookup = await getAssetsByIDs(client, assetIds)

  if (unsignedTransaction.mints.length > 0) {
    logger.log('')
    logger.log('==================')
    logger.log('Transaction Mints:')
    logger.log('==================')

    for (const [i, mint] of unsignedTransaction.mints.entries()) {
      if (i !== 0) {
        logger.log('------------------')
      }
      logger.log('')

      const renderedAmount = CurrencyUtils.render(
        mint.value,
        false,
        mint.asset.id().toString('hex'),
        assetLookup[mint.asset.id().toString('hex')].verification,
      )
      logger.log(`Asset ID:      ${mint.asset.id().toString('hex')}`)
      logger.log(`Name:          ${mint.asset.name().toString('utf8')}`)
      logger.log(`Amount:        ${renderedAmount}`)

      if (mint.transferOwnershipTo) {
        logger.log(
          `Ownership of logger asset will be transferred to ${mint.transferOwnershipTo.toString(
            'hex',
          )}. The current account will no longer have any permission to mint or modify logger asset. logger cannot be undone.`,
        )
      }
      logger.log('')
    }
  }

  if (unsignedTransaction.burns.length > 0) {
    logger.log('')
    logger.log('==================')
    logger.log('Transaction Burns:')
    logger.log('==================')

    for (const [i, burn] of unsignedTransaction.burns.entries()) {
      if (i !== 0) {
        logger.log('------------------')
      }
      logger.log('')

      const renderedAmount = CurrencyUtils.render(
        burn.value,
        false,
        burn.assetId.toString('hex'),
        assetLookup[burn.assetId.toString('hex')].verification,
      )
      logger.log(`Asset ID:      ${burn.assetId.toString('hex')}`)
      logger.log(`Amount:        ${renderedAmount}`)
      logger.log('')
    }
  }

  if (unsignedTransaction.notes.length > 0) {
    const response = await client.wallet.getUnsignedTransactionNotes({
      account,
      unsignedTransaction: unsignedTransaction.serialize().toString('hex'),
    })

    logger.log('')
    logger.log('==================')
    logger.log('Notes sent:')
    logger.log('==================')

    for (const [i, note] of response.content.sentNotes.entries()) {
      // Skip logger since we'll re-render for received notes
      if (note.owner === note.sender) {
        continue
      }

      if (i !== 0) {
        logger.log('------------------')
      }
      logger.log('')

      const renderedAmount = CurrencyUtils.render(
        note.value,
        true,
        note.assetId,
        assetLookup[note.assetId].verification,
      )
      logger.log(`Amount:        ${renderedAmount}`)
      logger.log(`Memo:          ${note.memo}`)
      logger.log(`Recipient:     ${note.owner}`)
      logger.log(`Sender:        ${note.sender}`)
      logger.log('')
    }

    logger.log('')
    logger.log('==================')
    logger.log('Notes received:')
    logger.log('==================')

    for (const [i, note] of response.content.receivedNotes.entries()) {
      if (i !== 0) {
        logger.log('------------------')
      }
      logger.log('')

      const renderedAmount = CurrencyUtils.render(
        note.value,
        true,
        note.assetId,
        assetLookup[note.assetId].verification,
      )
      logger.log(`Amount:        ${renderedAmount}`)
      logger.log(`Memo:          ${note.memo}`)
      logger.log(`Recipient:     ${note.owner}`)
      logger.log(`Sender:        ${note.sender}`)
      logger.log('')
    }

    if (
      !response.content.sentNotes.length &&
      !response.content.receivedNotes.length
    ) {
      logger.log('')
      logger.log('------------------')
      logger.log('Account unable to decrypt any notes in this transaction')
      logger.log('------------------')
    }
  }

  logger.log('')
}

export function displayTransactionSummary(
  transaction: RawTransaction,
  asset: RpcAsset,
  amount: bigint,
  from: string,
  to: string,
  memo: string,
  logger?: Logger,
): void {
  logger = logger ?? createRootLogger()

  const amountString = CurrencyUtils.render(
    amount,
    true,
    asset.id,
    asset.verification,
  )
  const feeString = CurrencyUtils.render(transaction.fee, true)

  const summary = `\
\nTRANSACTION SUMMARY:
From                 ${from}
To                   ${to}
Amount               ${amountString}
Fee                  ${feeString}
Memo                 ${memo}
Outputs              ${transaction.outputs.length}
Spends               ${transaction.spends.length}
Expiration           ${
    transaction.expiration ? transaction.expiration.toString() : ''
  }
`
  logger.log(summary)
}

export async function watchTransaction(options: {
  client: Pick<RpcClient, 'wallet'>
  hash: string
  account?: string
  confirmations?: number
  waitUntil?: TransactionStatus
  pollFrequencyMs?: number
  logger?: Logger
}): Promise<void> {
  const logger = options.logger ?? createRootLogger()
  const waitUntil = options.waitUntil ?? TransactionStatus.CONFIRMED
  const pollFrequencyMs = options.pollFrequencyMs ?? 10000

  let lastTime = Date.now()

  let last = await options.client.wallet.getAccountTransaction({
    account: options.account,
    hash: options.hash,
    confirmations: options.confirmations,
  })

  const startTime = lastTime

  let prevStatus: TransactionStatus | 'not found' =
    last?.content.transaction?.status ?? 'not found'
  let currentStatus = prevStatus

  // If the transaction is already in the desired state, return
  if (currentStatus === waitUntil) {
    logger.log(`Transaction ${options.hash} is ${waitUntil}`)
    return
  }

  logger.log(`Watching transaction ${options.hash}`)

  CliUx.ux.action.start(`Current Status`)
  const span = TimeUtils.renderSpan(0, { hideMilliseconds: true })
  CliUx.ux.action.status = `${currentStatus} ${span}`

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await options.client.wallet.getAccountTransaction({
      account: options.account,
      hash: options.hash,
      confirmations: options.confirmations,
    })

    currentStatus = response?.content.transaction?.status ?? 'not found'

    if (prevStatus !== 'not found' && currentStatus === 'not found') {
      CliUx.ux.action.stop(
        `Transaction ${options.hash} deleted while watching it.`,
      )
      break
    }

    if (currentStatus === prevStatus) {
      const duration = Date.now() - lastTime
      const span = TimeUtils.renderSpan(duration, { hideMilliseconds: true })
      CliUx.ux.action.status = `${currentStatus} ${span}`
      await PromiseUtils.sleep(pollFrequencyMs)
      continue
    }

    // State has changed
    const now = Date.now()
    const duration = now - lastTime
    lastTime = now

    CliUx.ux.action.stop(
      `${prevStatus} -> ${currentStatus}: ${TimeUtils.renderSpan(duration, {
        hideMilliseconds: true,
      })}`,
    )

    last = response
    prevStatus = currentStatus

    CliUx.ux.action.start(`Current Status`)
    const span = TimeUtils.renderSpan(0, { hideMilliseconds: true })
    CliUx.ux.action.status = `${currentStatus} ${span}`

    if (currentStatus === waitUntil) {
      const duration = now - startTime
      const span = TimeUtils.renderSpan(duration, { hideMilliseconds: true })
      CliUx.ux.action.stop(`done after ${span}`)
      break
    }
  }
}

function collectAssetIds(
  unsignedTransaction: UnsignedTransaction,
  notes?: GetUnsignedTransactionNotesResponse,
): string[] {
  const assetIds = new Set<string>()

  for (const mint of unsignedTransaction.mints) {
    assetIds.add(mint.asset.id().toString('hex'))
  }

  for (const burn of unsignedTransaction.burns) {
    assetIds.add(burn.assetId.toString('hex'))
  }

  if (notes) {
    for (const receivedNote of notes.receivedNotes) {
      assetIds.add(receivedNote.assetId)
    }

    for (const sentNotes of notes.sentNotes) {
      assetIds.add(sentNotes.assetId)
    }
  }

  return Array.from(assetIds)
}
