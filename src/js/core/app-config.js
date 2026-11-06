export const APP_CONFIG = {
  name: 'MJ SCHEDULE',
  tagline: '계획하고, 체크하고, 성장하는🌟',
  sidebarEyebrow: '나의 생활 플래너',
  version: '1.0.0',
  localStatusLabel: '로컬 저장 모드',
};

export const PAGE_CONFIG = {
  overview: {
    id: 'overview', number: '01', navLabel: '오늘의 흐름', navEnglish: 'OVERVIEW',
    kicker: 'PERSONAL DASHBOARD', eyebrow: '오늘의 흐름', title: '오늘의 흐름 살펴보기',
    description: '오늘의 계획과 진행 상황을 한눈에 확인해보자!',
  },
  calendar: {
    id: 'calendar', number: '02', navLabel: '달력', navEnglish: 'CALENDAR',
    kicker: 'MY CALENDAR', eyebrow: '하루를 계획해 보세요', title: 'CALENDAR',
  },
  activity: {
    id: 'activity', number: '03', navLabel: '일정 기록', navEnglish: 'SCHEDULE LOG',
    kicker: 'SCHEDULE LOG', eyebrow: '쌓여가는 나의 일정 기록', title: 'SCHEDULE LOG',
  },
  todo: {
    id: 'todo', number: '04', navLabel: '할 일', navEnglish: 'TO-DO',
    kicker: 'TASK MANAGEMENT', eyebrow: '하나씩 완료해 보세요', title: 'TO-DO',
  },
  habits: {
    id: 'habits', number: '05', navLabel: '습관', navEnglish: 'HABITS',
    kicker: 'HABIT TRACKING', eyebrow: '작은 반복이 쌓이는 기록', title: 'HABITS',
  },
  statistics: {
    id: 'statistics', number: '06', navLabel: '통계', navEnglish: 'STATISTICS',
    kicker: '내 일정', eyebrow: '나의 변화를 확인해 보세요', title: '통계',
  },
  settings: {
    id: 'settings', number: '07', navLabel: '설정', navEnglish: 'SETTINGS',
    kicker: 'PERSONAL PREFERENCES', eyebrow: '나에게 맞는 계획 환경', title: 'SETTINGS',
  },
};

export const MAIN_NAVIGATION = Object.values(PAGE_CONFIG)
  .filter(({ id }) => id !== 'settings');
