#!/usr/bin/env python3
"""공개 태그와 발행 정책으로 사이트 버전 목록을 생성한다."""

import argparse
import base64
import concurrent.futures
import datetime as dt
import json
import os
from pathlib import Path
import re
import tempfile
import urllib.error
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs/.vitepress/theme/releases/catalog.json"
REPOSITORIES = (
    "spine", "spine-cli", "spine-echo-platform", "spine-gorilla-platform",
    "spine-kafka-platform", "spine-rabbitmq-platform", "spine-nats-platform",
    "spine-validator-playground",
)
NUMBER = r"(?:0|[1-9][0-9]*)"
TAG = re.compile(rf"v({NUMBER})\.({NUMBER})\.({NUMBER})(?:-(preview|rc)\.([1-9][0-9]*))?\Z")


def version_key(version):
    match = TAG.fullmatch(version)
    if not match:
        raise ValueError("지원하지 않는 버전 태그: " + version)
    major, minor, patch, channel, sequence = match.groups()
    return (int(major), int(minor), int(patch), {"preview": 0, "rc": 1, None: 2}[channel], int(sequence or 0))


def api(path):
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "spine-site-release-catalog"}
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request("https://api.github.com/repos/NARUBROWN/" + path, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"GitHub 조회 실패: HTTP {error.code}, {path}") from None


def collect(name):
    refs = api(name + "/git/matching-refs/tags/v")
    releases = []
    for page in range(1, 101):
        batch = api(f"{name}/releases?per_page=100&page={page}")
        releases.extend(batch)
        if len(batch) < 100:
            break
    else:
        raise RuntimeError("릴리스 조회 범위를 초과했다: " + name)
    published = {item["tag_name"]: item for item in releases if not item["draft"]}
    policy = api(name + "/contents/.github/release-policy.json?ref=preview")
    policy = json.loads(base64.b64decode(policy["content"]))
    target = policy["next_version"]
    if TAG.fullmatch(target) is None or TAG.fullmatch(target)[4] is not None:
        raise ValueError("정식 목표 버전 형식이 잘못됐다: " + name)
    base = "https://github.com/NARUBROWN/" + name
    tags = []
    for ref in refs:
        version = ref["ref"].removeprefix("refs/tags/")
        match = TAG.fullmatch(version)
        if match is None:
            continue
        release = published.get(version)
        manifest = next((asset["browser_download_url"] for asset in (release or {}).get("assets", [])
                         if asset["name"] == "release-manifest.json"), None)
        tags.append({
            "version": version, "channel": match[4] or "stable", "tag_url": base + "/tree/" + version,
            "published_at": release["published_at"] if release else None,
            "notes_url": base + "/releases/tag/" + version if release else None,
            "manifest_url": manifest,
        })
    tags.sort(key=lambda item: version_key(item["version"]), reverse=True)
    return {
        "name": name, "target_version": target,
        "policy_url": base + "/blob/preview/.github/release-policy.json",
        "tags_url": base + "/tags", "milestones_url": base + "/milestones",
        "actions_url": base + "/actions", "tags": tags,
    }


def validate(catalog):
    if catalog.get("schema_version") != "spine.site-releases/v1":
        raise ValueError("버전 목록 스키마가 잘못됐다")
    dt.datetime.fromisoformat(catalog["checked_at"].replace("Z", "+00:00"))
    if [repo["name"] for repo in catalog["repositories"]] != list(REPOSITORIES):
        raise ValueError("대상 저장소 8개와 순서를 확인해야 한다")
    for repo in catalog["repositories"]:
        version_key(repo["target_version"])
        for tag in repo["tags"]:
            version_key(tag["version"])
            if tag["channel"] != (TAG.fullmatch(tag["version"])[4] or "stable"):
                raise ValueError("태그와 채널이 일치하지 않는다")
            if tag["published_at"]:
                dt.datetime.fromisoformat(tag["published_at"].replace("Z", "+00:00"))
            for key in ("tag_url", "notes_url", "manifest_url"):
                if tag[key] and not tag[key].startswith("https://github.com/NARUBROWN/" + repo["name"] + "/"):
                    raise ValueError("공식 저장소 밖의 링크는 사용할 수 없다")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="네트워크 없이 저장된 목록을 검사한다")
    args = parser.parse_args()
    if args.check:
        validate(json.loads(OUTPUT.read_text()))
        print("버전 목록 검사 통과: 저장소 8개")
        return
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        repositories = list(pool.map(collect, REPOSITORIES))
    catalog = {"schema_version": "spine.site-releases/v1",
               "checked_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
               "repositories": repositories}
    validate(catalog)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    # 전부 조회하고 검사한 뒤 교체해 일부 실패가 기존 목록을 지우지 않게 한다.
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=OUTPUT.parent, delete=False) as file:
        json.dump(catalog, file, ensure_ascii=False, indent=2)
        file.write("\n")
        temporary = Path(file.name)
    temporary.replace(OUTPUT)
    print("버전 목록 갱신 완료: 저장소 8개")


if __name__ == "__main__":
    main()
