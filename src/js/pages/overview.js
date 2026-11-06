import { getData, getTodayKey } from '../core/storage.js';
import { addInboxItem } from '../core/inbox.js';
import { renderPageHeader } from '../components/page-header.js';
import { showToast } from '../components/toast.js';

const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const formatDate = (date, options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }) => new Intl.DateTimeFormat('ko-KR', options).format(date);
const safeColor = (color) => /^#[\da-f]{6}$/i.test(color || '') ? color : '#00E83B';
const eventStart = (event) => event.startDate || event.date || '';
const eventEnd = (event) => event.endDate || event.date || eventStart(event);
const eventOnDate = (event, key) => Boolean(eventStart(event) && eventStart(event) <= key && eventEnd(event) >= key);
const getEventTime = (event) => event.allDay || (event.allDay === undefined && !event.startTime && !event.time)
  ? '종일'
  : [event.startTime || event.time, event.endTime].filter(Boolean).join(' – ') || '시간 미정';
let focusResizeObserver = null;

function renderScheduleItem(event) {
  const startDate = eventStart(event);
  const isMultiday = eventEnd(event) !== startDate;
  const dateText = isMultiday ? `${formatDate(new Date(`${startDate}T00:00:00`), { month: 'short', day: 'numeric' })} – ${formatDate(new Date(`${eventEnd(event)}T00:00:00`), { month: 'short', day: 'numeric' })}` : getEventTime(event);
  return `<li class="overview-schedule-item"><span class="overview-schedule-item__color" style="--schedule-color:${safeColor(event.color)}"></span><div class="overview-schedule-item__content"><time>${escapeHTML(dateText)}</time><strong>${escapeHTML(event.title)}</strong>${event.description ? `<span>${escapeHTML(event.description)}</span>` : ''}</div></li>`;
}

function renderHabit(habit, completed, failed = false) {
  return `<li class="overview-habit ${completed ? 'is-completed' : ''} ${failed ? 'is-failed' : ''}"><span class="overview-habit__mark material-symbols-outlined" aria-hidden="true">${completed ? 'check' : failed ? 'close' : 'radio_button_unchecked'}</span><span class="overview-habit__name">${escapeHTML(habit.name)}</span><span class="overview-habit__status">${completed ? '완료' : failed ? '실패' : '미완료'}</span></li>`;
}

function renderUpcoming(event) {
  const date = eventStart(event);
  return `<li class="overview-upcoming-item"><time datetime="${escapeHTML(date)}"><strong>${new Date(`${date}T00:00:00`).getDate()}</strong><span>${escapeHTML(formatDate(new Date(`${date}T00:00:00`), { month: 'short', weekday: 'short' }))}</span></time><span class="overview-upcoming-item__color" style="--schedule-color:${safeColor(event.color)}"></span><div><strong>${escapeHTML(event.title)}</strong><span>${escapeHTML(getEventTime(event))}</span></div></li>`;
}

function renderUpcomingTask(task) {
  const date = new Date(`${task.date}T00:00:00`);
  const priority = task.priority || 'normal';
  const priorityLabel = { high: '높음', normal: '보통', low: '낮음' }[priority] || '보통';
  const metadata = [task.category, `우선순위 ${priorityLabel}`].filter(Boolean).join(' · ');
  return `<li class="overview-upcoming-item overview-upcoming-item--task"><time datetime="${escapeHTML(task.date)}"><strong>${date.getDate()}</strong><span>${escapeHTML(formatDate(date, { month: 'short', weekday: 'short' }))}</span></time><span class="overview-upcoming-item__color" aria-hidden="true"></span><div><strong>${escapeHTML(task.title)}</strong><span>${escapeHTML(metadata)}</span></div></li>`;
}

function renderEmpty(message) {
  return `<li class="overview-empty">${message}</li>`;
}

export function getRecentInboxItems(items, limit = 3) {
  return [...items]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit);
}

function renderInboxItem(item) {
  const createdAt = new Date(item.createdAt);
  const createdLabel = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(createdAt);
  return `<li class="overview-inbox__item"><time datetime="${escapeHTML(item.createdAt)}">${escapeHTML(createdLabel)}</time><span>${escapeHTML(item.text)}</span></li>`;
}

export function renderOverview() {
  const data = getData();
  const inboxItems = getRecentInboxItems(data.inbox);
  const now = new Date();
  const todayKey = getTodayKey(now);
  const todayTasks = data.tasks.filter((task) => task.date === todayKey);
  const openTasks = todayTasks.filter((task) => !task.completed && !task.failed);
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
  const weekStartKey = getTodayKey(weekStart);
  const weekEndKey = getTodayKey(weekEnd);
  const weekTasks = data.tasks.filter((task) => task.date && task.date >= weekStartKey && task.date <= weekEndKey);
  const completedWeekTasks = weekTasks.filter((task) => task.completed).length;
  const progress = weekTasks.length ? Math.round((completedWeekTasks / weekTasks.length) * 100) : 0;
  const priorityRank = { high: 0, normal: 1, low: 2 };
  const focusTask = [...openTasks].sort((a, b) => (priorityRank[a.priority || 'normal'] - priorityRank[b.priority || 'normal']))[0];
  const todayEvents = data.events.filter((event) => eventOnDate(event, todayKey)).sort((a, b) => {
    const aTime = a.allDay ? '' : a.startTime || a.time || '99:99';
    const bTime = b.allDay ? '' : b.startTime || b.time || '99:99';
    return aTime.localeCompare(bTime);
  });
  const todayHabitTasks = data.tasks.filter((task) => task.trackHabit && task.date === todayKey && task.recurrence?.frequency !== 'none');
  const completedHabitIds = new Set(todayHabitTasks.filter((task) => task.completed).map((task) => task.seriesId || task.id));
  const todayDate = new Date(`${todayKey}T00:00:00`);
  const nextWeek = new Date(todayDate);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekKey = getTodayKey(nextWeek);
  const upcomingEvents = data.events.filter((event) => eventStart(event) > todayKey && eventStart(event) <= nextWeekKey).sort((a, b) => `${eventStart(a)}${a.startTime || a.time || ''}`.localeCompare(`${eventStart(b)}${b.startTime || b.time || ''}`)).slice(0, 5);
  const upcomingTasks = data.tasks.filter((task) => !task.completed && !task.failed && task.date > todayKey && task.date <= nextWeekKey).sort((a, b) => a.date.localeCompare(b.date) || ({ high: 0, normal: 1, low: 2 }[a.priority || 'normal'] - { high: 0, normal: 1, low: 2 }[b.priority || 'normal'])).slice(0, 5);

  const scheduleMarkup = todayEvents.length ? todayEvents.map(renderScheduleItem).join('') : renderEmpty('오늘 예정된 일정이 없습니다.');
  const habitMarkup = todayHabitTasks.length ? todayHabitTasks.slice(0, 6).map((task) => renderHabit({ name: task.title }, task.completed, task.failed)).join('') : renderEmpty('오늘 예정된 습관이 없습니다.');
  const upcomingMarkup = upcomingEvents.length ? upcomingEvents.map(renderUpcoming).join('') : renderEmpty('앞으로 7일 안에 예정된 일정이 없습니다.');
  const upcomingTasksMarkup = upcomingTasks.length ? upcomingTasks.map(renderUpcomingTask).join('') : renderEmpty('앞으로 7일 안에 예정된 할 일이 없습니다.');
  const inboxPreviewMarkup = inboxItems.length ? inboxItems.map(renderInboxItem).join('') : '<li class="overview-inbox__empty">아직 미분류 항목이 없습니다.</li>';

  return `<article class="page page--overview overview">
    ${renderPageHeader('overview', { meta: todayKey, metaDateTime: todayKey, eyebrow: formatDate(now), variant: 'overview' })}

    <div class="overview-focus-progress">
      <section class="overview-panel overview-focus" aria-labelledby="overview-focus-title"><div class="overview-panel__heading"><p class="overview-section__index">TODAY'S FOCUS</p><h2 id="overview-focus-title">오늘의 핵심 목표</h2></div>${focusTask ? `<div class="overview-focus__task"><span class="overview-focus__priority todo-priority--${escapeHTML(focusTask.priority || 'normal')}">${escapeHTML(({ high: '높음', normal: '보통', low: '낮음' })[focusTask.priority || 'normal'])}</span><div id="overview-focus-content" class="overview-focus__content" data-focus-content><strong>${escapeHTML(focusTask.title)}</strong>${focusTask.description ? `<span> · ${escapeHTML(focusTask.description)}</span>` : ''}</div><button type="button" class="btn btn--outline btn--small overview-focus__toggle" data-focus-toggle aria-controls="overview-focus-content" aria-expanded="false" hidden>더보기</button></div>` : `<p class="overview-panel__empty">${todayTasks.length ? '오늘 할 일을 모두 완료했어요.' : '오늘 예정된 할 일이 없습니다.'}</p>`}</section>
      <section class="overview-panel overview-progress" aria-labelledby="overview-progress-title"><div class="overview-panel__heading"><div><p class="overview-section__index">WEEKLY PROGRESS</p><h2 id="overview-progress-title">이번 주 할 일 완료율</h2></div><span class="overview-section__count">${escapeHTML(formatDate(weekStart, { month: 'short', day: 'numeric' }))} – ${escapeHTML(formatDate(weekEnd, { month: 'short', day: 'numeric' }))}</span></div><div class="overview-progress__numbers"><strong>${weekTasks.length ? `${progress}%` : '—'}</strong><span>${completedWeekTasks} / ${weekTasks.length} 완료</span></div><div class="overview-progress__track" role="progressbar" aria-label="이번 주 할 일 완료율" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div>${weekTasks.length ? '' : '<p class="overview-progress__note">이번 주 마감인 할 일이 없습니다.</p>'}</section>
    </div>

    <section class="overview-panel overview-inbox" aria-labelledby="overview-inbox-title">
      <div class="overview-panel__heading">
        <div><p class="overview-section__index">QUICK CAPTURE / INBOX</p><h2 id="overview-inbox-title">빠른 기록</h2></div>
      </div>
      <form class="overview-inbox__form" data-inbox-capture novalidate>
        <label class="sr-only" for="overview-inbox-input">빠른 기록 내용</label>
        <input class="form-control" id="overview-inbox-input" name="text" type="text" placeholder="떠오른 생각이나 할 일을 빠르게 적어보세요." autocomplete="off" data-inbox-input>
        <button class="btn btn--primary" type="submit">추가</button>
      </form>
      <div class="overview-inbox__summary">
        <div class="overview-inbox__count"><span>미분류 항목</span><strong>${data.inbox.length}</strong></div>
        <ul class="overview-inbox__list" aria-label="최근 Inbox 항목">${inboxPreviewMarkup}</ul>
      </div>
    </section>

    <section class="overview-panel overview-schedule" aria-labelledby="overview-schedule-title"><div class="overview-panel__heading"><div><p class="overview-section__index">TODAY'S SCHEDULE</p><h2 id="overview-schedule-title">오늘 예정된 일정</h2></div><a class="overview-text-link" href="/calendar" data-route="calendar">달력 보기 <span class="material-symbols-outlined" aria-hidden="true">north_east</span></a></div><ul class="overview-schedule__list">${scheduleMarkup}</ul></section>

    <section class="overview-panel overview-habits" aria-labelledby="overview-habits-title"><div class="overview-panel__heading"><div><p class="overview-section__index">HABIT CHECK</p><h2 id="overview-habits-title">오늘 습관 체크 현황</h2></div><span class="overview-section__count">${completedHabitIds.size} / ${todayHabitTasks.length}</span></div><ul class="overview-habits__list">${habitMarkup}</ul><a class="overview-text-link" href="/habits" data-route="habits">습관 페이지 <span class="material-symbols-outlined" aria-hidden="true">north_east</span></a></section>

    <section class="overview-panel overview-upcoming" aria-labelledby="overview-upcoming-title"><div class="overview-panel__heading"><div><p class="overview-section__index">UPCOMING / NEXT 7 DAYS</p><h2 id="overview-upcoming-title">다가오는 주요 일정</h2></div><a class="overview-text-link" href="/calendar" data-route="calendar">달력 보기 <span class="material-symbols-outlined" aria-hidden="true">north_east</span></a></div><ul class="overview-upcoming__list">${upcomingMarkup}</ul></section>
    <section class="overview-panel overview-upcoming-tasks" aria-labelledby="overview-upcoming-tasks-title"><div class="overview-panel__heading"><div><p class="overview-section__index">UPCOMING TASKS / NEXT 7 DAYS</p><h2 id="overview-upcoming-tasks-title">다가오는 할 일</h2></div><a class="overview-text-link" href="/todo" data-route="todo">할 일 보기 <span class="material-symbols-outlined" aria-hidden="true">north_east</span></a></div><ul class="overview-upcoming-tasks__list">${upcomingTasksMarkup}</ul></section>
  </article>`;
}

export function initOverviewPage() {
  const outlet = document.querySelector('#page-outlet');
  const content = outlet?.querySelector('[data-focus-content]');
  const toggle = outlet?.querySelector('[data-focus-toggle]');
  focusResizeObserver?.disconnect();
  focusResizeObserver = null;
  if (content && toggle) {
    const updateOverflow = () => {
      if (!content.isConnected || toggle.getAttribute('aria-expanded') === 'true') return;
      toggle.hidden = content.scrollHeight <= content.clientHeight + 1;
    };
    requestAnimationFrame(updateOverflow);
    if ('ResizeObserver' in window) {
      focusResizeObserver = new ResizeObserver(updateOverflow);
      focusResizeObserver.observe(content);
    }

    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') !== 'true';
      content.classList.toggle('is-expanded', expanded);
      toggle.setAttribute('aria-expanded', String(expanded));
      toggle.textContent = expanded ? '접기' : '더보기';
      if (!expanded) requestAnimationFrame(updateOverflow);
    });
  }

  const captureForm = outlet?.querySelector('[data-inbox-capture]');
  captureForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = captureForm.querySelector('[data-inbox-input]');
    const text = input?.value || '';
    if (!text.trim()) {
      input?.focus();
      showToast({ type: 'warning', title: '내용을 입력하세요.' });
      return;
    }

    try {
      addInboxItem(text);
    } catch (error) {
      showToast({ type: 'error', title: 'Inbox에 저장하지 못했습니다.', message: error.message });
      return;
    }

    input.value = '';
    document.dispatchEvent(new CustomEvent('planner:datachange'));
    document.querySelector('[data-inbox-input]')?.focus();
    showToast({ type: 'success', title: 'Inbox에 저장했습니다.' });
  });

}
