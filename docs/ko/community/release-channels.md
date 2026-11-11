# 릴리스 채널과 설치

현재 API 사용법은 [0.7.5 전환 안내](/ko/learn/migration/v0.7.5)에서 확인하세요. 아래 발행 정보와 과거 릴리스 기록은 각 태그 기준입니다.

Spine과 CLI는 Preview, RC, 정식(Production) 순서로 릴리스합니다. 새 기능을 먼저 확인할지, 출시 후보를 검증할지, 정식 버전을 사용할지에 따라 CLI 설치 채널을 고르면 됩니다.

이 페이지는 Spine과 CLI가 배포되는 절차를 설명합니다. 애플리케이션의 개발, 스테이징, 운영 환경 설정은 앱에서 별도로 관리합니다.

## 채널 선택 {#choose}

| 채널 | 사용할 때 | CLI 설치 대상 |
| --- | --- | --- |
| Preview | 개발 중인 변경과 새 API를 먼저 확인 | `@preview` 브랜치 |
| RC | Preview에서 승격한 출시 후보를 검증 | `@rc` 브랜치 또는 발행된 RC 태그 |
| 정식(Production) | 일반 개발과 운영의 기준 버전 사용 | `@latest` 또는 발행된 정식 태그 |

`@preview`와 `@rc`는 각각 이름이 같은 브랜치의 최신 커밋을 선택합니다. 해당 커밋에 버전 태그가 있으면 그 버전으로, 없으면 커밋을 식별하는 pseudo-version으로 해석될 수 있습니다. `@latest`는 정식 버전을 우선합니다. [Go 버전 선택 규칙](https://go.dev/ref/mod#version-queries)

## 채널별 CLI 설치 {#install}

아래에서 필요한 채널 하나를 선택하세요. 같은 설치 경로에 다시 설치하면 기존 `spine` 실행 파일을 교체합니다. 여러 채널을 동시에 사용하려면 `GOBIN`을 서로 다른 디렉터리로 지정합니다. Go와 PATH 준비는 [설치 안내](/ko/learn/getting-started/installation)를 참고하세요.

### 정식 {#stable}

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
```

일반적인 시작 경로입니다. 실제 설치 버전은 `spine version`으로 확인합니다. `@main`은 main 브랜치의 코드를 선택하므로 정식 릴리스 설치의 `@latest`와 구분합니다.

### Preview {#preview}

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@preview
spine version
```

Preview 브랜치에 병합된 변경을 확인할 수 있습니다. 발행된 Preview 태그 사이의 변경도 포함할 수 있으므로, 검증을 마친 특정 후보를 재현할 때는 해당 태그를 지정하세요.

### RC {#rc}

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@rc
spine version
```

RC 브랜치의 현재 코드를 설치합니다. Preview 변경은 승격된 뒤에 포함됩니다. 승격 전에는 이전 기능과 레시피가 남아 있을 수 있습니다. 브랜치가 존재한다는 사실만으로 공식 RC가 발행됐다고 판단하지 마세요. 검증된 후보를 재현하려면 실제로 발행된 `vX.Y.Z-rc.N` 태그와 검증 기록을 확인합니다.

## CLI 채널과 앱 의존성 {#dependencies}

CLI 설치 버전과 앱 의존성 채널은 별도입니다. CLI `v0.4.3`부터 새 프로젝트의 기본 채널은 대화형 생성에서도 `main`입니다. `rc`는 RC 또는 더 높은 정식 태그를 선택하고, `preview`는 Preview 브랜치를 조회합니다. 기존 프로젝트의 채널은 자동 변경되지 않습니다.

```bash
spine new channel-check --module example.com/channel-check --channel main
cd channel-check
go list -m github.com/NARUBROWN/spine
```

선택한 채널은 `spine.toml`의 `dependency_channel`에 기록되며 `spine update`가 유지합니다. 설치된 CLI를 갱신해도 기존 프로젝트는 바뀌지 않습니다. 생성 후 `go.mod`와 `go.sum`을 확인하고 버전 관리하세요.

## 릴리스가 발행되는 순서 {#process}

**Preview → RC → Production** 순서로 검증한 후보를 승격합니다. 브랜치 병합과 태그 발행은 별도 단계입니다.

1. 변경을 Preview에 병합하고 소스 CI를 통과시킵니다.
2. 발행할 소스와 의존성 조합을 정하고, 해당 소스의 테스트와 공개 소비자 검사를 실행합니다. CLI는 Linux, macOS, Windows의 공개 설치도 확인합니다.
3. 유지관리자가 계획과 검증 결과를 검토하고 승인하면 새 태그를 발행합니다.
4. 발행된 태그로 다시 설치해 검사하고, 성공한 결과를 release manifest로 남깁니다.
5. 관찰 기간과 승격 검사를 통과한 후보를 RC, 이후 main으로 승격합니다. 승격에 필요한 채널별 버전 핀 전환은 정책에 따라 검사하며, 그 밖의 코드나 의존성 조합을 바꾸면 새 Preview에서 다시 검증합니다.
6. 정식 태그의 공개 검증까지 성공하면 GitHub Release를 발행합니다. 코어는 여섯 플랫폼을 포함한 전체 조합 검증도 완료해야 합니다.

Spine 코어와 플랫폼은 **코어 후보 발행 → 여섯 플랫폼 발행 → 전체 조합 검증 완료** 순서로 진행합니다. 코어 태그 하나만 발행됐다는 사실과 전체 플랫폼 조합의 승격 준비가 끝났다는 사실을 구분합니다.

CLI는 코어와 별도의 버전과 일정으로 릴리스합니다. 코어 버전이 바뀔 때마다 CLI 버전도 같아지는 구조는 아닙니다. 새 앱을 생성하거나 업데이트할 때 선택된 조합을 확인하세요.

## 관찰 기간 {#observation}

| 기준 | 현재 정책 | 시작 시점 또는 범위 |
| --- | --- | --- |
| Preview에서 RC | 최소 72시간 | Preview 공개 검증 완료 manifest 생성 후 |
| RC에서 정식 | 최소 24시간 | RC 공개 검증 완료 manifest 생성 후 |
| 정식 출시 추가 간격 | 코어 168시간, CLI 0시간 | 각 저장소의 이전 정식 출시 기준 |

시간이 지나면 자동으로 다음 버전이 배포되는 일정이 아닙니다. 검증과 승인 조건을 함께 충족해야 합니다. 긴급히 관찰 기간을 단축할 때는 사유를 기록하며 테스트와 공개 검증, 승인은 생략하지 않습니다.

## 태그와 검증 기록 확인 {#evidence}

- Preview 태그는 `vX.Y.Z-preview.N`, RC 태그는 `vX.Y.Z-rc.N`, 정식 태그는 `vX.Y.Z` 형식입니다.
- Preview와 RC는 태그와 GitHub Actions의 `release-manifest-<tag>` artifact로 검증 결과를 남깁니다. GitHub Release 목록에 없더라도 후보 태그가 있을 수 있습니다.
- 정식은 GitHub Release에 검증 manifest를 첨부합니다. 코어는 전체 플랫폼 조합의 완료 기록을 확인합니다.
- 설치할 후보는 성공한 발행 실행, 태그와 일치하는 소스 및 의존성, 공개 설치 검증 결과를 함께 확인합니다.

태그와 현재 공개 버전은 [현재 릴리스](/ko/community/changelog)에서 확인하세요. 브랜치 설치 결과를 검증된 후보 태그의 발행 완료 증거로 사용하지 않습니다.

## 버전 고정과 되돌리기 {#pin}

CI와 운영 환경에서는 실제로 발행된 CLI 태그를 고정하고 앱 소스와 `go.mod`, `go.sum`도 함께 버전 관리합니다. CLI 태그는 도구의 코드만 고정합니다. Preview의 동적 레시피는 같은 CLI에서도 `new`나 `update`를 실행할 때 `@preview`를 다시 조회하므로, 앱을 재현할 때는 저장된 소스와 의존성을 사용하세요. 다음은 공개된 정식 CLI `v0.4.4`에 고정하는 예시이며 최신 버전 지정이 아닙니다.

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@v0.4.4
spine version
```

이전 CLI로 돌아가도 앱 소스와 `go.mod`, `go.sum`은 되돌아가지 않습니다. 앱은 프로젝트의 Git 이력으로 별도 복구합니다. 발행한 태그를 이동하거나 재사용하지 않고 수정한 후보는 새 번호로 발행합니다.

## 관련 문서 {#related}

- [첫 번째 앱](/ko/learn/getting-started/first-app)
- [Spine 릴리스 운영 절차](https://github.com/NARUBROWN/spine/blob/preview/RELEASING.md)
- [CLI 릴리스 운영 절차](https://github.com/NARUBROWN/spine-cli/blob/preview/release/README.md)
