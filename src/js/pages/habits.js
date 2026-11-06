import { getData, getTodayKey, saveData } from '../core/storage.js';
import { ensureHabitOccurrences, getHabitSchedule, getHabitStreak, getTrackedHabits, HABIT_SCHEDULE_DAYS, syncHabitLog } from '../core/habits.js';
import { showToast } from '../components/toast.js';
import { renderPageHeader } from '../components/page-header.js';

const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const formatDate = (key, options = { month: 'long', day: 'numeric', weekday: 'short' }) => new Intl.DateTimeFormat('ko-KR', options).format(new Date(`${key}T00:00:00`));
const addDays = (key, amount) => {
  const date = new Date(`${key}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return getTodayKey(date);
};
const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];

function recurrenceLabel(recurrence) {
  if (recurrence.frequency === 'daily') return '매일';
  if (recurrence.frequency === 'weekly') return [...new Set(recurrence.weekdays || [])].sort((a, b) => a - b).map((day) => `${weekdayNames[day]}요일`).join(' · ');
  if (recurrence.frequency === 'monthly') {
    if (recurrence.monthlyMode === 'weekday') {
      const ordinal = { 1: '첫 번째', 2: '두 번째', 3: '세 번째', 4: '네 번째', 5: '다섯 번째', last: '마지막' }[recurrence.monthlyOrdinal] || '첫 번째';
      return `매월 ${ordinal} ${weekdayNames[Number(recurrence.monthlyWeekday || 0)]}요일`;
    }
    return `매월 ${Number(recurrence.monthlyDay || 1)}일`;
  }
  return '반복 일정';
}

function progressForWeek(habits, today) {
  const weekStartDate = new Date(`${today}T00:00:00`);
  weekStartDate.setDate(weekStartDate.getDate() - weekStartDate.getDay());
  const weekStart = getTodayKey(weekStartDate);
  const due = habits.flatMap((habit) => habit.occurrences).filter((task) => task.date >= weekStart && task.date <= today);
  const completed = due.filter((task) => task.completed).length;
  return { due, completed, rate: due.length ? Math.round((completed / due.length) * 100) : null };
}

function renderTodayItem(habit) {
  return `<li class="habit-today-item">${escapeHTML(habit.title)}</li>`;
}

function renderWeeklyTracker(habits, today) {
  const startDate = new Date(`${today}T00:00:00`);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + index);
    return getTodayKey(date);
  });
  const heading = days.map((date) => `<span class="habit-weekly__day ${date === today ? 'is-today' : ''}"><strong>${weekdayNames[new Date(`${date}T00:00:00`).getDay()]}</strong><small>${Number(date.slice(-2))}</small></span>`).join('');
  const rows = habits.map((habit) => `<div class="habit-weekly__row"><strong class="habit-weekly__name">${escapeHTML(habit.title)}</strong>${days.map((date) => {
    const actualTask = habit.occurrences.find((item) => item.date === date);
    const scheduled = date >= today ? habit.scheduledOccurrences.find((item) => item.date === date) : null;
    const task = actualTask || scheduled?.task;
    if (!task && !scheduled) return `<span class="habit-weekly__cell is-empty" aria-label="${date} 예정 없음">—</span>`;
    const completed = Boolean(task?.completed || scheduled?.completed);
    const failed = Boolean(task?.failed || scheduled?.failed);
    const state = completed ? 'is-completed' : failed || date < today ? 'is-missed' : date > today ? 'is-upcoming' : 'is-pending';
    const icon = completed ? 'check' : failed || date < today ? 'close' : date > today ? 'remove' : 'radio_button_unchecked';
    const label = completed ? '완료' : failed ? '실패' : date < today ? '미완료' : date > today ? '예정' : '오늘 예정';
    return `<span class="habit-weekly__cell ${state}" aria-label="${date} ${label}"><span class="material-symbols-outlined" aria-hidden="true">${icon}</span></span>`;
  }).join('')}</div>`).join('');
  return `<div class="habit-weekly" role="table" aria-label="이번 주 습관 기록"><div class="habit-weekly__header"><span>습관</span>${heading}</div>${rows || '<p class="habit-empty">추적 중인 습관이 없습니다.</p>'}</div>`;
}

function renderUpcoming(habits, today) {
  const until = addDays(today, HABIT_SCHEDULE_DAYS - 1);
  const upcoming = habits.flatMap((habit) => habit.scheduledOccurrences
    .filter((item) => item.date > today && item.date <= until && !item.completed && !item.failed)
    .map((item) => ({ habit, task: item.task || { date: item.date } })))
    .sort((a, b) => a.task.date.localeCompare(b.task.date) || a.habit.title.localeCompare(b.habit.title, 'ko'));
  if (!upcoming.length) return '<li class="habit-upcoming__empty">오늘 포함 14일 동안 예정된 습관이 없습니다.</li>';
  return upcoming.map(({ habit, task }) => `<li class="habit-upcoming__item"><time datetime="${task.date}"><strong>${Number(task.date.slice(-2))}</strong><span>${escapeHTML(formatDate(task.date, { month: 'short', weekday: 'short' }))}</span></time><div><strong>${escapeHTML(habit.title)}</strong><span>${escapeHTML(recurrenceLabel(habit.recurrence))}</span></div></li>`).join('');
}

export function renderHabits({ today = getTodayKey() } = {}) {
  const data = getData();
  const habits = getHabitSchedule(data, today, HABIT_SCHEDULE_DAYS);
  const todayTasks = habits.flatMap((habit) => habit.scheduledOccurrences.filter((item) => item.date === today).map((occurrence) => ({
    habit,
    occurrence,
  })))
    .sort((a, b) => a.habit.title.localeCompare(b.habit.title, 'ko'));
  const week = progressForWeek(habits, today);
  const completedToday = todayTasks.filter(({ occurrence }) => occurrence.completed).length;
  const longestStreak = habits.reduce((longest, habit) => Math.max(longest, getHabitStreak(habit, today)), 0);
  const todayContent = todayTasks.length
    ? `<ul class="habit-today-list">${todayTasks.map(({ habit }) => renderTodayItem(habit)).join('')}</ul>`
    : `<div class="habit-empty"><strong>${habits.length ? '오늘 예정된 습관이 없습니다.' : '아직 추적 중인 습관이 없습니다.'}</strong><span>${habits.length ? '다음 예정일을 확인해 보세요.' : '반복 할 일에서 ‘습관으로 추적’을 켜면 여기에 모입니다.'}</span>${!habits.length ? '<a class="btn btn--primary" href="/todo" data-route="todo">할 일에서 습관 만들기</a>' : ''}</div>`;

  return `<article class="page page--habits habits-page">
    ${renderPageHeader('habits', { meta: today, metaDateTime: today })}

    <section class="habit-summary" aria-label="습관 요약">
      <div class="habit-summary__item habit-summary__item--today"><span>오늘 완료</span><strong>${completedToday}<small> / ${todayTasks.length}</small></strong></div>
      <div class="habit-summary__item"><span>이번 주 수행률</span><strong>${week.rate === null ? '—' : `${week.rate}%`}</strong><small>${week.completed} / ${week.due.length}회</small></div>
      <div class="habit-summary__item"><span>최장 연속 수행</span><strong>${longestStreak}<small>회</small></strong></div>
      <div class="habit-summary__item"><span>추적 중</span><strong>${habits.length}<small>개</small></strong></div>
    </section>

    <div class="habits-layout">
      <section class="habit-section habit-section--today" aria-labelledby="habit-today-title">
        <div class="habit-section__heading"><div><p class="habit-section__index">TODAY / ${today}</p><h2 id="habit-today-title">오늘의 습관</h2></div><span>${completedToday} / ${todayTasks.length} 완료</span></div>
        ${todayContent}
      </section>
      <section class="habit-section habit-section--week" aria-labelledby="habit-week-title">
        <div class="habit-section__heading"><div><p class="habit-section__index">WEEKLY RECORD</p><h2 id="habit-week-title">이번 주 기록</h2></div><span>일요일 – 토요일</span></div>
        ${renderWeeklyTracker(habits, today)}
        <div class="habit-legend"><span><i class="is-completed"></i>완료</span><span><i class="is-pending"></i>오늘</span><span><i class="is-missed"></i>미완료</span><span><i class="is-upcoming"></i>예정</span></div>
      </section>
      <section class="habit-section habit-section--upcoming" aria-labelledby="habit-upcoming-title">
        <div class="habit-section__heading"><div><p class="habit-section__index">NEXT 14 DAYS</p><h2 id="habit-upcoming-title">다가오는 습관</h2></div><span>오늘 포함 14일</span></div>
        <ul class="habit-upcoming">${renderUpcoming(habits, today)}</ul>
      </section>
    </div>
  </article>`;
}

export function initHabitsPage() {
  const outlet = document.querySelector('#page-outlet');
  if (!outlet?.querySelector('.habits-page')) return;

  const data = getData();
  let changed = ensureHabitOccurrences(data);
  getTrackedHabits(data).forEach((habit) => habit.occurrences.forEach((task) => {
    if (task.completed && syncHabitLog(data, task)) changed = true;
  }));
  if (changed && !saveData(data)) {
    showToast({ type: 'error', title: '습관 일정을 저장하지 못했습니다.', message: '브라우저 저장 공간을 확인하세요.' });
  }

  outlet.innerHTML = renderHabits();
}
