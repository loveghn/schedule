import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStatistics } from './statistics.js';

const now = new Date('2026-11-06T12:00:00+09:00');
const emptyData = (overrides = {}) => ({
  events: [], tasks: [], habits: [], habitLogs: [], activities: [], ...overrides,
});

test('To-do statistics include period start and today, exclude future and undated tasks', () => {
  const stats = calculateStatistics(emptyData({ tasks: [
    { id: 'before', date: '2026-10-30', completed: true },
    { id: 'start', date: '2026-10-31', completed: true },
    { id: 'failed', date: '2026-11-02', failed: true },
    { id: 'pending', date: '2026-11-03' },
    { id: 'today', date: '2026-11-06', completed: true, failed: true },
    { id: 'future', date: '2026-11-07', completed: true },
    { id: 'undated', completed: true },
    { id: 'invalid', date: '2026-02-30', completed: true },
  ] }), 'week', now);

  assert.equal(stats.start, '2026-10-31');
  assert.equal(stats.end, '2026-11-06');
  assert.deepEqual(stats.totals, { tasks: 4, completed: 2, failed: 1, pending: 1, events: 0 });
  assert.equal(stats.completionRate, 50);
  assert.equal(stats.buckets[0].tasks, 1);
  assert.equal(stats.buckets[6].completed, 1);
});

test('event totals count unique schedules that overlap the selected period', () => {
  const stats = calculateStatistics(emptyData({ events: [
    { id: 'cross-start', startDate: '2026-09-30', endDate: '2026-10-09' },
    { id: 'inside', startDate: '2026-11-06', endDate: '2026-11-10' },
    { id: 'ended-before', startDate: '2026-10-01', endDate: '2026-10-07' },
    { id: 'future', startDate: '2026-11-07', endDate: '2026-11-08' },
    { id: 'invalid', startDate: '2026-10-25', endDate: '2026-10-20' },
  ] }), 'month', now);

  assert.equal(stats.start, '2026-10-08');
  assert.equal(stats.totals.events, 2);
  assert.equal(stats.buckets.length, 6);
  assert.equal(stats.buckets[0].events, 1);
  assert.equal(stats.buckets.at(-1).events, 1);
});

test('year period uses twelve calendar months and includes events crossing its start boundary', () => {
  const stats = calculateStatistics(emptyData({ events: [
    { id: 'cross-boundary', startDate: '2025-11-30', endDate: '2025-12-02' },
    { id: 'outside', startDate: '2025-11-20', endDate: '2025-11-30' },
  ] }), 'year', now);

  assert.equal(stats.start, '2025-12-01');
  assert.equal(stats.buckets.length, 12);
  assert.equal(stats.totals.events, 1);
  assert.equal(stats.buckets[0].events, 1);
});

test('habit statistics use weekly recurrence rules and de-duplicate completion logs', () => {
  const recurrence = { frequency: 'weekly', weekdays: [0, 3, 5, 6], endType: 'never' };
  const dates = [
    ['2026-10-28', 1, false, false],
    ['2026-10-30', 2, false, false],
    ['2026-10-31', 3, true, false],
    ['2026-11-01', 4, false, true],
    ['2026-11-04', 5, true, false],
    ['2026-11-06', 6, false, false],
  ];
  const tasks = dates.map(([date, occurrenceNumber, completed, failed]) => ({
    id: `task-${occurrenceNumber}`,
    seriesId: 'habit-running',
    occurrenceNumber,
    date,
    title: 'Running',
    recurrence,
    trackHabit: true,
    completed,
    failed,
  }));
  const stats = calculateStatistics(emptyData({
    tasks,
    habitLogs: [
      { habitId: 'habit-running', date: '2026-10-31', completed: true, taskId: 'task-3' },
      { habitId: 'habit-running', date: '2026-11-04', completed: true, taskId: 'task-5' },
      { habitId: 'habit-running', date: '2026-11-04', completed: true, taskId: 'task-5' },
    ],
  }), 'week', now);

  assert.equal(stats.habits.tracked, 1);
  assert.equal(stats.habits.occurrences, 4);
  assert.equal(stats.habits.completed, 2);
  assert.equal(stats.habits.failed, 1);
  assert.equal(stats.habits.pending, 1);
  assert.equal(stats.habits.completionRate, 50);
  // Habit logs are reported separately; the task totals count their task rows once.
  assert.deepEqual({ tasks: stats.totals.tasks, completed: stats.totals.completed }, { tasks: 4, completed: 2 });
});

test('habit expected counts honor recurrence count and inclusive end-date limits', () => {
  const dailyCount = {
    frequency: 'daily', endType: 'count', count: 3,
  };
  const dateEnd = {
    frequency: 'daily', endType: 'date', endDate: '2026-11-05',
  };
  const tasks = [
    { id: 'count-1', seriesId: 'count-series', occurrenceNumber: 1, date: '2026-11-04', title: 'Count', recurrence: dailyCount, trackHabit: true },
    { id: 'date-1', seriesId: 'date-series', occurrenceNumber: 1, date: '2026-11-04', title: 'Date', recurrence: dateEnd, trackHabit: true },
  ];
  const stats = calculateStatistics(emptyData({ tasks }), 'week', now);

  assert.equal(stats.habits.occurrences, 5);
  assert.equal(stats.habits.pending, 5);
  assert.equal(stats.habits.completed, 0);
});

test('habit completion uses habitLogs and does not infer completion from a completed task', () => {
  const stats = calculateStatistics(emptyData({ tasks: [{
    id: 'completed-without-log', seriesId: 'habit-no-log', occurrenceNumber: 1,
    date: '2026-11-04', title: 'Read', trackHabit: true, completed: true,
    recurrence: { frequency: 'daily', endType: 'never' },
  }] }), 'week', now);

  assert.equal(stats.totals.completed, 1);
  assert.equal(stats.habits.occurrences, 3);
  assert.equal(stats.habits.completed, 0);
  assert.equal(stats.habits.pending, 3);
});

test('habit statistics exclude recurrence dates after today', () => {
  const stats = calculateStatistics(emptyData({ tasks: [{
    id: 'future-habit', seriesId: 'future-habit-series', occurrenceNumber: 1,
    date: '2026-11-07', title: 'Future run', trackHabit: true,
    recurrence: { frequency: 'daily', endType: 'never' },
  }] }), 'week', now);

  assert.equal(stats.habits.occurrences, 0);
  assert.equal(stats.habits.completionRate, null);
});

test('empty data returns no-data rates instead of zero percent', () => {
  const stats = calculateStatistics(emptyData(), 'week', now);

  assert.equal(stats.totals.tasks, 0);
  assert.equal(stats.totals.events, 0);
  assert.equal(stats.completionRate, null);
  assert.equal(stats.habits.occurrences, 0);
  assert.equal(stats.habits.completionRate, null);
  assert.ok(stats.buckets.every((bucket) => bucket.tasks === 0 && bucket.events === 0 && bucket.habitOccurrences === 0));
});

test('monthly habit recurrence skips invalid month dates and excludes future occurrences', () => {
  const stats = calculateStatistics(emptyData({ tasks: [{
    id: 'monthly-1', seriesId: 'monthly-series', occurrenceNumber: 1,
    date: '2026-10-31', title: 'Monthly', trackHabit: true,
    recurrence: { frequency: 'monthly', monthlyMode: 'date', monthlyDay: 31, endType: 'never' },
  }] }), 'week', now);

  // November has no 31st; December 31 is beyond the as-of date.
  assert.equal(stats.habits.occurrences, 1);
  assert.equal(stats.habits.pending, 1);
});
