import test from 'node:test';
import assert from 'node:assert/strict';
import { getRecentInboxItems, renderOverview } from './overview.js';
import { renderHabits } from './habits.js';
import { getHabitSchedule } from '../core/habits.js';
import { getData, getTodayKey } from '../core/storage.js';

const STORAGE_KEY = 'my-schedule-data';
const emptyData = () => ({
  version: 1,
  events: [], tasks: [], inbox: [], habits: [], habitLogs: [], activities: [], categories: [], settings: {},
});

function withData(data, run) {
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => key === STORAGE_KEY ? JSON.stringify(data) : null,
    setItem: () => {},
  };
  try {
    return run();
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
}

test('Inbox preview sorts newest first and shows no more than three entries', () => {
  const items = [1, 5, 3, 2, 4].map((day) => ({
    id: `inbox-${day}`,
    text: `메모 ${day}`,
    createdAt: `2026-11-0${day}T00:00:00.000Z`,
    updatedAt: `2026-11-0${day}T00:00:00.000Z`,
  }));
  assert.deepEqual(getRecentInboxItems(items).map((item) => item.text), ['메모 5', '메모 4', '메모 3']);
});

test('Dashboard shows Inbox count and recent preview separately from To-do data', () => {
  const inbox = [1, 2, 3, 4].map((day) => ({
    id: `inbox-${day}`,
    text: `캡처 ${day}`,
    createdAt: `2026-11-0${day}T00:00:00.000Z`,
    updatedAt: `2026-11-0${day}T00:00:00.000Z`,
  }));
  withData({ ...emptyData(), tasks: [{ id: 'task-1', title: 'To-do와 분리' }], inbox }, () => {
    const html = renderOverview();
    assert.match(html, /overview-inbox__count[\s\S]*?<strong>4<\/strong>/);
    assert.ok(html.indexOf('캡처 4') < html.indexOf('캡처 3'));
    assert.ok(html.indexOf('캡처 3') < html.indexOf('캡처 2'));
    assert.equal(html.includes('캡처 1'), false);
    assert.match(html, /빠른 기록/);
    assert.match(html, /href="\/todo#inbox" data-route="todo">전체 Inbox 보기/);
  });
});

test('Dashboard shows an empty Inbox state when there are no captured entries', () => {
  withData(emptyData(), () => {
    const html = renderOverview();
    assert.match(html, /아직 미분류 항목이 없습니다\./);
    assert.match(html, /overview-inbox__count[\s\S]*?<strong>0<\/strong>/);
  });
});

test('Dashboard focus task exposes the shared completion control', () => {
  withData({
    ...emptyData(),
    tasks: [{ id: 'task-focus', title: '오늘 집중할 일', date: getTodayKey(), completed: false, failed: false }],
  }, () => {
    const html = renderOverview();
    assert.match(html, /data-task-toggle="task-focus"/);
    assert.match(html, /완료 처리: 오늘 집중할 일/);
  });
});

const TODAY = '2026-11-06';
const habitTask = (overrides = {}) => ({
  id: 'habit-task-1', seriesId: 'habit-series-1', occurrenceNumber: 1,
  title: '금요일 달리기', date: '2026-11-05', trackHabit: true,
  recurrence: { frequency: 'daily', endType: 'never' }, completed: false, failed: false,
  ...overrides,
});

test('Dashboard shows today forecast even when no actual To-do occurrence exists and matches Habits schedule', () => {
  const task = habitTask();
  const data = { ...emptyData(), tasks: [task] };
  withData(data, () => {
    const dashboard = renderOverview({ now: new Date(2026, 10, 6, 12) });
    const habits = renderHabits({ today: TODAY });
    const schedule = getHabitSchedule(data, TODAY);
    const todayOccurrence = schedule[0].scheduledOccurrences.find((item) => item.date === TODAY);

    assert.ok(todayOccurrence);
    assert.equal(todayOccurrence.isForecast, true);
    assert.match(dashboard, /금요일 달리기/);
    assert.match(dashboard, /0 \/ 1/);
    assert.match(habits, /금요일 달리기/);
    assert.equal(data.tasks.length, 1);
  });
});

test('Dashboard excludes habits not scheduled for today by their weekday rule', () => {
  withData({
    ...emptyData(),
    tasks: [habitTask({
      date: '2026-11-02',
      recurrence: { frequency: 'weekly', weekdays: [1], endType: 'never' },
    })],
  }, () => {
    const html = renderOverview({ now: new Date(2026, 10, 6, 12) });
    assert.match(html, /오늘 예정된 습관이 없습니다\./);
    assert.doesNotMatch(html, /금요일 달리기/);
    assert.match(html, /0 \/ 0/);
  });
});

test('Dashboard renders one row when one Habit series has duplicate same-day To-do rows', () => {
  const first = habitTask();
  const duplicate = { ...first, id: 'habit-task-2', occurrenceNumber: 2, date: TODAY };
  withData({ ...emptyData(), tasks: [first, duplicate] }, () => {
    const html = renderOverview({ now: new Date(2026, 10, 6, 12) });
    const habitPanel = html.split('<section class="overview-panel overview-habits"')[1].split('</section>')[0];
    assert.equal((habitPanel.match(/금요일 달리기/g) || []).length, 1);
    assert.match(habitPanel, /0 \/ 1/);
  });
});

test('Dashboard reflects a completed Habit log for a forecast date', () => {
  withData({
    ...emptyData(),
    tasks: [habitTask()],
    habitLogs: [{ habitId: 'habit-series-1', date: TODAY, completed: true }],
  }, () => {
    const dashboard = renderOverview({ now: new Date(2026, 10, 6, 12) });
    const habits = renderHabits({ today: TODAY });
    assert.match(dashboard, /1 \/ 1/);
    assert.match(dashboard, /금요일 달리기/);
    assert.match(habits, /habit-today-item/);
    assert.match(habits, /1<small> \/ 1<\/small>/);
    assert.equal(getHabitSchedule(getData(), TODAY)[0].scheduledOccurrences[0].completed, true);
  });
});

test('Dashboard forecast respects selected weekdays and inclusive recurrence end date', () => {
  const task = habitTask({
    date: '2026-11-02',
    recurrence: { frequency: 'weekly', weekdays: [5], endType: 'date', endDate: TODAY },
  });
  withData({ ...emptyData(), tasks: [task] }, () => {
    const included = renderOverview({ now: new Date(2026, 10, 6, 12) });
    assert.match(included, /금요일 달리기/);
  });

  withData({
    ...emptyData(),
    tasks: [{ ...task, recurrence: { ...task.recurrence, endDate: '2026-11-05' } }],
  }, () => {
    const excluded = renderOverview({ now: new Date(2026, 10, 6, 12) });
    assert.match(excluded, /오늘 예정된 습관이 없습니다\./);
    assert.doesNotMatch(excluded, /금요일 달리기/);
  });
});
