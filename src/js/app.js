import '../styles/main.scss';

import { createRouter } from './core/router.js';
import { renderLayout } from './components/layout.js';
import { pages } from './pages/index.js';
import { getCorruptRawData, getData, getStorageStatus, resetStoredData, restoreData, saveData } from './core/storage.js';
import { initTodoPage } from './pages/todo.js';
import { initCalendarPage } from './pages/calendar.js';
import { openEventModal } from './pages/plans.js';
import { openTaskModal } from './pages/todo.js';
import { initActivityPage } from './pages/activity.js';
import { initOverviewPage } from './pages/overview.js';
import { initHabitsPage } from './pages/habits.js';
import { initSettingsPage } from './pages/settings.js';
import { initStatisticsPage } from './pages/statistics.js';
import { setTaskStatus } from './core/task-status.js';
import { showToast } from './components/toast.js';
import { ensureSettings } from './core/settings.js';
import { isValidBackup, normalizeImportedData } from './pages/settings.js';

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

function renderStorageRecovery(status) {
  const isCorrupt = status === 'corrupt';
  app.innerHTML = `<main class="storage-recovery" aria-labelledby="storage-recovery-title">
    <section class="storage-recovery__panel">
      <p class="storage-recovery__eyebrow">LOCAL DATA / RECOVERY</p>
      <h1 id="storage-recovery-title">${isCorrupt ? '저장 데이터에 문제가 있습니다.' : '브라우저 저장소에 접근할 수 없습니다.'}</h1>
      <p>${isCorrupt
        ? '원본 데이터는 그대로 보존했습니다. 백업 파일을 가져와 복구하거나, 원본 데이터를 내려받은 뒤 직접 초기화를 선택하세요.'
        : '브라우저 저장소에 접근할 수 없어 앱 데이터를 안전하게 읽거나 저장할 수 없습니다. 저장소 권한을 확인한 뒤 다시 시도하세요.'}</p>
      <div class="storage-recovery__actions">
        ${isCorrupt ? '<button class="btn btn--primary" type="button" data-recovery-import>백업 파일로 복구</button><button class="btn btn--outline" type="button" data-recovery-export>손상된 원본 내려받기</button><button class="btn btn--danger" type="button" data-recovery-reset>데이터 초기화</button><input type="file" accept=".json,application/json" data-recovery-file hidden>' : '<button class="btn btn--primary" type="button" data-recovery-retry>다시 확인</button>'}
      </div>
      <p class="storage-recovery__status" role="status" aria-live="polite" data-recovery-status></p>
    </section>
  </main>`;

  const statusMessage = app.querySelector('[data-recovery-status]');
  const fileInput = app.querySelector('[data-recovery-file]');
  app.querySelector('[data-recovery-import]')?.addEventListener('click', () => fileInput?.click());
  app.querySelector('[data-recovery-export]')?.addEventListener('click', () => {
    const raw = getCorruptRawData();
    if (raw === null) { statusMessage.textContent = '원본 데이터를 읽지 못했습니다.'; return; }
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `my-schedule-damaged-data-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    statusMessage.textContent = '손상된 원본 데이터를 내려받았습니다.';
  });
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!isValidBackup(parsed)) throw new Error('지원하지 않는 백업 파일 형식입니다.');
      const imported = parsed?.app === 'MY SCHEDULE' ? parsed.data : parsed;
      if (!window.confirm('현재 손상된 데이터 대신 선택한 백업 파일을 복구할까요? 원본 손상 데이터는 가져오기가 성공하기 전까지 유지됩니다.')) return;
      const replacement = normalizeImportedData(imported);
      ensureSettings(replacement);
      if (!restoreData(replacement)) throw new Error('복구 데이터를 저장하지 못했습니다. 저장 공간을 확인하세요.');
      window.location.reload();
    } catch (error) {
      statusMessage.textContent = error instanceof SyntaxError ? 'JSON 형식이 올바르지 않습니다. 원본 데이터는 유지됩니다.' : `${error.message} 원본 데이터는 유지됩니다.`;
    } finally {
      fileInput.value = '';
    }
  });
  app.querySelector('[data-recovery-reset]')?.addEventListener('click', () => {
    if (!window.confirm('저장된 원본 데이터를 비우고 새로 시작할까요? 이 작업은 되돌릴 수 없습니다. 먼저 원본을 내려받으세요.')) return;
    if (!resetStoredData()) { statusMessage.textContent = '데이터를 초기화하지 못했습니다. 원본은 유지됩니다.'; return; }
    window.location.reload();
  });
  app.querySelector('[data-recovery-retry]')?.addEventListener('click', () => window.location.reload());
}


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

  const wasCompleted = task.completed;
  setTaskStatus(data, task.id, checkbox.checked ? 'completed' : 'pending');

  if (!saveData(data)) {
    checkbox.checked = Boolean(wasCompleted);
    showToast({ type: 'error', title: '상태를 저장하지 못했습니다.' });
    return;
  }

  document.dispatchEvent(new CustomEvent('planner:datachange'));
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
  if (link.dataset.route === 'todo' && link.hash === '#inbox') {
    history.replaceState(history.state, '', `${link.pathname}${link.hash}`);
  }
});

const initialStorageStatus = getStorageStatus();
if (initialStorageStatus.status === 'corrupt' || initialStorageStatus.status === 'unavailable') {
  renderStorageRecovery(initialStorageStatus.status);
} else {
  router.start();
}

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
