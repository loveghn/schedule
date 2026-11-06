import test from 'node:test';
import assert from 'node:assert/strict';
import { getCalendarWeekDates, initCalendarPage, renderCalendar, renderCalendarWeek, shiftCalendarDateByWeeks } from './calendar.js';
import { getTodayKey } from '../core/storage.js';

test('week includes seven dates starting Sunday when selection is midweek', () => {
  assert.deepEqual(getCalendarWeekDates('2026-11-04'), [
    '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04',
    '2026-11-05', '2026-11-06', '2026-11-07',
  ]);
});

test('week range crosses month and year boundaries', () => {
  assert.deepEqual(getCalendarWeekDates('2027-01-01'), [
    '2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30',
    '2026-12-31', '2027-01-01', '2027-01-02',
  ]);
});

test('a Sunday selection remains the start of its own week', () => {
  assert.equal(getCalendarWeekDates('2028-02-27')[0], '2028-02-27');
  assert.equal(getCalendarWeekDates('2028-02-27').at(-1), '2028-03-04');
});

test('week navigation shifts by seven calendar days across month and year boundaries', () => {
  assert.equal(shiftCalendarDateByWeeks('2026-12-31', 1), '2027-01-07');
  assert.equal(shiftCalendarDateByWeeks('2027-01-03', -1), '2026-12-27');
});

test('weekly view separates all-day items and positions timed events on the correct day', () => {
  const html = renderCalendarWeek({
    events: [
      { id: 'event-all-day', title: '휴일', date: '2026-11-03', startDate: '2026-11-03', endDate: '2026-11-03', allDay: true, color: '#FFD200' },
      { id: 'event-timed', title: '회의', date: '2026-11-03', startDate: '2026-11-03', endDate: '2026-11-03', allDay: false, startTime: '09:00', endTime: '10:30', color: '#00C3FF' },
      { id: 'event-range', title: '출장', date: '2026-11-03', startDate: '2026-11-03', endDate: '2026-11-04', allDay: false, startTime: '22:00', endTime: '02:00', color: '#6B5CFF' },
    ],
    tasks: [{ id: 'task-1', title: '자료 준비', date: '2026-11-03', categoryColor: '#FF4EFF', titleColor: '#000000' }],
  }, '2026-11-05', '2026-11-05');

  assert.equal((html.match(/class="calendar-week-date/g) || []).length, 7);
  assert.equal((html.match(/class="calendar-timeline__day/g) || []).length, 7);
  assert.match(html, /calendar-week-item--event[^>]*휴일|calendar-week-item--event[^>]*aria-label="2026-11-03 종일 일정 휴일"/);
  assert.match(html, /자료 준비/);
  assert.match(html, /top:396px;height:66px/);
  assert.equal((html.match(/>출장<\/span>/g) || []).length, 2);
  assert.match(html, /top:968px;height:88px/);
  assert.match(html, /일정 시간 미정|09:00 일정 회의/);
  assert.doesNotMatch(html, /data-calendar-(?:edit|delete|remove)/);
});

test('week timeline includes empty dates and the complete 24-hour axis', () => {
  const html = renderCalendarWeek({ events: [], tasks: [] }, '2026-11-05', '2026-11-05');
  assert.match(html, /00:00/);
  assert.match(html, /23:00/);
  assert.equal((html.match(/calendar-timeline__day/g) || []).length, 7);
  assert.equal((html.match(/calendar-week-allday__empty/g) || []).length, 7);
});

test('view switch, next-week navigation, date selection, and return to month preserve selection', () => {
  const storageValues = new Map([['my-schedule-data', JSON.stringify({
    version: 1, events: [], tasks: [], habits: [], habitLogs: [], activities: [], categories: [], settings: {},
  })]]);
  const listeners = {};
  const outlet = {
    dataset: {},
    innerHTML: '',
    querySelector: () => ({}),
    addEventListener: (type, handler) => { listeners[type] = handler; },
  };
  const previousStorage = globalThis.localStorage;
  const previousDocument = globalThis.document;
  globalThis.localStorage = {
    getItem: (key) => storageValues.get(key) ?? null,
    setItem: (key, value) => storageValues.set(key, value),
  };
  globalThis.document = { querySelector: () => outlet };

  const click = (elements) => listeners.click({ target: { closest: (selector) => elements[selector] || null } });
  try {
    outlet.innerHTML = renderCalendar();
    initCalendarPage();
    click({ '[data-calendar-view]': { dataset: { calendarView: 'week' } } });
    assert.match(outlet.innerHTML, /calendar-week-view/);

    click({ '[data-calendar-shift]': { dataset: { calendarShift: '1' } } });
    const nextWeek = getCalendarWeekDates(shiftCalendarDateByWeeks(getTodayKey(), 1));
    assert.match(outlet.innerHTML, new RegExp(nextWeek[0]));

    const selected = nextWeek[6];
    click({ '[data-calendar-date]': { dataset: { calendarDate: selected } } });
    click({ '[data-calendar-view]': { dataset: { calendarView: 'month' } } });
    assert.match(outlet.innerHTML, new RegExp(`class="calendar-day[^\"]*is-selected[^\"]*"[^>]*data-calendar-date="${selected}"`));
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});
