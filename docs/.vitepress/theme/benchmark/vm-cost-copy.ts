const ko = {
  tab: '예상 비용',
  title: '예상 연간 절감액',
  direction: 'Spine 사용 시 VM 기본요금 절감 예상액이며 높을수록 좋습니다',
  assumption: '초당 2만 요청을 기준으로 계산한 시나리오',
  comparison: '{framework} 대신 Spine을 쓰면',
  annualSavingUnit: '/ 년 절감 예상',
  annual: '연 ${value} 선결제',
  saving: '월 환산 약 ₩{value} 절감 예상',
  condition: 'vpsGOD의 연간 선결제 요금 차이로 계산했습니다. 월 절감액은 연간 차액을 12로 나눈 값입니다. 비교군에도 저렴한 공개 할인 상품을 적용했습니다.',
  spinePlan: 'Spine은 {vcpus} vCPU·{memoryMiB}MB 상품을 기준으로 계산했습니다. 연 ${annualUsd}를 선결제하는 구성입니다.',
  note: 'CPU 성능과 여유를 가정한 예측입니다. 해당 VM에서 처리량과 p99를 실측하지 않았으며, 추가 트래픽과 세금은 제외했습니다.',
  details: '구성과 계산 근거 보기',
  basis: '계산에 사용한 가정',
  cpu: '코어당 성능을 측정 환경의 50%로 가정하고 CPU 여유 20%를 반영했습니다. 3회 측정 중 가장 큰 평균 CPU 사용량으로 코어 수를 계산했습니다.',
  memory: '시작과 예열을 포함한 관측 최대 메모리의 1.25배에 경량 OS용 128MiB를 더했습니다. 워커 수 조정과 미리 빌드한 앱의 직접 실행을 가정한 값이며, 최소 RAM 실측값은 아닙니다.',
  selection: '필요 CPU와 RAM을 만족하는 확인된 상품 중 연간 기본요금이 낮은 것을 골랐습니다. 더 큰 할인 상품이 더 저렴하면 비교군에도 적용했습니다.',
  policy: '할인 상품은 CPU를 공정 공유 방식으로 배분합니다. 지속 CPU 할당률은 공개되지 않았습니다. 할인 상품의 지역, 최종 재고와 갱신 가격은 확인하지 않았습니다.',
  traffic: '포함 트래픽은 Spine 100GB, NestJS 2TB, Spring MVC 1TB, FastAPI 4TB입니다. 초과 전송량 비용은 별도이며, 표시 요금으로 초당 2만 요청을 한 달 내내 처리한다는 뜻은 아닙니다.',
  sensitivity: 'CPU 여유를 30%로 늘리면 Spring MVC도 3코어가 필요합니다. FastAPI는 5코어가 필요하지만 확인한 공개 목록에는 맞는 단일 VM이 없어 그 조건의 요금은 산출하지 않았습니다.',
  exchange: '요금 확인일 {date}. 환율은 {fxDate} 유럽중앙은행 기준값으로 계산한 $1 = ₩{fx}입니다. 최초 청구서 할인 코드는 적용하지 않았습니다.',
  formula: '연간 절감 예상액 = (비교 상품 연간 요금 − Spine 상품 연간 요금) × 환율',
  plans: '일반 상품', offers: '할인 상품', fx: '환율 출처', data: '예측 근거 JSON',
  reportTitle: '예상 연간 절감액',
  reportIntro: '실측한 CPU와 메모리 사용량을 vpsGOD의 공개 상품에 대입한 예측입니다. 아래 요금은 실제 VM 성능 측정 결과와 구분해 읽어주세요.'
}

const en: typeof ko = {
  tab: 'VM cost', title: 'Estimated annual savings', direction: 'Estimated VM base-fee savings with Spine; higher is better',
  assumption: 'A resource-sizing scenario for 20,000 requests per second', comparison: 'Use Spine instead of {framework}', annualSavingUnit: '/ year saved (est.)', annual: '${value}/year, paid upfront',
  saving: 'Monthly equivalent: about ₩{value} saved',
  condition: 'Based on the difference in vpsGOD annual upfront fees. Monthly savings are the annual difference divided by 12. Cheaper public offer plans are also used for the comparison frameworks.',
  spinePlan: 'Spine uses a {vcpus} vCPU, {memoryMiB} MB plan costing ${annualUsd} per year, paid upfront.',
  note: 'Estimates assume CPU performance and headroom. Throughput and p99 were not tested on these VMs. Extra transfer and tax are excluded.',
  details: 'View plans and calculation', basis: 'Sizing assumptions',
  cpu: 'Assumes 50% of the measured per-core performance and 20% CPU headroom. Core counts use the highest average CPU usage across three starts.',
  memory: 'Uses 1.25 times the largest observed memory peak, including startup and warmup, plus 128 MiB for a minimal OS. Assumes adjusted worker counts and prebuilt apps running directly; these are not measured minimum RAM requirements.',
  selection: 'Selects the lowest advertised annual base fee among reviewed plans meeting the CPU and RAM estimate. Larger discounted plans are used when cheaper, including for comparison frameworks.',
  policy: 'Offer plans use fair-share CPU allocation; no numeric sustained entitlement is published. Offer regions, final stock and renewal prices were not verified.',
  traffic: 'Included transfer: Spine 100 GB, NestJS 2 TB, Spring MVC 1 TB, FastAPI 4 TB. Overage is extra. These prices do not cover continuous 20,000 requests per second for a month.',
  sensitivity: 'With 30% CPU headroom, Spring MVC also needs 3 cores. FastAPI needs 5; no matching single VM was confirmed in the public catalog, so that scenario has no quoted price.',
  exchange: 'Prices checked {date}. $1 = ₩{fx}, derived from European Central Bank rates dated {fxDate}. No first-invoice coupon is applied.',
  formula: 'Estimated annual savings = (comparison plan annual fee − Spine plan annual fee) × exchange rate',
  plans: 'Standard plans', offers: 'Offer plans', fx: 'Exchange rate source', data: 'Forecast reference JSON',
  reportTitle: 'Estimated annual savings', reportIntro: 'A forecast that maps measured CPU and memory usage to public vpsGOD plans. These prices are separate from the benchmark measurements.'
}

const ja: typeof ko = {
  tab: '費用予測', title: '年間の削減予測', direction: 'Spine利用時のVM基本料金の削減予測。高いほど良い値です',
  assumption: '毎秒20,000リクエストを想定した構成例', comparison: '{framework}の代わりにSpineを使うと', annualSavingUnit: '/ 年の削減予測', annual: '年${value}を前払い',
  saving: '月換算で約₩{value}の削減予測',
  condition: 'vpsGODの年額前払い料金の差額で計算しました。月換算額は年間の差額を12で割った値です。比較対象にも安価な公開割引プランを適用しました。',
  spinePlan: 'Spineは{vcpus} vCPU・{memoryMiB}MB、年${annualUsd}を前払いするプランで計算しました。',
  note: 'CPU性能と余力を仮定した予測です。このVMで処理量とp99は実測していません。超過転送量と税金は別途です。',
  details: '構成と計算根拠を見る', basis: '構成の仮定',
  cpu: 'コア当たりの性能を測定環境の50%、CPU余力を20%と仮定し、3回の起動で最大だった平均CPU使用量からコア数を算出しました。',
  memory: '起動と予熱を含む最大観測メモリの1.25倍に、軽量OS用128MiBを加算。ワーカー数の調整とビルド済みアプリの直接実行を仮定しており、最低必要RAMの実測値ではありません。',
  selection: '推定CPUとRAMを満たす確認済みプランから、表示年額が最も安いものを選択。大容量の割引プランが安ければ比較対象にも適用しました。',
  policy: '割引プランのCPUは公平共有方式です。継続的なCPU割当率は非公開です。割引プランの地域、最終在庫、更新料金は未確認です。',
  traffic: '転送量込み：Spine 100GB、NestJS 2TB、Spring MVC 1TB、FastAPI 4TB。超過分は別料金で、毎秒2万件を1か月連続処理する料金ではありません。',
  sensitivity: 'CPU余力30%ではSpring MVCも3コアが必要です。FastAPIは5コアとなり、公開一覧で対応する単一VMを確認できないため、その条件の料金は算出していません。',
  exchange: '料金確認日{date}。{fxDate}の欧州中央銀行参考値による$1 = ₩{fx}を使用。初回請求の割引コードは未適用です。',
  formula: '年間削減予測額 =（比較プラン年額 − Spineプラン年額）× 為替レート',
  plans: '通常プラン', offers: '割引プラン', fx: '為替レート出典', data: '予測根拠JSON',
  reportTitle: '年間の削減予測', reportIntro: '実測CPU・メモリ使用量をvpsGODの公開プランに当てはめた予測です。VMの実測性能とは区別してご覧ください。'
}

const zhHans: typeof ko = {
  tab: '费用预测', title: '预计每年节省', direction: '使用Spine预计节省的VM基本费用，越高越好',
  assumption: '以每秒20,000次请求为目标的资源配置示例', comparison: '用Spine替代{framework}', annualSavingUnit: '/ 年，预计节省', annual: '每年${value}，预付',
  saving: '折合每月预计节省约₩{value}',
  condition: '根据vpsGOD年度预付费用的差额计算。每月节省额为年度差额除以12。比较框架也采用较便宜的公开优惠套餐。',
  spinePlan: 'Spine按{vcpus} vCPU、{memoryMiB}MB套餐计算，每年${annualUsd}，预付。',
  note: '预测基于假设的CPU性能和余量。尚未在这些VM上实测吞吐量和p99。不含超额流量及税费。',
  details: '查看配置和计算依据', basis: '配置假设',
  cpu: '假设单核性能为测量环境的50%，保留20%的CPU余量，以三次启动中最大的平均CPU用量计算核心数。',
  memory: '将包含启动和预热的最大观测内存乘以1.25，再加上轻量操作系统的128MiB。假设调整工作进程数并直接运行预编译应用，并非实测最低RAM需求。',
  selection: '在已核实且满足预计CPU和RAM的套餐中选择公开年度基本费用最低者。较大优惠套餐更便宜时，同样用于比较框架。',
  policy: '优惠套餐采用公平共享CPU分配，未公开持续CPU配额。优惠套餐地区、最终库存和续费价格尚未核实。',
  traffic: '包含流量：Spine 100GB、NestJS 2TB、Spring MVC 1TB、FastAPI 4TB。超额另计，这些价格不代表整月持续处理每秒2万次请求的费用。',
  sensitivity: '若保留30%的CPU余量，Spring MVC也需要3核。FastAPI需要5核，公开目录未确认对应单台VM，因此未计算该条件的价格。',
  exchange: '价格核实于{date}。汇率$1 = ₩{fx}来自{fxDate}欧洲央行参考值。未使用首张账单优惠码。',
  formula: '预计每年节省 =（比较套餐年费 − Spine套餐年费）× 汇率',
  plans: '常规套餐', offers: '优惠套餐', fx: '汇率来源', data: '预测依据JSON',
  reportTitle: '预计每年节省', reportIntro: '将实测CPU和内存用量映射到vpsGOD公开套餐的预测，请与VM性能实测结果区分。'
}

const zhHant: typeof ko = {
  tab: '費用預測', title: '預估每年節省', direction: '使用Spine預估節省的VM基本費用，越高越好',
  assumption: '以每秒20,000次請求為目標的資源配置範例', comparison: '以Spine取代{framework}', annualSavingUnit: '/ 年，預估節省', annual: '每年${value}，預付',
  saving: '折合每月預估節省約₩{value}',
  condition: '依vpsGOD年度預付費用的差額計算。每月節省額為年度差額除以12。比較框架也採用較便宜的公開優惠方案。',
  spinePlan: 'Spine以{vcpus} vCPU、{memoryMiB}MB方案計算，每年${annualUsd}，預付。',
  note: '預測基於假設的CPU效能和餘裕。尚未在這些VM實測吞吐量與p99。不含超額流量及稅費。',
  details: '查看配置與計算依據', basis: '配置假設',
  cpu: '假設單核心效能為測量環境的50%，保留20%的CPU餘裕，以三次啟動中最大的平均CPU用量計算核心數。',
  memory: '將包含啟動與預熱的最大觀測記憶體乘以1.25，再加上輕量作業系統的128MiB。假設調整工作處理序數並直接執行預先編譯的應用程式，並非實測最低RAM需求。',
  selection: '從已確認且滿足預估CPU與RAM的方案中選擇公開年度基本費用最低者。較大優惠方案更便宜時，同樣用於比較框架。',
  policy: '優惠方案採公平共享CPU分配，未公開持續CPU配額。優惠方案地區、最終庫存與續費價格尚未確認。',
  traffic: '包含流量：Spine 100GB、NestJS 2TB、Spring MVC 1TB、FastAPI 4TB。超額另計，這些價格不代表整月持續處理每秒2萬次請求的費用。',
  sensitivity: '若保留30%的CPU餘裕，Spring MVC也需要3核。FastAPI需要5核，公開目錄未確認對應單台VM，因此未計算該條件的價格。',
  exchange: '價格確認日{date}。匯率$1 = ₩{fx}來自{fxDate}歐洲央行參考值。未使用首張帳單折扣碼。',
  formula: '預估每年節省 =（比較方案年費 − Spine方案年費）× 匯率',
  plans: '一般方案', offers: '優惠方案', fx: '匯率來源', data: '預測依據JSON',
  reportTitle: '預估每年節省', reportIntro: '將實測CPU與記憶體用量對應至vpsGOD公開方案的預測，請與VM效能實測結果區分。'
}

const copies: Record<string, typeof ko> = { ko, en, ja, 'zh-Hans': zhHans, 'zh-Hant': zhHant }
export function vmCostCopy(locale: string): typeof ko {
  return copies[locale] || en
}
