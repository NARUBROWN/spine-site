import reference from '../../../public/benchmarks/cloud-memory-cost-20261101.json'

export const memoryCostReference = reference
export const memoryCostAsset = '/benchmarks/cloud-memory-cost-20261101.json'
export const memoryCostInstance = reference.candidates.reduce((lowest, candidate) =>
  candidate.hourlyUsd < lowest.hourlyUsd ? candidate : lowest
)

// VM 전체 요금을 메모리 용량 비율로 배분한 환산액입니다.
export function monthlyMemoryCostEquivalentKrw(differenceMiB: number): number {
  return differenceMiB / 1024 / memoryCostInstance.memoryGiB
    * memoryCostInstance.hourlyUsd * reference.monthlyHours * reference.fx.usdKrw
}
