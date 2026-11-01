const ko = {
  path: 'ko', badge: 'Spine 내부 랩 테스트',
  title: ["같은 자원으로 더 많이.", "메모리는 더 적게."],
  intro: "NestJS/Express, Spring MVC, FastAPI/Uvicorn에 모두 3 vCPU와 3GiB 메모리를 할당해 비교했습니다.",
  throughputStat: 'HTTP 처리량', throughputContext: "포화 부하에서 측정한 중앙값",
  memoryStat: '관측 메모리', memoryContext: "초당 2만 요청일 때의 사용량",
  latencyStat: 'p99 응답 지연', latencyContext: "초당 2만 요청일 때의 지연",
  throughput: '처리량', memory: '메모리', chartLabel: '비교할 지표',
  throughputTitle: '같은 CPU 예산에서 처리한 요청 수', memoryTitle: '같은 요청률에서 관측한 메모리',
  throughputDirection: '높을수록 좋습니다', memoryDirection: '낮을수록 좋습니다',
  throughputCapacity: 'Spine이었다면 약 {value}명분의 요청을 더 처리할 수 있었습니다.',
  capacityAssumption: '사용자 1명이 초당 한 번 요청한다면',
  capacityNote: '초당 처리량 차이를 1명당 초당 1회 요청으로 환산한 예시입니다. 실제 수용 인원은 요청 빈도와 앱의 작업에 따라 달라집니다.', memoryRatio: 'Spine 메모리 {value}% 적게', baseline: 'Spine',
  throughputCondition: '동시 연결 256개에서의 포화 처리량. 각 구현의 실제 처리량을 비교했습니다.',
  memoryCondition: '공통 초당 20,000 요청. 런타임과 워커를 포함한 cgroup memory.current 관측값입니다.',
  cta: '측정 조건과 전체 결과 보기', csv: '측정 데이터 CSV',
  reportIntro: '같은 자원에서 확인한 높은 HTTP 처리량과 낮은 메모리 사용량. Web Frameworks Benchmark의 공개 측정 방식을 참고해 Spine 프로젝트가 자체 측정했습니다.',
  findingsTitle: '비교 결과', findings: '처리량은 포화 부하, 지연과 메모리는 공통 초당 2만 요청 조건에서 각각 비교합니다. 값은 독립 서버 시작 3회의 중앙값입니다.',
  throughputTable: '포화 부하 · 동시 연결 256', commonTable: '공통 부하 · 초당 20,000 요청',
  highTable: '고정 목표 부하에서의 응답 지연',
  highIntro: '초당 118,000건을 목표로 요청을 보내 두 구현의 응답 지연을 비교했습니다.',
  highRps: '실제 완료 처리율 (req/s)',
  highRateNote: '완료 처리율은 성공 응답 수를 실행별 기록 시간으로 나눈 값입니다. 기록 시간은 실행마다 달라질 수 있으며, 각 열은 독립 실행 3회의 지표별 중앙값입니다. 완료 처리율은 요청 손실률을 뜻하지 않습니다.',
  highSuccessNote: '두 구현 모두 세 실행에서 기록된 요청은 전부 HTTP 2xx 응답이었고, 요청 오류와 타임아웃은 0건이었습니다.',
  highAccountingNote: '표의 완료 처리율 중앙값에 해당하는 3회차에서 Spine은 1,768,230건을 15.142초에, Spring MVC는 1,759,690건을 15.001초에 집계했습니다. 성공 응답 수가 더 많아도 집계 시간이 길면 초당 값은 낮게 나타날 수 있습니다.', framework: '구성', rps: '처리량 (req/s)',
  mean: '평균 (ms)', p95: 'p95 (ms)', p99: 'p99 (ms)', memoryColumn: '관측 메모리 (MiB)', range: '관측 범위',
  latencyNote: '공통 초당 2만 요청에서 Spine의 평균 응답 시간은 0.169ms, p95는 0.399ms, p99는 1.062ms였습니다.',
  highNote: '11.8만 요청 조건은 Spring MVC의 포화 처리량에 가깝습니다. p99 관측 범위는 Spine 2.707–2.931ms, Spring MVC 10.724–206.784ms였습니다. Spring MVC의 3회 중 1회는 목표 요청률의 98%에 미달했으며 해당 표본을 보존했습니다.',
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
  selectionTitle: '대표 비교 구성을 고른 이유',
  selection: [
    ['NestJS / ExpressAdapter', '어댑터를 생략할 때 사용하는 기본 ExpressAdapter 구성과 npm 패키지 다운로드 규모를 참고했습니다. 2026-10-01~30의 @nestjs/platform-express 다운로드는 44,534,475회, @nestjs/platform-fastify는 7,725,701회였습니다. 다운로드 수는 패키지 사용 규모의 참고 지표이며 사용자 점유율은 아닙니다.'],
    ['Spring MVC', 'State of Spring 2024 조사에서 응답자 1,464명의 70%가 WebMVC를 사용한다고 답한 점을 참고했습니다. 복수응답 설문 결과이며, 측정에는 Tomcat과 가상 스레드를 사용했습니다.'],
    ['FastAPI / Uvicorn', '공식 fastapi run 명령의 기본 ASGI 서버인 Uvicorn을 선택했습니다. 워커 3개와 uvloop, httptools를 사용했습니다.']
  ],
  evidenceTitle: '공개 데이터와 검증',
  evidence: '본측정 30개, HTTP 계약 검사 168개, HDR 히스토그램 30개를 검증했습니다. 요청 오류와 Docker OOMKilled 표시는 없었습니다. ZIP에는 앱 소스, 측정 코드, 원본 zrk JSON과 히스토그램을 담았습니다.',
  evidenceLink: '소스·전체 표본·원시 히스토그램 ZIP', jsonLink: '집계 JSON', checksumLink: 'SHA-256',
  sourcesTitle: '선정·측정 기준의 출처', back: '메인 화면으로'
}

const en: typeof ko = {
  path: 'en', badge: 'Spine internal lab',
  title: ["More requests.", "Less memory."],
  intro: "We compared NestJS/Express, Spring MVC and FastAPI/Uvicorn with the same allocation of 3 vCPU and 3 GiB of memory.",
  throughputStat: 'HTTP throughput', throughputContext: "Saturated load, median of 3 starts",
  memoryStat: 'Observed memory', memoryContext: "Whole container at 20k req/s",
  latencyStat: 'p99 response latency', latencyContext: "Median p99 at 20k req/s",
  throughput: 'Throughput', memory: 'Memory', chartLabel: 'Comparison metric',
  throughputTitle: 'Requests served within the same CPU budget', memoryTitle: 'Memory observed at the same request rate',
  throughputDirection: 'Higher is better', memoryDirection: 'Lower is better',
  throughputCapacity: 'With Spine, you could have handled about {value} more users’ worth of requests.',
  capacityAssumption: 'If each user sends one request per second',
  capacityNote: 'An illustrative conversion of the throughput difference at one request per user per second. Actual user capacity depends on request frequency and application workload.', memoryRatio: '{value}% less memory with Spine', baseline: 'Spine',
  throughputCondition: 'Saturated throughput at 256 connections. Each implementation runs at its own achieved request rate.',
  memoryCondition: 'A common 20,000 req/s load. cgroup memory.current includes the runtime and workers.',
  cta: 'Read the method and full results', csv: 'Measurement CSV',
  reportIntro: 'Higher HTTP throughput and lower observed memory within the same resource budget. Measured by the Spine project using public methodology from Web Frameworks Benchmark.',
  findingsTitle: 'Comparison results', findings: 'Throughput is compared under saturated load; latency and memory are compared at a common 20,000 req/s. Values are medians across three fresh server starts.',
  throughputTable: 'Saturated load · 256 connections', commonTable: 'Common load · 20,000 req/s',
  highTable: 'Latency at a fixed target rate',
  highIntro: 'Requests were scheduled at a target of 118,000 per second to compare response latency.',
  highRps: 'Actual completion rate (req/s)',
  highRateNote: 'Completion rate is successful responses divided by the recorded elapsed time for each run. Elapsed times can vary between runs. Each column reports its own median across three independent starts. Completion rate is not a request-loss rate.',
  highSuccessNote: 'For both implementations, every recorded request returned HTTP 2xx; request errors and timeouts were zero across all three runs.',
  highAccountingNote: 'In the third run, which supplies the median completion rate for both implementations, Spine recorded 1,768,230 successful responses over 15.142s and Spring MVC 1,759,690 over 15.001s. A longer reporting interval can yield a lower per-second rate despite more successful responses.', framework: 'Configuration', rps: 'Throughput (req/s)',
  mean: 'Mean (ms)', p95: 'p95 (ms)', p99: 'p99 (ms)', memoryColumn: 'Observed memory (MiB)', range: 'Observed range',
  latencyNote: 'At a common 20,000 req/s, Spine recorded a mean response time of 0.169ms, p95 of 0.399ms and p99 of 1.062ms.',
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
  selectionTitle: 'Why these configurations',
  selection: [
    ['NestJS / ExpressAdapter', 'Selected the default ExpressAdapter configuration using npm package downloads as a reference for its adoption. From 2026-10-01 to 2026-10-30, @nestjs/platform-express recorded 44,534,475 downloads and @nestjs/platform-fastify recorded 7,725,701. Downloads indicate package activity, not user market share.'],
    ['Spring MVC', 'In State of Spring 2024, 70% of 1,464 respondents reported using WebMVC. This multiple-choice survey informed the selection. The measured configuration uses Tomcat and virtual threads.'],
    ['FastAPI / Uvicorn', 'Uvicorn is the default ASGI server behind the official fastapi run command. The measured configuration uses three workers, uvloop and httptools.']
  ],
  evidenceTitle: 'Data and verification',
  evidence: 'Verified 30 primary samples, 168 HTTP contract fixtures and 30 HDR histograms. No request errors or Docker OOMKilled flags were recorded. The ZIP contains application and measurement sources, original zrk JSON and histograms.',
  evidenceLink: 'Sources, all samples and raw histograms ZIP', jsonLink: 'Aggregate JSON', checksumLink: 'SHA-256',
  sourcesTitle: 'Methodology and selection sources', back: 'Back to home'
}

const ja: typeof ko = {
  ...en, path: 'ja', badge: 'Spine 内部ラボテスト',
  title: ["処理量は多く。", "メモリは少なく。"],
  intro: "NestJS/Express、Spring MVC、FastAPI/Uvicornに同じ3 vCPUと3GiBのメモリを割り当てて比較しました。",
  throughputStat: 'HTTP処理量', throughputContext: "飽和負荷で3回測定した中央値",
  memoryStat: '観測メモリ', memoryContext: "毎秒2万リクエスト時の使用量",
  latencyStat: 'p99応答時間', latencyContext: "毎秒2万リクエスト時の応答時間",
  throughput: '処理量', memory: 'メモリ', chartLabel: '比較する指標',
  throughputTitle: '同じCPU制約で処理したリクエスト数', memoryTitle: '同じリクエストレートで観測したメモリ',
  throughputDirection: '大きいほど良い', memoryDirection: '小さいほど良い',
  throughputCapacity: 'Spineなら、約{value}人分のリクエストをさらに処理できた計算です。',
  capacityAssumption: '1人が毎秒1回リクエストを送ると仮定すると',
  capacityNote: '毎秒の処理量の差を1人あたり毎秒1回のリクエストで換算した例です。実際に対応できる人数はリクエスト頻度やアプリの処理によって変わります。', memoryRatio: 'Spineのメモリは{value}%少ない',
  throughputCondition: '同時接続256での飽和処理量です。各構成の実際の処理量を比較しています。',
  memoryCondition: '共通の毎秒20,000リクエスト。ランタイムとワーカーを含むcgroup memory.currentの観測値です。',
  cta: '測定条件と全結果を見る', csv: '測定データCSV',
  reportIntro: '同じリソース制約で確認した高いHTTP処理量と低いメモリ使用量。Web Frameworks Benchmarkの公開手法を参考にSpineプロジェクトが自己測定しました。',
  findingsTitle: '比較結果', findings: '処理量は飽和負荷、応答時間とメモリは共通の毎秒20,000リクエストで比較します。各値は新規サーバー起動3回の中央値です。',
  throughputTable: '飽和負荷 · 同時接続256', commonTable: '共通負荷 · 毎秒20,000リクエスト', highTable: '固定目標レートでの応答時間',
  highIntro: '毎秒118,000リクエストを目標に送信し、2構成の応答時間を比較しました。',
  highRps: '完了リクエスト数 (req/s)',
  highRateNote: '完了レートは、各実行の成功応答数を記録された経過時間で割った値です。経過時間は実行ごとに異なる場合があります。各列は独立したサーバー起動3回の指標ごとの中央値です。完了レートはリクエストの損失率を示す値ではありません。',
  highSuccessNote: '両構成とも3回の実行で記録されたリクエストはすべてHTTP 2xxで完了し、リクエストエラーとタイムアウトは0件でした。',
  highAccountingNote: '両構成の完了レートの中央値となる3回目では、Spineは15.142秒で1,768,230件、Spring MVCは15.001秒で1,759,690件の成功応答を記録しました。集計時間が長いと、成功応答数が多くても毎秒の値は小さくなる場合があります。',
  framework: '構成', rps: '処理量 (req/s)', mean: '平均 (ms)', memoryColumn: '観測メモリ (MiB)', range: '観測範囲',
  latencyNote: '共通の毎秒20,000リクエストで、Spineの平均応答時間は0.169ms、p95は0.399ms、p99は1.062msでした。',
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
  selectionTitle: '比較構成の選定理由',
  selection: [
    ['NestJS / ExpressAdapter', '省略時のデフォルトであるExpressAdapter構成とnpmダウンロード規模を参考に選びました。2026-10-01〜30の@nestjs/platform-expressは44,534,475回、@nestjs/platform-fastifyは7,725,701回でした。ダウンロード数はパッケージの利用規模を示す参考値で、利用者シェアではありません。'],
    ['Spring MVC', 'State of Spring 2024で1,464人の70%がWebMVCを使用すると回答した点を参考に選びました。複数回答の調査です。測定にはTomcatと仮想スレッドを使用しました。'],
    ['FastAPI / Uvicorn', '公式fastapi runのデフォルトASGIサーバーであるUvicornを選びました。3ワーカー、uvloop、httptoolsを使用しました。']
  ],
  evidenceTitle: '公開データと検証', evidence: '本測定30標本、HTTP契約168件、HDRヒストグラム30件を検証しました。リクエストエラーとDocker OOMKilled表示はありません。ZIPにはアプリと測定のソースコード、元のzrk JSONとヒストグラムを収録しています。',
  evidenceLink: 'ソース・全標本・ヒストグラムZIP', jsonLink: '集計JSON', sourcesTitle: '選定・測定方法の出典', back: 'ホームへ'
}

const zhHans: typeof ko = {
  ...en, path: 'zh-Hans', badge: 'Spine 内部实验室测试',
  title: ["处理更多请求。", "使用更少内存。"],
  intro: "为NestJS/Express、Spring MVC和FastAPI/Uvicorn分配相同的3 vCPU与3GiB内存进行比较。",
  throughputStat: 'HTTP吞吐量', throughputContext: "饱和负载下3次启动的中位数", memoryStat: '观测内存', memoryContext: "每秒2万请求时的容器用量",
  latencyStat: 'p99响应延迟', latencyContext: "每秒2万请求时的p99延迟",
  throughput: '吞吐量', memory: '内存', chartLabel: '比较指标', throughputTitle: '相同CPU预算下处理的请求数', memoryTitle: '相同请求速率下观测的内存',
  throughputDirection: '越高越好', memoryDirection: '越低越好', throughputCapacity: '如果使用Spine，相当于可以多处理约{value}名用户的请求。',
  capacityAssumption: '假设每位用户每秒发送一次请求',
  capacityNote: '按每位用户每秒一次请求，将每秒吞吐量差值换算为示例人数。实际承载人数取决于请求频率和应用工作负载。', memoryRatio: 'Spine内存少{value}%',
  throughputCondition: '256个并发连接下的饱和吞吐量，各配置处理的实际请求速率不同。', memoryCondition: '统一每秒20,000请求，cgroup memory.current包含运行时与工作进程。',
  cta: '查看测量条件与完整结果', csv: '测量数据CSV', reportIntro: '在相同资源预算下观测到更高HTTP吞吐量和更低内存占用。由Spine项目参考Web Frameworks Benchmark公开方法自行测量。',
  findingsTitle: '比较结果', findings: '吞吐量在饱和负载下比较，延迟与内存在统一每秒20,000请求下比较。数值为3次独立服务器启动的中位数。',
  throughputTable: '饱和负载 · 256并发连接', commonTable: '统一负载 · 每秒20,000请求', highTable: '固定目标负载下的响应延迟',
  highIntro: '以每秒118,000次请求为目标发送负载，比较两种配置的响应延迟。',
  highRps: '实际完成速率 (req/s)',
  highRateNote: '完成速率为每次运行的成功响应数除以记录的耗时。不同运行的耗时可能不同，各列分别取3次独立服务器启动的中位数。完成速率不等于请求丢失率。',
  highSuccessNote: '两种配置3次运行中记录的请求均返回HTTP 2xx，请求错误和超时均为0。',
  highAccountingNote: '两种配置完成速率的中位数均来自第3次运行：Spine在15.142秒记录1,768,230次成功响应，Spring MVC在15.001秒记录1,759,690次。统计时长较长时，即使成功响应更多，每秒速率也可能较低。', framework: '配置', rps: '吞吐量 (req/s)', mean: '平均 (ms)', memoryColumn: '观测内存 (MiB)', range: '观测范围',
  latencyNote: '统一每秒20,000请求时，Spine平均响应时间为0.169ms，p95为0.399ms，p99为1.062ms。',
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
  ],
  selectionTitle: '代表配置的选择理由', selection: [
    ['NestJS / ExpressAdapter', '参考默认ExpressAdapter配置与npm包下载规模进行选择。2026-10-01至30日，@nestjs/platform-express下载44,534,475次，@nestjs/platform-fastify下载7,725,701次。下载量是包使用规模的参考指标，不等于用户份额。'],
    ['Spring MVC', '参考State of Spring 2024多选调查：1,464位受访者中70%报告使用WebMVC。测量使用Tomcat和虚拟线程。'],
    ['FastAPI / Uvicorn', '选择官方fastapi run默认使用的ASGI服务器Uvicorn，配置3个worker、uvloop与httptools。']
  ], evidenceTitle: '公开数据与验证', evidence: '验证了30个正式样本、168项HTTP契约及30个HDR直方图。未记录请求错误或Docker OOMKilled标记。ZIP包含应用与测量源码、原始zrk JSON和直方图。',
  evidenceLink: '源码、完整样本与原始直方图ZIP', jsonLink: '汇总JSON', sourcesTitle: '方法与配置选择来源', back: '返回首页'
}

const zhHant: typeof ko = {
  ...zhHans, path: 'zh-Hant', badge: 'Spine 內部實驗室測試', title: ["處理更多請求。", "使用更少記憶體。"],
  intro: "為NestJS/Express、Spring MVC和FastAPI/Uvicorn分配相同的3 vCPU與3GiB記憶體進行比較。",
  throughputStat: 'HTTP吞吐量', throughputContext: "飽和負載下3次啟動的中位數", memoryStat: '觀測記憶體', memoryContext: "每秒2萬請求時的容器用量", latencyStat: 'p99回應延遲', latencyContext: "每秒2萬請求時的p99延遲",
  throughput: '吞吐量', memory: '記憶體', chartLabel: '比較指標', throughputTitle: '相同CPU預算下處理的請求數', memoryTitle: '相同請求速率下觀測的記憶體', throughputDirection: '越高越好', memoryDirection: '越低越好',
  throughputCapacity: '如果使用Spine，相當於可以多處理約{value}名使用者的請求。',
  capacityAssumption: '假設每位使用者每秒傳送一次請求',
  capacityNote: '按每位使用者每秒一次請求，將每秒吞吐量差值換算為示例人數。實際承載人數取決於請求頻率和應用工作負載。', memoryRatio: 'Spine記憶體少{value}%', throughputCondition: '256個並行連線下的飽和吞吐量，各組態處理的實際請求速率不同。', memoryCondition: '統一每秒20,000請求，cgroup memory.current包含執行階段與工作行程。',
  cta: '查看量測條件與完整結果', csv: '量測資料CSV',
  reportIntro: '在相同資源預算下觀測到更高HTTP吞吐量和更低記憶體用量。由Spine專案參考Web Frameworks Benchmark公開方法自行量測。', findingsTitle: '比較結果', findings: '吞吐量在飽和負載下比較，延遲與記憶體在統一每秒20,000請求下比較。數值為3次獨立伺服器啟動的中位數。',
  throughputTable: '飽和負載 · 256並行連線', commonTable: '統一負載 · 每秒20,000請求', highTable: '固定目標負載下的回應延遲',
  highIntro: '以每秒118,000次請求為目標傳送負載，比較兩種組態的回應延遲。',
  highRps: '實際完成速率 (req/s)',
  highRateNote: '完成速率為每次執行的成功回應數除以記錄的經過時間。不同執行的經過時間可能不同，各欄分別取3次獨立伺服器啟動的中位數。完成速率不等於請求遺失率。',
  highSuccessNote: '兩種組態3次執行中記錄的請求均回傳HTTP 2xx，請求錯誤與逾時均為0。',
  highAccountingNote: '兩種組態完成速率的中位數均來自第3次執行：Spine在15.142秒記錄1,768,230次成功回應，Spring MVC在15.001秒記錄1,759,690次。統計時長較長時，即使成功回應更多，每秒速率也可能較低。', framework: '組態', mean: '平均 (ms)', memoryColumn: '觀測記憶體 (MiB)', range: '觀測範圍',
  latencyNote: '統一每秒20,000請求時，Spine平均回應時間為0.169ms，p95為0.399ms，p99為1.062ms。', highNote: '每秒118,000請求接近Spring MVC的飽和吞吐量。p99範圍：Spine 2.707–2.931ms，Spring MVC 10.724–206.784ms。Spring MVC的3個樣本中1個未達目標速率98%，該樣本未被剔除。',
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
  ],
  selectionTitle: '代表組態的選擇理由', selection: [
    ['NestJS / ExpressAdapter', '參考預設ExpressAdapter組態與npm套件下載規模進行選擇。2026-10-01至30日，@nestjs/platform-express下載44,534,475次，@nestjs/platform-fastify下載7,725,701次。下載量是套件使用規模的參考指標，不等於使用者占比。'],
    ['Spring MVC', '參考State of Spring 2024複選調查：1,464位受訪者中70%回報使用WebMVC。量測使用Tomcat和虛擬執行緒。'],
    ['FastAPI / Uvicorn', '選擇官方fastapi run預設使用的ASGI伺服器Uvicorn，組態為3個worker、uvloop與httptools。']
  ], evidenceTitle: '公開資料與驗證', evidence: '驗證了30個正式樣本、168項HTTP契約及30個HDR直方圖。未記錄請求錯誤或Docker OOMKilled標記。ZIP包含應用與量測原始碼、原始zrk JSON和直方圖。', evidenceLink: '原始碼、完整樣本與原始直方圖ZIP', jsonLink: '彙整JSON', sourcesTitle: '方法與組態選擇來源', back: '返回首頁'
}

export function benchmarkCopy(lang: string): typeof ko {
  if (lang === 'ko') return ko
  if (lang === 'ja') return ja
  if (lang === 'zh-Hant' || lang === 'zh-TW') return zhHant
  if (lang === 'zh-Hans' || lang === 'zh-CN') return zhHans
  return en
}
