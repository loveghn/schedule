import '../styles/main.scss';

import { createRouter } from './core/router.js';
import { renderLayout } from './components/layout.js';
import { pages } from './pages/index.js';
import { getData, saveData } from './core/storage.js';
import { initTodoPage } from './pages/todo.js';
import { initCalendarPage } from './pages/calendar.js';
import { openEventModal } from './pages/plans.js';
import { openTaskModal } from './pages/todo.js';
import { initActivityPage } from './pages/activity.js';
import { initOverviewPage } from './pages/overview.js';
import { initHabitsPage } from './pages/habits.js';
import { initSettingsPage } from './pages/settings.js';
import { initStatisticsPage } from './pages/statistics.js';

const app = document.querySelector('#app');

app.innerHTML = renderLayout();

const sidebar = document.querySelector('.sidebar');
const menuButton = document.querySelector('[data-mobile-menu]');

// ========================================
// MOBILE MENU
// ========================================

const overlay = document.createElement('button');

overlay.type = 'button';
overlay.className = 'mobile-overlay';
overlay.setAttribute('aria-label', '메뉴 닫기');
overlay.setAttribute('aria-hidden', 'true');

app.append(overlay);

function isMobile() {
  return window.matchMedia('(max-width: 767px)').matches;
}

function openMobileMenu() {
  if (!isMobile()) return;

  sidebar?.classList.add('is-mobile-open');
  overlay.classList.add('is-visible');

  document.body.classList.add('is-menu-open');

  menuButton?.setAttribute('aria-expanded', 'true');
  overlay.setAttribute('aria-hidden', 'false');
}

function closeMobileMenu() {
  sidebar?.classList.remove('is-mobile-open');
  overlay.classList.remove('is-visible');

  document.body.classList.remove('is-menu-open');

  menuButton?.setAttribute('aria-expanded', 'false');
  overlay.setAttribute('aria-hidden', 'true');
}

menuButton?.setAttribute('aria-expanded', 'false');
menuButton?.setAttribute('aria-controls', 'main-sidebar');

sidebar?.setAttribute('id', 'main-sidebar');

menuButton?.addEventListener('click', () => {
  const isOpen = sidebar?.classList.contains('is-mobile-open');

  if (isOpen) {
    closeMobileMenu();
  } else {
    openMobileMenu();
  }
});

overlay.addEventListener('click', closeMobileMenu);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeMobileMenu();
  }
});

window.matchMedia('(min-width: 768px)').addEventListener('change', (event) => {
  if (event.matches) {
    closeMobileMenu();
  }
});

// ========================================
// ROUTER
// ========================================

const router = createRouter({
  outlet: document.querySelector('#page-outlet'),

  pages,

  onRouteChange: (route) => {
    closeMobileMenu();
    sidebar?.setAttribute('data-route', route);

    if (route === 'todo') initTodoPage();
    if (route === 'overview') initOverviewPage();
    if (route === 'calendar') initCalendarPage();
    if (route === 'activity') initActivityPage();
    if (route === 'habits') initHabitsPage();
    if (route === 'settings') initSettingsPage();
    if (route === 'statistics') initStatisticsPage();

    document.querySelectorAll('[data-route]').forEach((link) => {
      const active = link.dataset.route === route;

      link.classList.toggle('is-active', active);

      if (active) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  },
});


// ========================================
// OVERVIEW TASK INTERACTION
// ========================================

document.addEventListener('change', (event) => {
  const checkbox = event.target.closest('[data-task-toggle]');

  if (!checkbox) return;

  const data = getData();
  const task = data.tasks.find(
    (item) => item.id === checkbox.dataset.taskToggle,
  );

  if (!task) return;

  task.completed = checkbox.checked;
  task.failed = false;

  if (!saveData(data)) {
    checkbox.checked = !checkbox.checked;
    return;
  }

  const outlet = document.querySelector('#page-outlet');

  if (location.pathname.replace(/^\/+|\/+$/g, '') === 'overview' || location.pathname === '/') {
    outlet.innerHTML = pages.overview();
  }
});

// ========================================
// NAVIGATION EVENTS
// ========================================

document.addEventListener('click', (event) => {
  const link = event.target.closest('[data-route]');

  if (!link) return;

  // 새 탭 열기 등 브라우저 기본 동작은 유지
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  event.preventDefault();

  router.navigate(link.dataset.route);
});

router.start();

document.addEventListener('click', (event) => {
  const createButton = event.target.closest('[data-plan-create]');
  if (!createButton) return;
  closeMobileMenu();
  if (createButton.dataset.planCreate === 'event') openEventModal();
  if (createButton.dataset.planCreate === 'task') openTaskModal();
});

document.addEventListener('planner:datachange', () => {
  const route = location.pathname.replace(/^\/+|\/+$/g, '') || 'overview';
  const outlet = document.querySelector('#page-outlet');
  if (!pages[route] || !outlet) return;
  outlet.innerHTML = pages[route]();
  if (route === 'todo') initTodoPage();
  if (route === 'overview') initOverviewPage();
  if (route === 'calendar') initCalendarPage();
  if (route === 'activity') initActivityPage();
  if (route === 'habits') initHabitsPage();
  if (route === 'settings') initSettingsPage();
  if (route === 'statistics') initStatisticsPage();
});
