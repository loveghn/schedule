import { APP_CONFIG, MAIN_NAVIGATION, PAGE_CONFIG } from '../core/app-config.js';
import { renderBrand } from './page-header.js';

export function renderLayout() {
  const headerDate = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date()).toUpperCase();
  const links = MAIN_NAVIGATION.map(({ id, number, navLabel, navEnglish }) => `
    <a class="nav-link" href="/${id}" data-route="${id}">
      <span class="nav-link__number">${number}</span>
      <span class="nav-link__text">
        <span class="nav-link__label">${navLabel}</span>
        <span class="nav-link__english">${navEnglish}</span>
      </span>
      <span class="nav-link__arrow material-symbols-outlined" aria-hidden="true">north_east</span>
    </a>
  `).join('');

  return `
    <div class="app-shell">
      <aside class="sidebar" aria-label="주요 메뉴">

        <a
          class="brand"
          href="/overview"
          data-route="overview"
          aria-label="${APP_CONFIG.name} 홈"
        >
          ${renderBrand()}
        </a>

        <div class="sidebar__middle">
          <p class="eyebrow sidebar__eyebrow">
            ${APP_CONFIG.sidebarEyebrow}
          </p>

          <div class="sidebar__rule"></div>

          <p class="nav-heading">MENU / ${MAIN_NAVIGATION[0].number}—${MAIN_NAVIGATION.at(-1).number}</p>

          <nav class="main-nav" aria-label="페이지 메뉴">
            ${links}
          </nav>

          <div class="sidebar-plan-actions" aria-label="빠른 계획 추가">
            <button type="button" class="sidebar-plan-action" data-plan-create="event">
              <span class="material-symbols-outlined" aria-hidden="true">event</span>
              <span>일정 만들기</span>
            </button>
            <button type="button" class="sidebar-plan-action" data-plan-create="task">
              <span class="material-symbols-outlined" aria-hidden="true">check_circle</span>
              <span>할 일 만들기</span>
            </button>
          </div>
        </div>

        <div class="sidebar__bottom">
          <a class="settings-link" href="/${PAGE_CONFIG.settings.id}" data-route="${PAGE_CONFIG.settings.id}">
            <span>${PAGE_CONFIG.settings.navLabel}</span>
            <span class="material-symbols-outlined" aria-hidden="true">north_east</span>
          </a>

          <p class="sidebar__version">VERSION ${APP_CONFIG.version}</p>
        </div>

      </aside>

      <main class="main-shell">
        <header class="global-header">
          <div class="global-header__left">
            <button
              class="icon-button mobile-menu"
              type="button"
              data-mobile-menu
              aria-label="메뉴 열기"
            >
              <span class="material-symbols-outlined" aria-hidden="true">menu</span>
            </button>

            <span class="eyebrow">
              ${APP_CONFIG.name} / ${APP_CONFIG.tagline}
            </span>
          </div>

          <div class="global-header__right">
            <span class="header-date">${headerDate}</span>
            <span class="status-mark" aria-label="${APP_CONFIG.localStatusLabel}"></span>
          </div>
        </header>

        <section
          id="page-outlet"
          class="page-outlet"
          aria-live="polite"
        ></section>
      </main>
    </div>
  `;
}
