# MY SCHEDULE

Editorial Brutalism 스타일의 개인 라이프 플래너입니다. 일정과 할 일, 습관을 관리하고 기록을 통계로 확인할 수 있습니다.

> 브랜드 UI에는 `MJ SCHEDULE`을 사용하고, 기준 문서와 JSON 백업 식별자에는 `MY SCHEDULE`을 사용합니다. 두 표기는 서로 다른 역할로 유지합니다.

## 주요 기능

- **오늘의 흐름(Overview):** 오늘의 목표와 일정, 주간 할 일 진행률, 습관 현황을 요약합니다. Quick Capture로 Inbox 메모를 저장하고 최근 항목을 확인할 수 있습니다.
- **Calendar:** 월간 Classic Grid와 주간 Editorial Timeline으로 일정과 할 일을 조회합니다. 데스크톱은 우측 상세 패널, 모바일은 Bottom Sheet를 사용하며 일정 관리 액션은 제공하지 않습니다.
- **To-do:** 할 일 등록·수정·삭제, 완료·실패 처리, 우선순위와 카테고리, 반복 회차를 관리합니다. Inbox 항목을 수정·삭제하거나 새 할 일로 전환할 수 있습니다.
- **Activity (일정 기록):** 일정 기록을 확인하고 복제·수정·삭제합니다. 현재 화면 데이터 원본은 `events`입니다.
- **Habits:** 습관 추적이 설정된 반복 할 일의 수행 기록과 예정 회차를 확인합니다. 예정 회차는 오늘부터 14일간 계산하며, 미래 To-do 데이터를 미리 생성하지 않습니다.
- **Statistics:** 7일·30일·12개월 범위로 할 일, 일정, 습관 기록을 시각화합니다.
- **Settings:** 할 일 카테고리와 기본값을 설정하고 JSON 백업을 내보내거나 가져옵니다.

## 기술 스택

- Vite
- Vanilla JavaScript (ES modules)
- SCSS
- Browser LocalStorage
- 영문·숫자 Space Grotesk, 한글 Paperlogy

새 프레임워크나 런타임 라이브러리 없이 기존 Vite, Vanilla JavaScript, SCSS 구조를 유지합니다.

## 요구 사항

- Node.js 20 이상
- npm

## 실행

```bash
npm install
npm run dev
```

개발 서버가 출력한 주소를 브라우저에서 엽니다.

## 빌드 및 테스트

```bash
npm run build
npm test
npm run preview
```

`npm test`는 Node 내장 테스트 러너로 핵심 저장소, 반복·습관, 통계 및 페이지 로직 테스트를 실행합니다.

## 저장 및 백업

- 일정, 할 일, Inbox, 습관 수행 기록, 카테고리 및 설정은 브라우저 LocalStorage에 저장됩니다. 같은 브라우저 프로필의 데이터이며 서버 계정 간 동기화는 제공하지 않습니다.
- Settings에서 모든 로컬 데이터를 JSON으로 내보내고 가져올 수 있습니다. 가져오기는 확인을 거쳐 현재 데이터를 백업 내용으로 교체합니다.
- 잘못된 저장 데이터는 자동으로 빈 데이터로 덮어쓰지 않습니다. 사용자가 유효한 백업으로 복구하거나 데이터를 초기화하기 전까지 일반 저장을 차단합니다.

## 페이지 경로

- `/overview`
- `/calendar`
- `/todo` (`#inbox` 해시로 Inbox 탭 진입)
- `/activity`
- `/habits`
- `/statistics`
- `/settings`

## 기준 문서

프로젝트 설계 및 작업 기준은 [`MY_SCHEDULE_PROJECT_BASELINE_v2.4.md`](./MY_SCHEDULE_PROJECT_BASELINE_v2.4.md)와 [`AGENTS.md`](./AGENTS.md)를 따릅니다.
