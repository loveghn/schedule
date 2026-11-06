import { getData, getTodayKey } from '../core/storage.js';
import { getContrastingTitleColor, normalizeTitleColor } from '../components/title-color.js';
import { renderPageHeader } from '../components/page-header.js';

let visibleMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedDate = getTodayKey();
let activeView = 'month';
let mobileAgendaOpen = false;

const pad = (value) => String(value).padStart(2, '0');
const keyOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const monthLabel = (date) => new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(date);
const dateLabel = (key) => new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(`${key}T00:00:00`));
const eventStart = (event) => event.startDate || event.date || '';
const eventEnd = (event) => event.endDate || event.date || eventStart(event);
const dateOrdinal = (key) => {
  if (!key) return NaN;
  const [year, month, day] = key.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
};
const dateFromKey = (key) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const shiftDateKey = (key, amount) => {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + amount);
  return keyOf(date);
};

export function getCalendarWeekDates(dateKey) {
  const first = dateFromKey(dateKey);
  first.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return keyOf(date);
  });
}

export function shiftCalendarDateByWeeks(dateKey, weeks) {
  return shiftDateKey(dateKey, Number(weeks) * 7);
}

const formatWeekRange = (startKey, endKey) => {
  const formatter = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' });
  return `${formatter.format(dateFromKey(startKey))} – ${formatter.format(dateFromKey(endKey))}`;
};
const eventIsAllDay = (event) => event.allDay || !(event.startTime || event.time);
const timeInMinutes = (time) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time || '');
  return match ? Math.min(1439, Number(match[1]) * 60 + Number(match[2])) : 0;
};

export function renderCalendarWeek(data, today, anchorDate = selectedDate) {
  const dates = getCalendarWeekDates(anchorDate);
  const dayHeadings = dates.map((key) => {
    const date = dateFromKey(key);
    const day = date.getDay();
    const weekendClass = day === 0 ? 'is-sunday' : day === 6 ? 'is-saturday' : '';
    return `<button type="button" class="calendar-week-date ${weekendClass} ${key === selectedDate ? 'is-selected' : ''} ${key === today ? 'is-today' : ''}" data-calendar-date="${key}" aria-label="${dateLabel(key)} 선택"><span>${['일', '월', '화', '수', '목', '금', '토'][day]}</span><strong>${date.getDate()}</strong></button>`;
  }).join('');

  const allDayColumns = dates.map((key) => {
    const events = data.events.filter((event) => eventOnDate(event, key) && eventIsAllDay(event));
    const tasks = data.tasks.filter((task) => task.date === key);
    const eventItems = events.map((event) => {
      const color = /^#[\da-f]{6}$/i.test(event.color || '') ? event.color : '#FFD200';
      const titleColor = normalizeTitleColor(event.titleColor, getContrastingTitleColor(color));
      const label = event.allDay === false && !(event.startTime || event.time) ? '시간 미정' : '종일';
      return `<button type="button" class="calendar-week-item calendar-week-item--event" data-calendar-date="${key}" title="${escapeHTML(event.title)}" aria-label="${key} ${label} 일정 ${escapeHTML(event.title)}" style="--event-color:${color};--event-text-color:${titleColor}"><span>${escapeHTML(event.title)}</span></button>`;
    }).join('');
    const taskItems = tasks.map((task) => {
      const color = task.category && /^#[\da-f]{6}$/i.test(task.categoryColor || '') ? task.categoryColor : '#FF4EFF';
      return `<button type="button" class="calendar-week-item calendar-week-item--task" data-calendar-date="${key}" title="${escapeHTML(task.title)}" aria-label="${key} 할 일 ${escapeHTML(task.title)}" style="--event-color:${color};--event-text-color:${normalizeTitleColor(task.titleColor)}"><span>${escapeHTML(task.title)}</span></button>`;
    }).join('');
    return `<div class="calendar-week-allday__column ${key === today ? 'is-today' : ''}">${eventItems}${taskItems}${taskItems || events.length ? '' : '<span class="calendar-week-allday__empty" aria-hidden="true">—</span>'}</div>`;
  }).join('');

  const timelineColumns = dates.map((key) => {
    const segments = data.events.filter((event) => eventOnDate(event, key) && !eventIsAllDay(event)).map((event) => {
      const startKey = eventStart(event);
      const endKey = eventEnd(event);
      const startMinute = key === startKey ? timeInMinutes(event.startTime || event.time) : 0;
      const parsedEnd = timeInMinutes(event.endTime);
      const endMinute = key === endKey && event.endTime ? parsedEnd : key === endKey ? startMinute : 1440;
      return { event, startMinute, endMinute: Math.max(endMinute, startMinute) };
    }).sort((a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute);
    const laneEnds = [];
    segments.forEach((segment) => {
      let lane = laneEnds.findIndex((end) => end <= segment.startMinute);
      if (lane < 0) lane = laneEnds.length;
      segment.lane = lane;
      laneEnds[lane] = Math.max(segment.endMinute, segment.startMinute + 30);
    });
    const laneCount = Math.max(laneEnds.length, 1);
    const items = segments.map(({ event, startMinute, endMinute, lane }) => {
      const color = /^#[\da-f]{6}$/i.test(event.color || '') ? event.color : '#FFD200';
      const titleColor = normalizeTitleColor(event.titleColor, getContrastingTitleColor(color));
      const height = Math.max(30, ((endMinute - startMinute) / 60) * 44);
      const time = event.startTime || event.time;
      return `<button type="button" class="calendar-timeline-event" data-calendar-date="${key}" title="${escapeHTML(event.title)} · ${escapeHTML(time)}${event.endTime ? `–${escapeHTML(event.endTime)}` : ''}" aria-label="${key} ${escapeHTML(time)} 일정 ${escapeHTML(event.title)}" style="top:${(startMinute / 60) * 44}px;height:${height}px;left:calc(${lane} * 100% / ${laneCount});width:calc(100% / ${laneCount});--event-color:${color};--event-text-color:${titleColor}"><span>${escapeHTML(event.title)}</span></button>`;
    }).join('');
    const date = dateFromKey(key);
    const weekendClass = date.getDay() === 6 ? 'is-saturday' : date.getDay() === 0 ? 'is-sunday' : '';
    return `<div class="calendar-timeline__day ${weekendClass} ${key === today ? 'is-today' : ''}">${items}</div>`;
  }).join('');

  const hourLabels = Array.from({ length: 24 }, (_, hour) => `<span>${String(hour).padStart(2, '0')}:00</span>`).join('');
  return `<div class="calendar-week-view" aria-label="${formatWeekRange(dates[0], dates[6])} 주간 일정">
    <p class="calendar-week-range">${formatWeekRange(dates[0], dates[6])}</p>
    <div class="calendar-week-scroll"><div class="calendar-week-canvas">
      <div class="calendar-week-header"><span aria-hidden="true"></span>${dayHeadings}</div>
      <div class="calendar-week-allday"><strong>종일 / 할 일</strong>${allDayColumns}</div>
      <div class="calendar-timeline"><div class="calendar-timeline__axis">${hourLabels}</div>${timelineColumns}</div>
    </div></div>
  </div>`;
}

function renderEvent(event) {
  const isLegacyAllDay = event.allDay === undefined && !event.startTime && !event.time;
  const time = event.allDay || isLegacyAllDay ? '종일' : event.startTime || event.time ? `${event.startTime || event.time}${event.endTime ? `–${event.endTime}` : ''}` : '시간 미정';
  const color = /^#[\da-f]{6}$/i.test(event.color || '') ? event.color : '#00E83B';
  return `<li class="calendar-event"><span class="calendar-event__dot" style="background:${color}" aria-hidden="true"></span><div><time>${escapeHTML(time)}</time><strong>${escapeHTML(event.title)}</strong>${event.description ? `<p>${escapeHTML(event.description)}</p>` : ''}</div><a href="/activity" data-route="activity" class="btn btn--outline btn--small calendar-event__open" aria-label="${escapeHTML(event.title)} 일정 기록 열기">열기 <span class="material-symbols-outlined" aria-hidden="true">north_east</span></a></li>`;
}

const eventOnDate = (event, key) => {
  const startDate = eventStart(event);
  const endDate = eventEnd(event);
  return startDate && key >= startDate && key <= endDate;
};

function setVisibleMonth(year, month) {
  const selectedDay = Number(selectedDate.slice(-2)) || 1;
  const lastDay = new Date(year, month + 1, 0).getDate();
  visibleMonth = new Date(year, month, 1);
  selectedDate = keyOf(new Date(year, month, Math.min(selectedDay, lastDay)));
}

function isMobileCalendar() {
  return typeof window !== 'undefined' && (window.matchMedia?.('(max-width: 768px)').matches || false);
}

function syncCalendarAgenda(outlet) {
  const agenda = outlet.querySelector('[data-calendar-agenda]');
  const backdrop = outlet.querySelector('[data-calendar-backdrop]');
  if (!agenda?.classList || !backdrop) return;

  const isMobile = isMobileCalendar();
  const isOpen = isMobile && mobileAgendaOpen;
  agenda.classList.toggle('is-sheet-open', isOpen);
  if (isMobile) {
    agenda.setAttribute('role', 'dialog');
    agenda.setAttribute('aria-hidden', String(!isOpen));
    agenda.inert = !isOpen;
    if (isOpen) agenda.setAttribute('aria-modal', 'true');
    else agenda.removeAttribute('aria-modal');
  } else {
    agenda.removeAttribute('role');
    agenda.removeAttribute('aria-modal');
    agenda.removeAttribute('aria-hidden');
    agenda.inert = false;
  }

  backdrop.hidden = !isOpen;
  backdrop.classList.toggle('is-visible', isOpen);
  document.body.classList.toggle('is-calendar-sheet-open', isOpen);
}

function renderCalendarOutlet(outlet, { openOnMobile = false, focusSheet = false } = {}) {
  if (openOnMobile && isMobileCalendar()) mobileAgendaOpen = true;
  outlet.innerHTML = render();
  syncCalendarAgenda(outlet);
  if (focusSheet && isMobileCalendar() && mobileAgendaOpen) {
    outlet.querySelector('[data-calendar-agenda-close]')?.focus();
  }
}

function closeMobileAgenda(outlet, { restoreFocus = true } = {}) {
  if (!isMobileCalendar()) return;
  mobileAgendaOpen = false;
  syncCalendarAgenda(outlet);
  if (!restoreFocus) return;
  const selectedDateButton = outlet.querySelector(activeView === 'week'
    ? '.calendar-week-date.is-selected'
    : '.calendar-day.is-selected');
  selectedDateButton?.focus();
}

function render() {
  const data = getData();
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstYear = new Date().getFullYear() - 3;
  const years = Array.from({ length: 5 }, (_, index) => firstYear + index);
  const firstDay = new Date(year, month, 1).getDay();
  const gridStart = new Date(year, month, 1 - firstDay);
  const today = getTodayKey();
  const weeks = [];
  for (let weekIndex = 0; weekIndex < 6; weekIndex += 1) {
    const weekStart = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + weekIndex * 7);
    const weekStartKey = keyOf(weekStart);
    const weekStartNumber = dateOrdinal(weekStartKey);
    const weekEvents = data.events
      .filter((event) => eventStart(event) && eventEnd(event) && dateOrdinal(eventStart(event)) < weekStartNumber + 7 && dateOrdinal(eventEnd(event)) >= weekStartNumber)
      .map((event) => ({
        event,
        startColumn: Math.max(0, dateOrdinal(eventStart(event)) - weekStartNumber),
        endColumn: Math.min(7, dateOrdinal(eventEnd(event)) - weekStartNumber + 1),
      }))
      .sort((a, b) => a.startColumn - b.startColumn || b.endColumn - a.endColumn);
    const laneEnds = [];
    weekEvents.forEach((segment) => {
      let lane = laneEnds.findIndex((endColumn) => endColumn <= segment.startColumn);
      if (lane < 0) lane = laneEnds.length;
      segment.lane = lane;
      laneEnds[lane] = segment.endColumn;
    });

    const days = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + dayIndex);
      const key = keyOf(date);
      const outside = date.getMonth() !== month;
      const weekendClass = dayIndex === 0 ? 'is-sunday' : dayIndex === 6 ? 'is-saturday' : '';
      const eventCount = data.events.filter((event) => eventOnDate(event, key)).length;
      const dayTasks = data.tasks.filter((task) => task.date === key);
      const taskChips = dayTasks.slice(0, 2).map((task) => {
        const taskColor = task.category && /^#[\da-f]{6}$/i.test(task.categoryColor || '') ? task.categoryColor : '#FF4EFF';
        return `<button type="button" class="calendar-week__task" data-calendar-date="${key}" aria-label="${key} 할 일 ${escapeHTML(task.title)}" style="--title-color:${normalizeTitleColor(task.titleColor)};--task-color:${taskColor}">${escapeHTML(task.title)}</button>`;
      }).join('');
      const moreTasks = dayTasks.length > 2 ? `<button type="button" class="calendar-week__more" data-calendar-date="${key}">+${dayTasks.length - 2} 할 일</button>` : '';
      days.push(`<button type="button" class="calendar-day ${weekendClass} ${outside ? 'is-outside' : ''} ${key === selectedDate ? 'is-selected' : ''} ${key === today ? 'is-today' : ''}" style="grid-column:${dayIndex + 1};grid-row:1" data-calendar-date="${key}" aria-label="${key}, 일정 ${eventCount + dayTasks.length}개" ${outside ? 'data-outside="true"' : ''}><span class="calendar-day__number">${date.getDate()}</span></button>${dayTasks.length ? `<div class="calendar-week__tasks ${dayIndex === 6 ? 'is-saturday' : ''}" style="grid-column:${dayIndex + 1};grid-row:${laneEnds.length + 2}">${taskChips}${moreTasks}</div>` : ''}`);
    }

    const bars = weekEvents.map(({ event, startColumn, endColumn, lane }) => {
      const beginsHere = dateOrdinal(eventStart(event)) >= weekStartNumber;
      const endsHere = dateOrdinal(eventEnd(event)) < weekStartNumber + 7;
      const color = /^#[\da-f]{6}$/i.test(event.color || '') ? event.color : '#FFD200';
      const classes = ['calendar-range-event', beginsHere ? 'is-start' : 'is-continuation', endsHere ? 'is-end' : ''];
      const titleColor = normalizeTitleColor(event.titleColor, getContrastingTitleColor(color));
      const segmentDate = keyOf(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + startColumn));
      return `<button type="button" class="${classes.filter(Boolean).join(' ')}" data-calendar-date="${segmentDate}" style="grid-column:${startColumn + 1}/${endColumn + 1};grid-row:${lane + 2};--event-color:${color};--event-text-color:${titleColor}" title="${escapeHTML(event.title)}" aria-label="${segmentDate} 일정 ${escapeHTML(event.title)}"><span>${escapeHTML(event.title)}</span></button>`;
    }).join('');
    weeks.push(`<div class="calendar-week" role="row" style="--event-lanes:${laneEnds.length}">${days.join('')}${bars}</div>`);
  }
  const dayEvents = data.events.filter((event) => eventOnDate(event, selectedDate)).sort((a, b) => (a.startTime || a.time || '').localeCompare(b.startTime || b.time || ''));
  const dayTasks = data.tasks.filter((task) => task.date === selectedDate);
  const dayEntries = [...dayEvents.map((event) => ({ ...event, kind: '일정' })), ...dayTasks.map((task) => ({ ...task, kind: '할 일' }))];
  const agenda = dayEntries.length ? dayEntries.map((entry) => {
    if (entry.kind === '일정') return renderEvent(entry);
    return `<li class="calendar-event calendar-event--task"><span class="calendar-event__dot" aria-hidden="true"></span><div><time>할 일</time><strong>${escapeHTML(entry.title)}</strong></div><a href="/todo" data-route="todo" class="btn btn--outline btn--small calendar-event__open">열기 <span class="material-symbols-outlined" aria-hidden="true">north_east</span></a></li>`;
  }).join('') : '<li class="calendar-empty">이 날은 아직 비어 있어요.<br><span>다른 날짜를 선택하면 그날의 항목이 표시됩니다.</span></li>';

  const monthView = `<div class="calendar-grid" role="grid" aria-label="${monthLabel(visibleMonth)}"><div class="calendar-weekdays" role="row">${['일','월','화','수','목','금','토'].map((d) => `<span role="columnheader">${d}</span>`).join('')}</div><div class="calendar-weeks">${weeks.join('')}</div></div><p class="calendar-hint">날짜를 선택하면 해당 일의 일정을 확인할 수 있어요.</p>`;
  const weeklyView = renderCalendarWeek(data, today, selectedDate);
  const isWeek = activeView === 'week';

  return `<article class="page page--calendar calendar-page">${renderPageHeader('calendar', { meta: today, metaDateTime: today })}
    <section class="calendar-workspace ${isWeek ? 'is-week-view' : ''}" aria-label="달력 및 일정"><div class="calendar-main"><div class="calendar-toolbar"><div class="calendar-month"><div class="calendar-period-selectors"><label class="sr-only" for="calendar-year">연도 선택</label><select class="form-control form-control--select calendar-period-select calendar-period-select--year" id="calendar-year" data-calendar-year aria-label="연도 선택">${years.map((itemYear) => `<option value="${itemYear}" ${itemYear === year ? 'selected' : ''}>${itemYear}년</option>`).join('')}</select><label class="sr-only" for="calendar-month">월 선택</label><select class="form-control form-control--select calendar-period-select calendar-period-select--month" id="calendar-month" data-calendar-month aria-label="월 선택">${Array.from({ length: 12 }, (_, index) => `<option value="${index}" ${index === month ? 'selected' : ''}>${index + 1}월</option>`).join('')}</select></div><button type="button" class="btn btn--primary btn--medium calendar-today" data-calendar-today>오늘</button></div><div class="calendar-controls"><div class="calendar-view-switch" role="group" aria-label="달력 보기"><button type="button" class="btn btn--outline btn--small ${!isWeek ? 'is-active' : ''}" data-calendar-view="month" aria-pressed="${!isWeek}">월간</button><button type="button" class="btn btn--outline btn--small ${isWeek ? 'is-active' : ''}" data-calendar-view="week" aria-pressed="${isWeek}">주간</button></div><div class="calendar-navigation"><button type="button" class="btn btn--outline btn--icon" data-calendar-shift="-1" aria-label="이전 ${isWeek ? '주' : '달'}"><span class="material-symbols-outlined" aria-hidden="true">chevron_left</span></button><button type="button" class="btn btn--outline btn--icon" data-calendar-shift="1" aria-label="다음 ${isWeek ? '주' : '달'}"><span class="material-symbols-outlined" aria-hidden="true">chevron_right</span></button></div></div></div>
    ${isWeek ? weeklyView : monthView}</div>
    <div class="calendar-sheet-backdrop" data-calendar-backdrop aria-hidden="true" hidden></div><aside class="calendar-agenda" data-calendar-agenda aria-labelledby="calendar-agenda-title" tabindex="-1"><div class="calendar-agenda__header"><div><p class="eyebrow">SELECTED DAY</p><h2 id="calendar-agenda-title">${dateLabel(selectedDate)}</h2></div><button type="button" class="btn btn--outline btn--icon calendar-agenda__close" data-calendar-agenda-close aria-label="상세 패널 닫기"><span class="material-symbols-outlined" aria-hidden="true">close</span></button></div><p class="calendar-agenda__count">일정 ${dayEvents.length} · 할 일 ${dayTasks.length}</p><ul class="calendar-event-list">${agenda}</ul></aside></section></article>`;
}

export function renderCalendar() { return render(); }

export function initCalendarPage() {
  const outlet = document.querySelector('#page-outlet');
  if (!outlet?.querySelector('.calendar-page')) return;
  syncCalendarAgenda(outlet);
  // The outlet survives route changes, so bind delegation only once.
  if (outlet.dataset.calendarEventsBound === 'true') return;
  outlet.dataset.calendarEventsBound = 'true';
  const calendarMedia = typeof window !== 'undefined' ? window.matchMedia?.('(max-width: 768px)') : null;
  if (calendarMedia) {
    let wasMobile = calendarMedia.matches;
    const onViewportChange = (mediaEvent) => {
      if (mediaEvent.matches !== wasMobile) {
        mobileAgendaOpen = mediaEvent.matches;
        wasMobile = mediaEvent.matches;
      }
      syncCalendarAgenda(outlet);
    };
    if (calendarMedia.addEventListener) calendarMedia.addEventListener('change', onViewportChange);
    else calendarMedia.addListener?.(onViewportChange);
  }
  outlet.addEventListener('click', (event) => {
    if (event.target.closest('[data-calendar-agenda-close]') || event.target.closest('[data-calendar-backdrop]')) {
      closeMobileAgenda(outlet);
      return;
    }
    if (event.target.closest('[data-route]')) {
      mobileAgendaOpen = false;
      document.body.classList.remove('is-calendar-sheet-open');
      return;
    }
    const viewButton = event.target.closest('[data-calendar-view]');
    if (viewButton) { activeView = viewButton.dataset.calendarView; renderCalendarOutlet(outlet); return; }
    const shift = event.target.closest('[data-calendar-shift]');
    if (shift) {
      const amount = Number(shift.dataset.calendarShift);
      if (activeView === 'week') {
        selectedDate = shiftCalendarDateByWeeks(selectedDate, amount);
        visibleMonth = new Date(dateFromKey(selectedDate).getFullYear(), dateFromKey(selectedDate).getMonth(), 1);
      } else {
        const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + amount, 1);
        setVisibleMonth(next.getFullYear(), next.getMonth());
      }
      renderCalendarOutlet(outlet);
      return;
    }
    if (event.target.closest('[data-calendar-today]')) { const today = new Date(); selectedDate = getTodayKey(today); setVisibleMonth(today.getFullYear(), today.getMonth()); renderCalendarOutlet(outlet, { openOnMobile: true, focusSheet: true }); return; }
    const day = event.target.closest('[data-calendar-date]');
    if (day) {
      selectedDate = day.dataset.calendarDate;
      if (day.dataset.outside || activeView === 'week') {
        const selected = dateFromKey(selectedDate);
        visibleMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
      }
      renderCalendarOutlet(outlet, { openOnMobile: true, focusSheet: true });
      return;
    }
  });
  // Sidebar navigation lives outside the page outlet; release the sheet's
  // document scroll lock before the SPA replaces the Calendar page.
  document.addEventListener?.('click', (event) => {
    const routeLink = event.target.closest('[data-route]');
    if (!routeLink || outlet.contains(routeLink)) return;
    mobileAgendaOpen = false;
    document.body.classList.remove('is-calendar-sheet-open');
  });
  document.addEventListener?.('keydown', (event) => {
    if (!isMobileCalendar() || !mobileAgendaOpen) return;
    const agenda = outlet.querySelector('[data-calendar-agenda]');
    if (!agenda) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMobileAgenda(outlet);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...agenda.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
    if (!focusable.length) { event.preventDefault(); agenda.focus(); return; }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || !agenda.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !agenda.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  });
  outlet.addEventListener('change', (event) => {
    const yearSelect = event.target.closest('[data-calendar-year]');
    const monthSelect = event.target.closest('[data-calendar-month]');
    if (!yearSelect && !monthSelect) return;
    const year = Number(yearSelect?.value ?? visibleMonth.getFullYear());
    const month = Number(monthSelect?.value ?? visibleMonth.getMonth());
    setVisibleMonth(year, month);
    renderCalendarOutlet(outlet);
  });
}

