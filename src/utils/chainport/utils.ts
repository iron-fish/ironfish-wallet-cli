/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import {
  defaultNetworkName,
  Logger,
  RpcWalletTransaction,
  TransactionStatus,
  TransactionType,
} from '@ironfish/sdk'
import { ux } from '@oclif/core'
import { getConfig, isNetworkSupportedByChainport } from './config'
import { ChainportMemoMetadata } from './metadata'
import { fetchChainportTransactionStatus } from './requests'
import { ChainportNetwork } from './types'

export type ChainportTransactionData =
  | {
      type: TransactionType.SEND | TransactionType.RECEIVE
      chainportNetworkId: number
      address: string
    }
  | undefined

export const extractChainportDataFromTransaction = (
  networkId: number,
  transaction: RpcWalletTransaction,
): ChainportTransactionData => {
  if (isNetworkSupportedByChainport(networkId) === false) {
    return undefined
  }

  const config = getConfig(networkId)

  if (transaction.type === TransactionType.SEND) {
    return getOutgoingChainportTransactionData(transaction, config)
  }
  if (transaction.type === TransactionType.RECEIVE) {
    return getIncomingChainportTransactionData(transaction, config)
  }
  return undefined
}

const getIncomingChainportTransactionData = (
  transaction: RpcWalletTransaction,
  config: { incomingAddresses: Set<string> },
): ChainportTransactionData => {
  const bridgeNote = transaction.notes?.[0]

  if (
    !bridgeNote ||
    !isAddressInSet(bridgeNote.sender, config.incomingAddresses)
  ) {
    return undefined
  }

  const [sourceNetwork, address, _] = ChainportMemoMetadata.decode(
    bridgeNote.memoHex,
  )

  return {
    type: TransactionType.RECEIVE,
    chainportNetworkId: sourceNetwork,
    address: address,
  }
}

const getOutgoingChainportTransactionData = (
  transaction: RpcWalletTransaction,
  config: { outgoingAddresses: Set<string> },
): ChainportTransactionData => {
  if (!transaction.notes || transaction.notes.length < 2) {
    return undefined
  }

  if (
    !transaction.notes.find((note) => note.memo === '{"type": "fee_payment"}')
  ) {
    return undefined
  }

  const bridgeNote = transaction.notes.find((note) =>
    isAddressInSet(note.owner, config.outgoingAddresses),
  )

  if (!bridgeNote) {
    return undefined
  }

  const [sourceNetwork, address, _] = ChainportMemoMetadata.decode(
    bridgeNote.memoHex,
  )

  return {
    type: TransactionType.SEND,
    chainportNetworkId: sourceNetwork,
    address: address,
  }
}

const isAddressInSet = (address: string, addressSet: Set<string>): boolean => {
  return addressSet.has(address.toLowerCase())
}

export const displayChainportTransactionSummary = async (
  networkId: number,
  transaction: RpcWalletTransaction,
  data: ChainportTransactionData,
  network: ChainportNetwork | undefined,
  logger: Logger,
) => {
  if (!data) {
    return
  }

  if (!network) {
    logger.log(
      `This transaction is a ${
        data.type === TransactionType.SEND ? 'outgoing' : 'incoming'
      } chainport bridge transaction. Error fetching network details.`,
    )
    return
  }

  /* eslint-disable @typescript-eslint/restrict-template-expressions */

  // Chainport does not give us a way to determine the source transaction hash of an incoming bridge transaction
  // So we can only display the source network and address
  if (data.type === TransactionType.RECEIVE) {
    logger.log(`
Direction:                    Incoming
Source Network:               ${network.name}
       Address:               ${data.address}
       Explorer Account:      ${
         network.explorer_url + 'address/' + data.address
       }
Target (Ironfish) Network:    ${defaultNetworkName(networkId)}`)

    return
  }

  const basicInfo = `
Direction:                    Outgoing
==============================================
Source Network:               ${defaultNetworkName(networkId)}
       Transaction Status:    ${transaction.status}
       Transaction Hash:      ${transaction.hash}
==============================================
Target Network:               ${network.name}
       Address:               ${data.address}
       Explorer Account:      ${
         network.explorer_url + 'address/' + data.address
       }`

  /* eslint-enable @typescript-eslint/restrict-template-expressions */

  // We'll wait to show the transaction status if the transaction is still pending on Ironfish
  if (transaction.status !== TransactionStatus.CONFIRMED) {
    logger.log(basicInfo)
    return
  }

  ux.action.start('Fetching transaction information on target network')
  const transactionStatus = await fetchChainportTransactionStatus(
    networkId,
    transaction.hash,
  )
  logger.log(`Transaction status fetched`)
  ux.action.stop()

  logger.log(basicInfo)

  if (Object.keys(transactionStatus).length === 0) {
    logger.log(`
Transaction status not found on target network.
Note: Bridge transactions may take up to 30 minutes to surface on the target network.
If this issue persists, please contact chainport support: https://helpdesk.chainport.io/`)
    return
  }

  if (!transactionStatus.base_tx_hash || !transactionStatus.base_tx_status) {
    logger.log(`       Transaction Status:    pending`)
    return
  }

  if (transactionStatus.target_tx_hash === null) {
    logger.log(`       Transaction Status:    pending`)
    return
  }

  if (transactionStatus.target_tx_status === 1) {
    logger.log(`       Transaction Status:    completed`)
  } else {
    logger.log(`       Transaction Status:    in progress`)
  }

  logger.log(`       Transaction Hash:      ${transactionStatus.target_tx_hash}
       Explorer Transaction:  ${
         network.explorer_url + 'tx/' + transactionStatus.target_tx_hash
       }`)
}
