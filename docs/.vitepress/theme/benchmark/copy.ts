const ko = {
  path: 'ko', badge: 'Spine 내부 랩 테스트',
  title: ["같은 자원에서 더 많이 처리했습니다.", "메모리는 더 적게 사용했습니다."],
  intro: "NestJS/Express, Spring MVC, FastAPI/Uvicorn에 모두 3 vCPU와 3GiB 메모리를 할당해 비교했습니다.",
  throughputStat: 'HTTP 처리량', throughputContext: "포화 부하에서 측정한 중앙값",
  memoryStat: '관측 메모리', memoryContext: "초당 2만 요청일 때의 사용량",
  latencyStat: 'p99 응답 지연', latencyContext: "초당 2만 요청일 때의 지연",
  throughput: '처리량', memory: '메모리', chartLabel: '비교할 지표',
  throughputTitle: '같은 CPU 예산에서 처리한 요청 수', memoryTitle: '같은 요청률에서 관측한 메모리',
  throughputDirection: '높을수록 좋습니다', memoryDirection: '낮을수록 좋습니다',
  throughputRatio: 'Spine 처리량 {value}배', memoryRatio: 'Spine 메모리 {value}% 적게', baseline: 'Spine',
  throughputCondition: '동시 연결 256개에서의 포화 처리량. 각 구현의 실제 처리량을 비교했습니다.',
  memoryCondition: '공통 초당 20,000 요청. 런타임과 워커를 포함한 cgroup memory.current 관측값입니다.',
  method: "2026년 11월 1일에 JSON 입력을 검증하고 응답하는 작업을 측정했습니다. 연결 256개를 유지하고 서버를 매번 새로 시작해 예열한 뒤 15초씩 세 번 측정한 중앙값입니다. Spine 0.5.2에 GOGC=400을 적용했습니다.",
  cta: '측정 조건과 전체 결과 보기', csv: '측정 데이터 CSV',
  reportIntro: '같은 자원에서 확인한 높은 HTTP 처리량과 낮은 메모리 사용량. WFB의 공개 측정 방식을 참고해 Spine 프로젝트가 자체 측정했습니다.',
  findingsTitle: '비교 결과', findings: '처리량은 포화 부하, 지연과 메모리는 공통 초당 2만 요청 조건에서 각각 비교합니다. 값은 독립 서버 시작 3회의 중앙값입니다.',
  throughputTable: '포화 부하 · 동시 연결 256', commonTable: '공통 부하 · 초당 20,000 요청',
  highTable: '추가 고부하 · 초당 118,000 요청', framework: '구성', rps: '처리량 (req/s)',
  mean: '평균 (ms)', p95: 'p95 (ms)', p99: 'p99 (ms)', memoryColumn: '관측 메모리 (MiB)', range: '관측 범위',
  latencyNote: '공통 부하에서 Spine의 p99 중앙값은 1.062ms였습니다. NestJS·Spring MVC와의 차이는 작으며, 모든 부하에서 가장 낮은 지연을 기록했다는 뜻은 아닙니다. 포화 부하의 Spring MVC p99 중앙값은 3.891ms, Spine은 4.398ms였습니다.',
  highNote: '11.8만 요청 조건은 Spring MVC의 포화 처리량에 가깝습니다. p99 관측 범위는 Spine 2.707–2.931ms, Spring MVC 10.724–206.784ms였습니다. Spring MVC의 3회 중 1회는 목표 처리량의 98%에 미달했으며 해당 표본을 보존했습니다.',
  methodTitle: '측정 환경과 방법',
  specifications: [
    ['호스트', 'ARM64 · 14코어(성능 10·효율 4) · RAM 24GB'],
    ['참고 클럭', '약 4.5GHz. 측정 중 실제 동작 클럭은 기록하거나 고정하지 않았습니다.'],
    ['실행 환경', 'Docker Desktop · Linux/arm64 · HTTP/1.1 keep-alive · loopback'],
    ['서버 자원 한도', '모든 구현에 3 vCPU·3GiB, 추가 swap 없음'],
    ['부하 생성기', 'zrk 2.4.2 · 별도 CPU 집합 9개 · 메모리 1GiB'],
    ['작업', '43바이트 JSON 파싱 → 필드 검증 → JSON 응답'],
    ['반복', '구현별 새 서버 시작 3회 · 창당 15초 · 전체 30개 표본'],
    ['예열', 'Spring MVC 최소 135초, 나머지 45초. 최근 3개 창의 처리량 변동계수 5% 이하'],
    ['Spine 설정', 'GOGC=400 · GOMAXPROCS=3 · GOMEMLIMIT=2700MiB']
  ],
  runtimeTitle: '실행 버전', scopeTitle: '결과를 읽는 방법',
  scope: [
    'JSON은 측정에 사용한 공통 작업입니다. 메모리는 JSON 데이터만의 크기가 아니라 런타임·프로세스·워커를 포함한 서버 컨테이너 전체 관측값입니다.',
    'Spine은 직접 필드 검사, NestJS는 ValidationPipe/class-validator, Spring MVC는 Jakarta Validation, FastAPI는 Pydantic으로 같은 시험 필드 제약을 검사했습니다.',
    '고정 요청률 지연은 예정된 송신 시각부터 계산해 송신 대기도 포함합니다. 포화 부하 지연은 응답 뒤 다음 요청을 보내는 다른 방식이므로 같은 부하 조건끼리 비교해야 합니다.',
    '단일 호스트에서 15초씩 세 번 측정한 결과입니다. DB·외부 API·CORS·인증·TLS·요청별 DI 서비스 호출과 장시간 운영 안정성은 시험 범위에 포함하지 않았습니다.',
    '메모리는 측정 중 1초 간격 memory.current의 창별 중앙값을 다시 세 실행의 중앙값으로 요약했습니다. 최소 필요 RAM이나 프로세스 RSS를 의미하지 않습니다.'
  ],
  tuningTitle: 'GOGC=400을 고른 이유',
  tuning: '별도 대조 실험에서 GOGC 100·200·400을 비교했습니다. 100→400에서 Spine의 GC 빈도는 약 77.4%, p99는 약 28.9% 낮아졌고 관측 메모리는 약 12.9MiB 늘었습니다. 메모리 여유를 활용해 GC 비용을 줄인 구성입니다. 이 대조 실험의 표본은 최종 비교에 합치지 않았습니다.',
  selectionTitle: '대표 비교 구성을 고른 이유',
  selection: [
    ['NestJS / ExpressAdapter', '어댑터를 생략할 때 사용하는 기본 구성과 패키지 설치 규모를 참고했습니다. 2026-10-01~30의 npm 다운로드는 Express 44,534,475회, Fastify 7,725,701회, NodeAdapter 6,116회였습니다. 다운로드는 사용자 점유율이 아닙니다. NodeAdapter는 2026-10-27 처음 배포돼 관측 기간도 짧습니다. 현재 Nest 문서는 NodeAdapter를 권장하므로 이번 대상은 기존 사용 환경의 대표 구성인 Express로 명시합니다.'],
    ['Spring MVC', 'State of Spring 2024 조사에서 응답자 1,464명의 70%가 WebMVC를 사용한다고 답한 점을 참고했습니다. 복수응답이며 2026년 점유율이나 WebFlux가 나머지 30%라는 의미는 아닙니다. 측정에는 Tomcat과 가상 스레드를 사용했습니다.'],
    ['FastAPI / Uvicorn', '공식 fastapi run 명령의 기본 ASGI 서버인 Uvicorn을 선택했습니다. 워커 3개와 uvloop·httptools를 사용했습니다. Hypercorn·Daphne·Granian 등 다른 ASGI 서버의 성능을 대신하는 결과는 아닙니다.']
  ],
  evidenceTitle: '공개 데이터와 검증',
  evidence: '본측정 30개, HTTP 계약 검사 168개, HDR 히스토그램 30개를 검증했습니다. 요청 오류와 Docker OOMKilled 표시는 없었습니다. ZIP에는 앱 소스·측정 코드·원본 zrk JSON과 히스토그램을 담았습니다. 클라우드 인증·운영 기록은 포함하지 않았습니다.',
  evidenceLink: '소스·전체 표본·원시 히스토그램 ZIP', jsonLink: '집계 JSON', checksumLink: 'SHA-256',
  wfbNote: 'WFB의 공개 측정 방식을 참고한 자체 측정이며 WFB 공식 리더보드 점수나 독립기관의 인증이 아닙니다.',
  sourcesTitle: '선정·측정 기준의 출처', back: '메인 화면으로'
}

const en: typeof ko = {
  path: 'en', badge: 'Spine internal lab',
  title: ["More requests on the same resources.", "Less memory at the same request rate."],
  intro: "We compared NestJS/Express, Spring MVC and FastAPI/Uvicorn with the same allocation of 3 vCPU and 3 GiB of memory.",
  throughputStat: 'HTTP throughput', throughputContext: "Saturated load, median of 3 starts",
  memoryStat: 'Observed memory', memoryContext: "Whole container at 20k req/s",
  latencyStat: 'p99 response latency', latencyContext: "Median p99 at 20k req/s",
  throughput: 'Throughput', memory: 'Memory', chartLabel: 'Comparison metric',
  throughputTitle: 'Requests served within the same CPU budget', memoryTitle: 'Memory observed at the same request rate',
  throughputDirection: 'Higher is better', memoryDirection: 'Lower is better',
  throughputRatio: '{value}× throughput with Spine', memoryRatio: '{value}% less memory with Spine', baseline: 'Spine',
  throughputCondition: 'Saturated throughput at 256 connections. Each implementation runs at its own achieved request rate.',
  memoryCondition: 'A common 20,000 req/s load. cgroup memory.current includes the runtime and workers.',
  method: "Measured by the Spine project on 2026-11-01 using JSON validation and response. Values are medians of three fresh server starts, with 15-second windows after warmup and 256 connections. Spine 0.5.2 uses GOGC=400.",
  cta: 'Read the method and full results', csv: 'Measurement CSV',
  reportIntro: 'Higher HTTP throughput and lower observed memory within the same resource budget. Independently measured by the Spine project, informed by WFB’s public methodology.',
  findingsTitle: 'Comparison results', findings: 'Throughput is compared under saturated load; latency and memory are compared at a common 20,000 req/s. Values are medians across three fresh server starts.',
  throughputTable: 'Saturated load · 256 connections', commonTable: 'Common load · 20,000 req/s',
  highTable: 'Additional high load · 118,000 req/s', framework: 'Configuration', rps: 'Throughput (req/s)',
  mean: 'Mean (ms)', p95: 'p95 (ms)', p99: 'p99 (ms)', memoryColumn: 'Observed memory (MiB)', range: 'Observed range',
  latencyNote: 'Spine’s common-load p99 median was 1.062ms. The differences from NestJS and Spring MVC are small; Spine did not have the lowest latency at every load. Under saturation, Spring MVC’s p99 median was 3.891ms and Spine’s was 4.398ms.',
  highNote: '118,000 req/s is close to Spring MVC’s saturated throughput. Observed p99 ranges were 2.707–2.931ms for Spine and 10.724–206.784ms for Spring MVC. One of three Spring MVC samples achieved less than 98% of the target rate and was retained.',
  methodTitle: 'Environment and method',
  specifications: [
    ['Host', 'ARM64 · 14 cores (10 performance, 4 efficiency) · 24GB RAM'],
    ['Reference clock', 'About 4.5GHz. Actual operating frequency was not recorded or fixed during this test.'],
    ['Environment', 'Docker Desktop · Linux/arm64 · HTTP/1.1 keep-alive · loopback'],
    ['Server budget', '3 vCPU / 3 GiB for every implementation, with no additional swap'],
    ['Load generator', 'zrk 2.4.2 · 9 separate CPU cores · 1 GiB memory'],
    ['Workload', '43-byte JSON parsing → field validation → JSON response'],
    ['Repetitions', '3 fresh starts per implementation · 15s per window · 30 primary samples'],
    ['Warmup', 'At least 135s for Spring MVC, 45s for others; last-three-window throughput CV ≤ 5%'],
    ['Spine settings', 'GOGC=400 · GOMAXPROCS=3 · GOMEMLIMIT=2700MiB']
  ],
  runtimeTitle: 'Runtime versions', scopeTitle: 'Reading the results',
  scope: [
    'JSON is the common measured workload. Memory is whole-container usage, including the runtime, processes and workers, rather than the size of JSON data alone.',
    'The tested field constraints use direct checks in Spine, ValidationPipe/class-validator in NestJS, Jakarta Validation in Spring MVC and Pydantic in FastAPI.',
    'Fixed-rate latency is measured from the scheduled send time and includes send backlog. Closed-loop load sends the next request after a response. Compare latencies within the same load model.',
    'These are three 15-second measurements on one host. Database, external I/O, CORS, authentication, TLS, injected per-request service calls and long-running stability were outside the test.',
    'Memory is the median of one-second memory.current samples per window, then the median across three starts. It is neither minimum required RAM nor process RSS.'
  ],
  tuningTitle: 'Why GOGC=400',
  tuning: 'A separate controlled experiment compared GOGC 100, 200 and 400. Moving from 100 to 400 reduced Spine’s observed GC frequency by about 77.4% and p99 by about 28.9%, while observed memory increased by about 12.9MiB. This uses memory headroom to reduce GC work. Those samples were not merged into the final comparison.',
  selectionTitle: 'Why these configurations',
  selection: [
    ['NestJS / ExpressAdapter', 'Selected for its default-without-an-adapter behavior and package installation scale. Downloads during 2026-10-01–30 were 44,534,475 for Express, 7,725,701 for Fastify and 6,116 for NodeAdapter. Downloads are not user market share. NodeAdapter was first published on 2026-10-27 and had a shorter observation period. Nest now recommends NodeAdapter, so this comparison specifically represents the established Express configuration.'],
    ['Spring MVC', 'In State of Spring 2024, 70% of 1,464 respondents reported using WebMVC. This was a multiple-choice survey, not 2026 market share, and does not imply WebFlux has the remaining 30%. The measured configuration uses Tomcat and virtual threads.'],
    ['FastAPI / Uvicorn', 'Uvicorn is the default ASGI server behind the official fastapi run command. The test uses three workers, uvloop and httptools. It does not stand in for Hypercorn, Daphne, Granian or other ASGI server configurations.']
  ],
  evidenceTitle: 'Data and verification',
  evidence: 'Verified 30 primary samples, 168 HTTP contract fixtures and 30 HDR histograms. No request errors or Docker OOMKilled flags were recorded. The ZIP contains application and observation sources, original zrk JSON and histograms. Cloud credentials and operational records are excluded.',
  evidenceLink: 'Sources, all samples and raw histograms ZIP', jsonLink: 'Aggregate JSON', checksumLink: 'SHA-256',
  wfbNote: 'A self-run test informed by WFB’s public methodology, not an official WFB leaderboard score or independent certification.',
  sourcesTitle: 'Methodology and selection sources', back: 'Back to home'
}

const ja: typeof ko = {
  ...en, path: 'ja', badge: 'Spine 内部ラボテスト',
  title: ["同じリソースでより多くのリクエストを処理しました。", "同じ負荷でメモリを少なく使いました。"],
  intro: "NestJS/Express、Spring MVC、FastAPI/Uvicornに同じ3 vCPUと3GiBのメモリを割り当てて比較しました。",
  throughputStat: 'HTTP処理量', throughputContext: "飽和負荷で3回測定した中央値",
  memoryStat: '観測メモリ', memoryContext: "毎秒2万リクエスト時の使用量",
  latencyStat: 'p99応答時間', latencyContext: "毎秒2万リクエスト時の応答時間",
  throughput: '処理量', memory: 'メモリ', chartLabel: '比較する指標',
  throughputTitle: '同じCPU制約で処理したリクエスト数', memoryTitle: '同じリクエストレートで観測したメモリ',
  throughputDirection: '大きいほど良い', memoryDirection: '小さいほど良い',
  throughputRatio: 'Spineの処理量は{value}倍', memoryRatio: 'Spineのメモリは{value}%少ない',
  throughputCondition: '同時接続256での飽和処理量です。各構成の実際の処理量を比較しています。',
  memoryCondition: '共通の毎秒20,000リクエスト。ランタイムとワーカーを含むcgroup memory.currentの観測値です。',
  method: "2026-11-01にSpineプロジェクトがJSON入力の検証と応答を測定しました。同時接続256で、サーバーを毎回新規起動し、予熱後に15秒ずつ測定した3回の中央値です。Spine 0.5.2にGOGC=400を適用しました。",
  cta: '測定条件と全結果を見る', csv: '測定データCSV',
  reportIntro: '同じリソース制約で確認した高いHTTP処理量と低いメモリ使用量。WFBの公開手法を参考にSpineプロジェクトが自己測定しました。',
  findingsTitle: '比較結果', findings: '処理量は飽和負荷、応答時間とメモリは共通の毎秒20,000リクエストで比較します。各値は新規サーバー起動3回の中央値です。',
  throughputTable: '飽和負荷 · 同時接続256', commonTable: '共通負荷 · 毎秒20,000リクエスト', highTable: '追加高負荷 · 毎秒118,000リクエスト',
  framework: '構成', rps: '処理量 (req/s)', mean: '平均 (ms)', memoryColumn: '観測メモリ (MiB)', range: '観測範囲',
  latencyNote: '共通負荷でSpineのp99中央値は1.062msでした。NestJS・Spring MVCとの差は小さく、すべての負荷で最短だったわけではありません。飽和負荷のp99中央値はSpring MVCが3.891ms、Spineが4.398msでした。',
  highNote: '毎秒118,000リクエストはSpring MVCの飽和処理量に近い条件です。p99の範囲はSpineが2.707–2.931ms、Spring MVCが10.724–206.784msでした。Spring MVCの3回中1回は目標の98%未満でしたが除外していません。',
  methodTitle: '環境と測定方法',
  specifications: [
    ['ホスト', 'ARM64 · 14コア（高性能10・高効率4）· RAM 24GB'], ['参考クロック', '約4.5GHz。測定中の動作周波数は記録・固定していません。'],
    ['実行環境', 'Docker Desktop · Linux/arm64 · HTTP/1.1 keep-alive · loopback'], ['サーバー制約', '全構成3 vCPU・3GiB、追加swapなし'],
    ['負荷生成器', 'zrk 2.4.2 · 分離したCPU 9コア · メモリ1GiB'], ['処理', '43バイトJSON解析 → フィールド検証 → JSON応答'],
    ['反復', '構成ごとに新規起動3回 · 各15秒 · 本測定30標本'], ['予熱', 'Spring MVCは最低135秒、その他45秒。直近3区間の処理量CVが5%以下'],
    ['Spine設定', 'GOGC=400 · GOMAXPROCS=3 · GOMEMLIMIT=2700MiB']
  ],
  runtimeTitle: '実行バージョン', scopeTitle: '結果の読み方',
  scope: [
    'JSONは共通の測定処理です。メモリはJSONデータだけでなくランタイム・プロセス・ワーカーを含むコンテナ全体の値です。',
    '同じ試験フィールド制約を、Spineは直接検査、NestJSはValidationPipe/class-validator、Spring MVCはJakarta Validation、FastAPIはPydanticで検証しました。',
    '固定レートの応答時間には予定送信時刻からの待ち時間を含みます。応答後に次を送る飽和負荷とは測定方式が異なるため同条件で比較してください。',
    '単一ホストで15秒を3回測定しました。DB・外部I/O・CORS・認証・TLS・リクエスト別の注入サービス呼び出し・長時間安定性は対象外です。',
    'メモリは1秒間隔memory.currentの区間中央値を3起動の中央値に集計しました。最低必要RAMやプロセスRSSではありません。'
  ],
  tuningTitle: 'GOGC=400の選定理由', tuning: '別の対照実験でGOGC 100・200・400を比較しました。100→400でGC頻度は約77.4%、p99は約28.9%減少し、観測メモリは約12.9MiB増えました。メモリ余裕をGCコスト削減に使用した設定です。この標本は最終比較に合算していません。',
  selectionTitle: '比較構成の選定理由',
  selection: [
    ['NestJS / ExpressAdapter', '省略時のデフォルト構成とパッケージ規模を参考にしました。2026-10-01〜30のnpmダウンロードはExpress 44,534,475、Fastify 7,725,701、NodeAdapter 6,116回。利用者シェアではありません。NodeAdapterは2026-10-27公開で観測期間も短いためです。現在のNest推奨はNodeAdapterであり、今回は既存環境を代表するExpress構成の比較です。'],
    ['Spring MVC', 'State of Spring 2024で1,464人の70%がWebMVC利用と回答しました。複数回答で2026年シェアではなく、残り30%がWebFluxという意味でもありません。Tomcatと仮想スレッドを使用しました。'],
    ['FastAPI / Uvicorn', '公式fastapi runのデフォルトASGIサーバーを選びました。3ワーカー・uvloop・httptoolsを使用。他のHypercorn・Daphne・Granian構成を代表する結果ではありません。']
  ],
  evidenceTitle: '公開データと検証', evidence: '本測定30標本、HTTP契約168件、HDRヒストグラム30件を検証しました。リクエストエラーとDocker OOMKilled表示はありません。ZIPにはアプリ・観測コードと元のzrk JSON・ヒストグラムを収録し、クラウド認証・運用記録は除外しています。',
  evidenceLink: 'ソース・全標本・ヒストグラムZIP', jsonLink: '集計JSON', wfbNote: 'WFBの公開手法を参考にした自己測定であり、WFB公式スコアや独立機関の認証ではありません。', sourcesTitle: '選定・測定方法の出典', back: 'ホームへ'
}

const zhHans: typeof ko = {
  ...en, path: 'zh-Hans', badge: 'Spine 内部实验室测试',
  title: ["在相同资源下处理更多请求。", "在相同负载下使用更少内存。"],
  intro: "为NestJS/Express、Spring MVC和FastAPI/Uvicorn分配相同的3 vCPU与3GiB内存进行比较。",
  throughputStat: 'HTTP吞吐量', throughputContext: "饱和负载下3次启动的中位数", memoryStat: '观测内存', memoryContext: "每秒2万请求时的容器用量",
  latencyStat: 'p99响应延迟', latencyContext: "每秒2万请求时的p99延迟",
  throughput: '吞吐量', memory: '内存', chartLabel: '比较指标', throughputTitle: '相同CPU预算下处理的请求数', memoryTitle: '相同请求速率下观测的内存',
  throughputDirection: '越高越好', memoryDirection: '越低越好', throughputRatio: 'Spine吞吐量为{value}倍', memoryRatio: 'Spine内存少{value}%',
  throughputCondition: '256个并发连接下的饱和吞吐量，各配置处理的实际请求速率不同。', memoryCondition: '统一每秒20,000请求，cgroup memory.current包含运行时与工作进程。',
  method: "Spine项目于2026-11-01测量了JSON输入验证与响应。保持256个并发连接，服务器每次独立启动并完成预热后测量15秒，共3次，取中位数。Spine 0.5.2使用GOGC=400。",
  cta: '查看测量条件与完整结果', csv: '测量数据CSV', reportIntro: '在相同资源预算下观测到更高HTTP吞吐量和更低内存占用。由Spine项目参考WFB公开方法自行测量。',
  findingsTitle: '比较结果', findings: '吞吐量在饱和负载下比较，延迟与内存在统一每秒20,000请求下比较。数值为3次独立服务器启动的中位数。',
  throughputTable: '饱和负载 · 256并发连接', commonTable: '统一负载 · 每秒20,000请求', highTable: '额外高负载 · 每秒118,000请求', framework: '配置', rps: '吞吐量 (req/s)', mean: '平均 (ms)', memoryColumn: '观测内存 (MiB)', range: '观测范围',
  latencyNote: '统一负载下Spine的p99中位数为1.062ms，与NestJS、Spring MVC差距较小。并非所有负载下延迟都最低：饱和负载下Spring MVC的p99为3.891ms，Spine为4.398ms。',
  highNote: '每秒118,000请求接近Spring MVC的饱和吞吐量。p99范围：Spine 2.707–2.931ms，Spring MVC 10.724–206.784ms。Spring MVC的3个样本中1个未达目标速率98%，该样本未被剔除。',
  methodTitle: '环境与测量方法', specifications: [
    ['主机', 'ARM64 · 14核心（10性能、4能效）· RAM 24GB'], ['参考频率', '约4.5GHz；测试期间未记录或固定实际运行频率。'], ['环境', 'Docker Desktop · Linux/arm64 · HTTP/1.1 keep-alive · loopback'],
    ['服务器限制', '所有配置均为3 vCPU、3GiB，无额外swap'], ['负载生成器', 'zrk 2.4.2 · 独立CPU集合9核心 · 内存1GiB'], ['工作负载', '43字节JSON解析 → 字段验证 → JSON响应'],
    ['重复', '每配置独立启动3次 · 每窗口15秒 · 共30个正式样本'], ['预热', 'Spring MVC至少135秒，其余45秒；最近3窗口吞吐量CV不超过5%'], ['Spine设置', 'GOGC=400 · GOMAXPROCS=3 · GOMEMLIMIT=2700MiB']
  ], runtimeTitle: '运行版本', scopeTitle: '如何解读结果', scope: [
    'JSON是共同测试任务。内存并非只计算JSON数据，而是包含运行时、进程、工作进程的容器整体观测值。',
    '同样的测试字段约束由Spine直接检查、NestJS ValidationPipe/class-validator、Spring MVC Jakarta Validation与FastAPI Pydantic分别完成。',
    '固定速率延迟从计划发送时刻计算，包含发送等待；饱和闭环负载在响应后发送下一请求。请在相同负载模型下比较。',
    '单台主机，每次15秒、共3次。未测试DB、外部I/O、CORS、认证、TLS、逐请求注入服务调用或长期稳定性。',
    '内存按每秒memory.current样本的窗口中位数，再取3次启动中位数；不表示最低RAM需求或进程RSS。'
  ], tuningTitle: '为何选择GOGC=400', tuning: '另行对照测试了GOGC 100、200和400。100→400时GC频率约下降77.4%，p99约下降28.9%，观测内存约增加12.9MiB。利用内存余量降低GC成本。这些样本未并入最终比较。',
  selectionTitle: '代表配置的选择理由', selection: [
    ['NestJS / ExpressAdapter', '参考未指定适配器时的默认配置与包安装规模。2026-10-01至30日npm下载为Express 44,534,475、Fastify 7,725,701、NodeAdapter 6,116次。下载量不等于用户份额。NodeAdapter于2026-10-27首次发布，观察期也较短。Nest目前推荐NodeAdapter；本次明确比较现有生态的Express配置。'],
    ['Spring MVC', 'State of Spring 2024调查中，1,464位受访者的70%报告使用WebMVC。这是多选调查，并非2026年份额，也不表示WebFlux占其余30%。使用Tomcat和虚拟线程。'],
    ['FastAPI / Uvicorn', '选择官方fastapi run默认使用的ASGI服务器，配置3个worker、uvloop与httptools。结果不代表Hypercorn、Daphne、Granian等其他服务器。']
  ], evidenceTitle: '公开数据与验证', evidence: '验证了30个正式样本、168项HTTP契约及30个HDR直方图。未记录请求错误或Docker OOMKilled标记。ZIP包含应用与观测源码、原始zrk JSON和直方图，不含云端认证或运营记录。',
  evidenceLink: '源码、完整样本与原始直方图ZIP', jsonLink: '汇总JSON', wfbNote: '参考WFB公开方法的自行测量，并非WFB官方榜单分数或独立机构认证。', sourcesTitle: '方法与配置选择来源', back: '返回首页'
}

const zhHant: typeof ko = {
  ...zhHans, path: 'zh-Hant', badge: 'Spine 內部實驗室測試', title: ["在相同資源下處理更多請求。", "在相同負載下使用更少記憶體。"],
  intro: "為NestJS/Express、Spring MVC和FastAPI/Uvicorn分配相同的3 vCPU與3GiB記憶體進行比較。",
  throughputStat: 'HTTP吞吐量', throughputContext: "飽和負載下3次啟動的中位數", memoryStat: '觀測記憶體', memoryContext: "每秒2萬請求時的容器用量", latencyStat: 'p99回應延遲', latencyContext: "每秒2萬請求時的p99延遲",
  throughput: '吞吐量', memory: '記憶體', chartLabel: '比較指標', throughputTitle: '相同CPU預算下處理的請求數', memoryTitle: '相同請求速率下觀測的記憶體', throughputDirection: '越高越好', memoryDirection: '越低越好',
  throughputRatio: 'Spine吞吐量為{value}倍', memoryRatio: 'Spine記憶體少{value}%', throughputCondition: '256個並行連線下的飽和吞吐量，各組態處理的實際請求速率不同。', memoryCondition: '統一每秒20,000請求，cgroup memory.current包含執行階段與工作行程。',
  method: "Spine專案於2026-11-01量測JSON輸入驗證與回應。維持256個並行連線，伺服器每次獨立啟動並完成暖機後量測15秒，共3次，取中位數。Spine 0.5.2使用GOGC=400。", cta: '查看量測條件與完整結果', csv: '量測資料CSV',
  reportIntro: '在相同資源預算下觀測到更高HTTP吞吐量和更低記憶體用量。由Spine專案參考WFB公開方法自行量測。', findingsTitle: '比較結果', findings: '吞吐量在飽和負載下比較，延遲與記憶體在統一每秒20,000請求下比較。數值為3次獨立伺服器啟動的中位數。',
  throughputTable: '飽和負載 · 256並行連線', commonTable: '統一負載 · 每秒20,000請求', highTable: '額外高負載 · 每秒118,000請求', framework: '組態', mean: '平均 (ms)', memoryColumn: '觀測記憶體 (MiB)', range: '觀測範圍',
  latencyNote: '統一負載下Spine的p99中位數為1.062ms，與NestJS、Spring MVC差距較小。並非所有負載下延遲都最低：飽和負載下Spring MVC的p99為3.891ms，Spine為4.398ms。', highNote: '每秒118,000請求接近Spring MVC的飽和吞吐量。p99範圍：Spine 2.707–2.931ms，Spring MVC 10.724–206.784ms。Spring MVC的3個樣本中1個未達目標速率98%，該樣本未被剔除。',
  methodTitle: '環境與量測方法', specifications: [
    ['主機', 'ARM64 · 14核心（10效能、4節能）· RAM 24GB'], ['參考時脈', '約4.5GHz；測試期間未記錄或固定實際運作時脈。'], ['環境', 'Docker Desktop · Linux/arm64 · HTTP/1.1 keep-alive · loopback'],
    ['伺服器限制', '所有組態均為3 vCPU、3GiB，無額外swap'], ['負載產生器', 'zrk 2.4.2 · 獨立CPU集合9核心 · 記憶體1GiB'], ['工作負載', '43位元組JSON解析 → 欄位驗證 → JSON回應'],
    ['重複', '每組態獨立啟動3次 · 每視窗15秒 · 共30個正式樣本'], ['暖機', 'Spring MVC至少135秒，其餘45秒；最近3視窗吞吐量CV不超過5%'], ['Spine設定', 'GOGC=400 · GOMAXPROCS=3 · GOMEMLIMIT=2700MiB']
  ], runtimeTitle: '執行版本', scopeTitle: '如何解讀結果', scope: [
    'JSON是共同測試任務。記憶體並非只計算JSON資料，而是包含執行階段、行程與工作行程的容器整體觀測值。',
    '同樣的測試欄位約束由Spine直接檢查、NestJS ValidationPipe/class-validator、Spring MVC Jakarta Validation與FastAPI Pydantic分別完成。',
    '固定速率延遲從預定傳送時刻計算，包含傳送等待；飽和閉環負載在回應後傳送下一請求。請在相同負載模型下比較。',
    '單台主機，每次15秒、共3次。未測試DB、外部I/O、CORS、驗證、TLS、逐請求注入服務呼叫或長期穩定性。',
    '記憶體按每秒memory.current樣本的視窗中位數，再取3次啟動中位數；不表示最低RAM需求或行程RSS。'
  ], tuningTitle: '為何選擇GOGC=400', tuning: '另行對照測試了GOGC 100、200和400。100→400時GC頻率約下降77.4%，p99約下降28.9%，觀測記憶體約增加12.9MiB。利用記憶體餘裕降低GC成本。這些樣本未併入最終比較。',
  selectionTitle: '代表組態的選擇理由', selection: [
    ['NestJS / ExpressAdapter', '參考未指定適配器時的預設組態與套件安裝規模。2026-10-01至30日npm下載為Express 44,534,475、Fastify 7,725,701、NodeAdapter 6,116次。下載量不等於使用者占比。NodeAdapter於2026-10-27首次發布，觀察期也較短。Nest目前推薦NodeAdapter；本次明確比較既有生態的Express組態。'],
    ['Spring MVC', 'State of Spring 2024調查中，1,464位受訪者的70%回報使用WebMVC。這是複選調查，並非2026年占比，也不表示WebFlux占其餘30%。使用Tomcat和虛擬執行緒。'],
    ['FastAPI / Uvicorn', '選擇官方fastapi run預設使用的ASGI伺服器，組態為3個worker、uvloop與httptools。結果不代表Hypercorn、Daphne、Granian等其他伺服器。']
  ], evidenceTitle: '公開資料與驗證', evidence: '驗證了30個正式樣本、168項HTTP契約及30個HDR直方圖。未記錄請求錯誤或Docker OOMKilled標記。ZIP包含應用與觀測原始碼、原始zrk JSON和直方圖，不含雲端認證或營運記錄。', evidenceLink: '原始碼、完整樣本與原始直方圖ZIP', jsonLink: '彙整JSON', wfbNote: '參考WFB公開方法的自行量測，並非WFB官方榜單分數或獨立機構認證。', sourcesTitle: '方法與組態選擇來源', back: '返回首頁'
}

export function benchmarkCopy(lang: string): typeof ko {
  if (lang === 'ko') return ko
  if (lang === 'ja') return ja
  if (lang === 'zh-Hant' || lang === 'zh-TW') return zhHant
  if (lang === 'zh-Hans' || lang === 'zh-CN') return zhHans
  return en
}
