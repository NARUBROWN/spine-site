import snapshot from '../../../public/benchmarks/internal-lab-20261101/summary.json'

export { snapshot }
export const assetRoot = '/benchmarks/internal-lab-20261101'
export const caseOrder = ['spine', 'nest', 'spring-mvc', 'fastapi'] as const
export const caseNames = {
  spine: 'Spine',
  nest: 'NestJS / Express',
  'spring-mvc': 'Spring MVC',
  fastapi: 'FastAPI / Uvicorn'
}
export type CaseId = typeof caseOrder[number]
export type Result = typeof snapshot.summary[number]

export function resultsFor(mode: string): Result[] {
  return caseOrder.flatMap(id => snapshot.summary.filter(row => row.case === id && row.mode === mode))
}

export function nameFor(id: string): string {
  return caseNames[id as CaseId] || id
}

export function number(value: number, digits = 0): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
}

export const throughput = resultsFor('closed')
export const common = resultsFor('fixed-20000')
export const high = resultsFor('fixed-118000')
