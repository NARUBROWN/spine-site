[English](README.md) | 한국어

# Spine 문서 사이트

[Spine 프레임워크](https://github.com/NARUBROWN/spine)와 [Spine CLI](https://github.com/NARUBROWN/spine-cli)의 다국어 문서 사이트입니다. VitePress를 사용하며 시작 가이드, 실행 계약, 플랫폼 연결과 마이그레이션을 다룹니다.

[문서 보기](https://spine.na2ru2.me/ko/)

## 로컬 개발

Node.js와 npm을 설치하고 저장소 루트에서 실행합니다.

```sh
npm ci
npm run docs:dev
```

## 빌드와 미리보기

```sh
npm run docs:build
npm run docs:preview
```

문서 원본은 `docs/`에 있으며 정적 빌드 결과는 `docs/.vitepress/dist`에 생성됩니다.
