"""검증된 내부 랩 기록에서 홈페이지에 공개할 자료만 추출합니다."""
import csv
import hashlib
import io
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / 'benchmark-materials/spine-wfb-preparation/comparison-gogc400-20261101/results/20261101-123011'
OUT = ROOT / 'docs/public/benchmarks/internal-lab-20261101'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    analysis = json.loads((RUN / 'analysis.json').read_text())
    manifest = json.loads((RUN / 'manifest.json').read_text())
    assert manifest['state'] == 'completed' and len(analysis['rows']) == 30
    assert analysis['verification']['primary_errors'] == 0
    for relative, expected in json.loads((RUN / 'SHA256.json').read_text()).items():
        assert digest((RUN / relative).read_bytes()) == expected, relative
    OUT.mkdir(parents=True, exist_ok=True)
    metrics = ['rps', 'mean_ms', 'p50_ms', 'p95_ms', 'p99_ms', 'memory_current_median_mib',
               'server_cpu_fraction', 'cgroup_lifetime_memory_peak_mib', 'max_schedule_lag_ms']
    summary = []
    for row in analysis['summary']:
        item = {k: row[k] for k in ['case', 'mode', 'n', 'rate_misses']}
        for metric in metrics:
            for suffix in ['', '_min', '_max']:
                item[metric + suffix] = row[metric + suffix]
        summary.append(item)
    snapshot = {
        'runId': manifest['run_id'], 'measuredAt': '2026-11-01', 'spineVersion': '0.5.2',
        'environment': {'architecture': 'Linux/arm64', 'hostCores': 14, 'performanceCores': 10,
            'efficiencyCores': 4, 'referenceClockGHz': 4.5, 'clockMeasuredDuringTest': False,
            'hostMemoryGB': 24, 'serverVcpus': 3, 'serverMemoryGiB': 3, 'loadCores': 9,
            'loadMemoryGiB': 1, 'connections': 256, 'durationSeconds': 15,
            'independentStarts': 3, 'sampleCount': 30, 'requestBytes': 43, 'gogc': 400,
            'gomaxprocs': 3, 'gomemlimit': '2700MiB', 'commonRate': 20000, 'highRate': 118000},
        'versions': {'spine': '0.5.2 · Echo 4.15.0 · Go 1.27.3',
            'nest': 'NestJS 12.3.2 · Express 5.3.0 · Node.js 26.13.0 · 3 workers',
            'spring-mvc': 'Spring Boot 4.1.2 · Java 25.0.5 · Tomcat · virtual threads',
            'fastapi': 'FastAPI 0.162.0 · Uvicorn 0.54.0 · Python 3.15.2 · uvloop · httptools · 3 workers'},
        'verification': {'primaryErrors': 0, 'httpFixturesPassed': 168, 'warmupFailures': 0,
            'histogramsChecked': 30, 'dockerOomKilled': 0,
            'rateMisses': [{'case': r['case'], 'round': r['round'], 'targetRate': r['target_rps']}
                for r in analysis['rows'] if r['target_below_98_percent']]},
        'summary': summary,
        'provenance': {'analysisSha256': digest((RUN / 'analysis.json').read_bytes()),
            'manifestSha256': digest((RUN / 'manifest.json').read_bytes()),
            'memoryMetric': 'cgroup memory.current, sampled once per second; median per window, then median across three starts',
            'percentiles': 'Median of per-window percentiles across three independent starts; p95 decoded from raw HDR histogram',
            'wfb': 'Methodology reference; independently measured by the Spine project, not an official WFB result'},
    }
    json_data = (json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n').encode()
    (OUT / 'summary.json').write_bytes(json_data)
    fields = ['case', 'round', 'mode', 'target_rps', 'requests', *metrics, 'errors', 'rate_ratio', 'target_below_98_percent']
    buffer = io.StringIO(newline='')
    writer = csv.DictWriter(buffer, fieldnames=fields, extrasaction='ignore')
    writer.writeheader()
    writer.writerows(analysis['rows'])
    csv_data = buffer.getvalue().encode()
    (OUT / 'measurements.csv').write_bytes(csv_data)
    entries = {'summary.json': json_data, 'measurements.csv': csv_data}
    for row in analysis['rows']:
        raw = RUN / row['raw']
        entries['raw/' + raw.name] = raw.read_bytes()
    # 공개 대상은 측정 앱과 관측 코드의 스냅샷으로 제한합니다.
    # 인증·클라우드 운영 파일을 원본 디렉터리에서 일괄 복사하지 않습니다.
    for relative in manifest['source_hashes']:
        source = RUN / 'sources' / relative
        assert digest(source.read_bytes()) == manifest['source_hashes'][relative]
        entries['sources/' + relative] = source.read_bytes()
    entries['sources/analyze.py'] = (RUN / 'sources/analyze.py').read_bytes()
    entries['README.md'] = (
        '# Spine internal lab evidence — 2026-11-01\n\n'
        'Independently measured by the Spine project. WFB is a methodology reference, not a verifier of this run.\n\n'
        'summary.json contains aggregate measurements. measurements.csv contains all 30 primary samples. '
        'raw/ contains the original zrk JSON reports, including HDR histograms. '
        'sources/ contains the measured application, dependency and observation-code snapshots.\n\n'
        'Server budget: 3 vCPU / 3 GiB. HTTP/1.1 keep-alive, 256 connections, 43-byte JSON input. '
        'Three fresh starts per implementation; 15-second primary windows after stability-based warmup. '
        'Spine uses GOGC=400, GOMAXPROCS=3 and GOMEMLIMIT=2700MiB.\n\n'
        'Application snapshots include their Dockerfiles and dependency locks. '
        'The archived observation scripts retain the original relative preparation-directory structure; '
        'they are audit inputs, not a standalone one-command runner. Adapt those paths and build image IDs before rerunning.\n\n'
        'No cloud credentials, upload sessions, provider records or private host identifiers are included.\n'
    ).encode()
    entries['checksums.json'] = (json.dumps({name: digest(value) for name, value in entries.items()}, indent=2) + '\n').encode()
    bundle = OUT / 'evidence.zip'
    with zipfile.ZipFile(bundle, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, value in sorted(entries.items()):
            info = zipfile.ZipInfo(name, date_time=(2026, 11, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, value)
    with zipfile.ZipFile(bundle) as archive:
        assert archive.testzip() is None
        for name, value in entries.items():
            assert archive.read(name) == value
    public_hashes = {name: digest((OUT / name).read_bytes()) for name in ['summary.json', 'measurements.csv', 'evidence.zip']}
    (OUT / 'checksums.json').write_text(json.dumps(public_hashes, indent=2) + '\n')
    print(json.dumps({'samples': len(analysis['rows']), 'bundle_entries': len(entries),
        'bundle_bytes': bundle.stat().st_size, 'original_hashes_verified': 296}))


if __name__ == '__main__':
    main()
