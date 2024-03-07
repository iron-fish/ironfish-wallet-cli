/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import {
  BlockHashSerdeInstance,
  GraffitiSerdeInstance,
  NetworkDefinition,
  Target,
} from '@ironfish/sdk'
import { RawBlockHeader } from '@ironfish/sdk/build/src/primitives/blockheader'

// TODO: This copies code from BlockHeaderSerde (https://github.com/iron-fish/ironfish/blob/master/ironfish/src/primitives/blockheader.ts)
// Refactor to use the same code once it is exported by the SDK
export function headerDefinitionToHeader(
  headerDefinition: NetworkDefinition['genesis']['header'],
): RawBlockHeader {
  return {
    sequence: Number(headerDefinition.sequence),
    previousBlockHash: Buffer.from(
      BlockHashSerdeInstance.deserialize(headerDefinition.previousBlockHash),
    ),
    noteCommitment: headerDefinition.noteCommitment,
    transactionCommitment: headerDefinition.transactionCommitment,
    target: new Target(headerDefinition.target),
    randomness: BigInt(headerDefinition.randomness),
    timestamp: new Date(headerDefinition.timestamp),
    graffiti: Buffer.from(
      GraffitiSerdeInstance.deserialize(headerDefinition.graffiti),
    ),
  }
}
