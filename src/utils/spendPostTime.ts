/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { IronfishSdk, RawTransaction } from '@ironfish/sdk'

/**
 * Recalculates the average spendPostTime based on the new measurement.
 */
export async function updateSpendPostTimeInMs(
  sdk: IronfishSdk,
  raw: RawTransaction,
  startTime: number,
  endTime: number,
) {
  if (raw.spends.length === 0) {
    return
  }

  const transactionDuration = endTime - startTime
  const averageSpendTime = Math.ceil(transactionDuration / raw.spends.length)

  const oldAverage = sdk.internal.get('spendPostTime')
  const oldMeasurementCount = sdk.internal.get('spendPostTimeMeasurements')

  // Calculate the new average using the formula: ((oldAverage * oldCount) + newValue) / newCount
  const newMeasurementCount = oldMeasurementCount + 1
  const newAverageSpendPostTime =
    (oldAverage * oldMeasurementCount + averageSpendTime) / newMeasurementCount

  sdk.internal.set('spendPostTime', newAverageSpendPostTime)
  sdk.internal.set('spendPostTimeMeasurements', newMeasurementCount)
  await sdk.internal.save()
}

export function getSpendPostTimeInMs(sdk: IronfishSdk): number {
  return sdk.internal.get('spendPostTime')
}
