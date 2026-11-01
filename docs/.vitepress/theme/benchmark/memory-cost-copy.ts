const ko = {
  assumption: '앱 1개의 메모리 절감분을 월 비용으로 환산하면',
  equivalent: 'Spine이었다면 월 약 ₩{value} 상당을 아낄 수 있었습니다.',
  note: 'VM 전체 요금을 메모리 용량 비율로 배분한 예시입니다. 같은 VM을 유지하면 청구액은 변하지 않습니다.',
  details: '요금과 계산 근거 보기',
  reference: '서울의 4 vCPU, 메모리 16GiB인 두 VM 중 저렴한 {provider} {instance} 기준입니다. 월 {hours}시간, 요금 조회 {date}.',
  monthly: '월',
  hourly: '시간당',
  selection: 'Linux 무약정 요금입니다. CPU 크레딧형과 할인은 제외했습니다. 두 VM은 CPU 종류와 성능이 다르며 이 VM들에서 처리량을 재측정하지 않았습니다.',
  formulaLabel: '환산식',
  formula: '메모리 차이(MiB) ÷ 1,024 ÷ {memory}GiB × ${hourly} × {hours}시간 × ₩{fx}/$',
  exchange: '환율은 {fxDate} 유럽중앙은행 기준값으로 계산한 $1 = ₩{fx}입니다.',
  exclusions: '관측 메모리는 최소 필요 RAM이 아닙니다. 실제 절감액은 인스턴스 축소와 CPU 여유 검증에 따라 달라집니다. 세금, 디스크, IP와 네트워크 비용은 제외했습니다.',
  aws: 'AWS 요금', gcp: 'Google Cloud 요금', fx: '환율 출처', data: '계산 근거 JSON'
}

const en: typeof ko = {
  assumption: 'Monthly price equivalent of memory saved for one app',
  equivalent: 'With Spine, the memory saved is worth about ₩{value}/month.',
  note: 'This allocates the full VM price by memory capacity. Keeping the same VM leaves the invoice unchanged.',
  details: 'View prices and calculation',
  reference: 'Uses the cheaper of two 4 vCPU, 16 GiB reference VMs in Seoul: {provider} {instance}. {hours} hours/month; prices checked {date}.',
  monthly: 'month', hourly: 'hour',
  selection: 'Linux on-demand rates, excluding CPU-credit VMs and discounts. The two VMs have different CPUs and performance; throughput was not measured on either VM.',
  formulaLabel: 'Calculation',
  formula: 'Memory difference (MiB) ÷ 1,024 ÷ {memory} GiB × ${hourly} × {hours}h × ₩{fx}/$',
  exchange: '$1 = ₩{fx}, derived from European Central Bank reference rates dated {fxDate}.',
  exclusions: 'Observed memory is not minimum required RAM. Actual savings require validated downsizing and CPU headroom. Tax, disk, IP and network costs are excluded.',
  aws: 'AWS prices', gcp: 'Google Cloud prices', fx: 'Exchange rate source', data: 'Calculation reference JSON'
}

const ja: typeof ko = {
  assumption: 'アプリ1つの削減メモリを月額に換算すると',
  equivalent: 'Spineなら、月約₩{value}相当のメモリを節約できた計算です。',
  note: 'VM全体の料金をメモリ容量比で配分した例です。同じVMを維持する場合、請求額は変わりません。',
  details: '料金と計算根拠を見る',
  reference: 'ソウルの4 vCPU、16GiBの2候補のうち、安価な{provider} {instance}を使用。月{hours}時間、料金確認日{date}。',
  monthly: '月', hourly: '時間',
  selection: 'Linuxのオンデマンド料金です。CPUクレジット型と割引は除外しました。両VMのCPUと性能は異なり、このVMでは処理量を再測定していません。',
  formulaLabel: '換算式',
  formula: 'メモリ差(MiB) ÷ 1,024 ÷ {memory}GiB × ${hourly} × {hours}時間 × ₩{fx}/$',
  exchange: '{fxDate}の欧州中央銀行の参考値から算出した$1 = ₩{fx}を使用しています。',
  exclusions: '観測メモリは最低必要RAMではありません。実際の節約にはVM縮小とCPU余力の検証が必要です。税金、ディスク、IP、ネットワーク費用は含みません。',
  aws: 'AWS料金', gcp: 'Google Cloud料金', fx: '為替レートの出典', data: '計算根拠JSON'
}

const zhHans: typeof ko = {
  assumption: '将单个应用节省的内存换算为月度费用',
  equivalent: '如果使用Spine，节省的内存相当于每月约₩{value}。',
  note: '此示例按内存容量比例分摊整台VM的价格。继续使用相同VM，账单金额不会改变。',
  details: '查看价格与计算依据',
  reference: '以首尔两款4 vCPU、16GiB参考VM中较便宜的{provider} {instance}为基准。每月{hours}小时，价格查询日期{date}。',
  monthly: '月', hourly: '小时',
  selection: '采用Linux按需价格，不含CPU积分型VM与折扣。两款VM的CPU与性能不同，未在这些VM上重新测量吞吐量。',
  formulaLabel: '换算公式',
  formula: '内存差值(MiB) ÷ 1,024 ÷ {memory}GiB × ${hourly} × {hours}小时 × ₩{fx}/$',
  exchange: '汇率为根据{fxDate}欧洲央行参考值计算的$1 = ₩{fx}。',
  exclusions: '观测内存不是最低RAM需求。实际节省需验证VM缩容与CPU余量。不含税、磁盘、IP和网络费用。',
  aws: 'AWS价格', gcp: 'Google Cloud价格', fx: '汇率来源', data: '计算依据JSON'
}

const zhHant: typeof ko = {
  assumption: '將單一應用程式節省的記憶體換算為月費',
  equivalent: '如果使用Spine，節省的記憶體相當於每月約₩{value}。',
  note: '此範例按記憶體容量比例分攤整台VM的價格。繼續使用相同VM，帳單金額不會改變。',
  details: '查看價格與計算依據',
  reference: '以首爾兩款4 vCPU、16GiB參考VM中較便宜的{provider} {instance}為基準。每月{hours}小時，價格查詢日期{date}。',
  monthly: '月', hourly: '小時',
  selection: '採用Linux隨選價格，不含CPU積分型VM與折扣。兩款VM的CPU與效能不同，未在這些VM上重新量測吞吐量。',
  formulaLabel: '換算公式',
  formula: '記憶體差值(MiB) ÷ 1,024 ÷ {memory}GiB × ${hourly} × {hours}小時 × ₩{fx}/$',
  exchange: '匯率為根據{fxDate}歐洲央行參考值計算的$1 = ₩{fx}。',
  exclusions: '觀測記憶體不是最低RAM需求。實際節省需驗證VM縮容與CPU餘裕。不含稅、磁碟、IP和網路費用。',
  aws: 'AWS價格', gcp: 'Google Cloud價格', fx: '匯率來源', data: '計算依據JSON'
}

const copies: Record<string, typeof ko> = { ko, en, ja, 'zh-Hans': zhHans, 'zh-Hant': zhHant }

export function memoryCostCopy(locale: string): typeof ko {
  return copies[locale] || en
}
