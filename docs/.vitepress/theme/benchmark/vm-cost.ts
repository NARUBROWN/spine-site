import reference from '../../../public/benchmarks/vpsgod-vm-cost-20261101.json'

export const vmCostReference = reference
export const vmCostAsset = '/benchmarks/vpsgod-vm-cost-20261101.json'
export const vmCostRows = reference.estimates
export type VmCostRow = typeof vmCostRows[number]

export function annualVmCostKrw(row: VmCostRow): number {
  return row.selectedPlan.annualUsd * reference.fx.usdKrw
}

// 같은 환율과 선결제 기간으로 비교한 VM 기본요금의 차이입니다.
export function annualVmSavingKrw(row: VmCostRow): number {
  return annualVmCostKrw(row) - annualVmCostKrw(vmCostRows[0])
}

export function monthlyVmSavingKrw(row: VmCostRow): number {
  return annualVmSavingKrw(row) / reference.billing.termMonths
}

export function vmCostText(message: string): string {
  const spinePlan = vmCostRows[0].selectedPlan
  const tokens: Record<string, string | number> = {
    vcpus: spinePlan.vcpus,
    memoryMiB: spinePlan.memoryMiB,
    annualUsd: spinePlan.annualUsd,
    date: reference.checkedOn,
    fxDate: reference.fx.date,
    fx: new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(reference.fx.usdKrw)
  }
  return message.replace(/\{(\w+)\}/g, (placeholder, key: string) => String(tokens[key] ?? placeholder))
}
