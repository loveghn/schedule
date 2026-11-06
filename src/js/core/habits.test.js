import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateHabitSchedule, ensureHabitOccurrences, getTrackedHabits, syncHabitLog } from './habits.js';
import { getData, saveData } from './storage.js';

const daily = (overrides = {}) => ({ frequency: 'daily', endType: 'never', ...overrides });
const trackedHabit = (date, recurrence, options = {}) => {
  const task = {
    id: 'task-1', seriesId: 'habit-1', date, title: 'Run', recurrence,
    occurrenceNumber: 1, trackHabit: true, completed: false, failed: false, ...options,
  };
  return { id: 'habit-1', title: task.title, recurrence, occurrences: [task] };
};
const dates = (schedule) => schedule[0].occurrences.map((item) => item.date);

test('daily recurrence returns exactly the 30 calendar dates including the base date', () => {
  const schedule = calculateHabitSchedule([trackedHabit('2026-01-01', daily())], '2026-01-01');
  assert.equal(schedule[0].occurrences.length, 30);
  assert.equal(schedule[0].occurrences[0].date, '2026-01-01');
  assert.equal(schedule[0].occurrences.at(-1).date, '2026-01-30');
});

test('weekly recurrence follows selected weekdays and keeps the original phase', () => {
  const recurrence = { frequency: 'weekly', weekdays: [1, 3, 5], endType: 'never' };
  const schedule = calculateHabitSchedule([trackedHabit('2026-01-05', recurrence)], '2026-01-07');
  assert.deepEqual(dates(schedule), [
    '2026-01-07', '2026-01-09', '2026-01-12', '2026-01-14', '2026-01-16',
    '2026-01-19', '2026-01-21', '2026-01-23', '2026-01-26', '2026-01-28',
    '2026-01-30', '2026-02-02', '2026-02-04',
  ]);
});

test('a future initial occurrence is not moved earlier than its start date', () => {
  const schedule = calculateHabitSchedule([trackedHabit('2026-01-10', daily())], '2026-01-01');
  assert.equal(schedule[0].occurrences[0].date, '2026-01-10');
  assert.equal(schedule[0].occurrences.length, 21);
});

test('recurrence end date is inclusive and dates after it are excluded', () => {
  const schedule = calculateHabitSchedule([trackedHabit('2026-01-01', daily({ endType: 'date', endDate: '2026-01-03' }))], '2026-01-01');
  assert.deepEqual(dates(schedule), ['2026-01-01', '2026-01-02', '2026-01-03']);
});

test('recurrence count includes the initial occurrence', () => {
  const schedule = calculateHabitSchedule([trackedHabit('2026-01-01', daily({ endType: 'count', count: 3 }))], '2026-01-01');
  assert.deepEqual(dates(schedule), ['2026-01-01', '2026-01-02', '2026-01-03']);
});

test('UTC date calculation crosses leap day and year boundary without drift', () => {
  const leap = calculateHabitSchedule([trackedHabit('2028-02-27', daily())], '2028-02-27');
  assert.equal(leap[0].occurrences.length, 30);
  assert.deepEqual(dates(leap).slice(0, 4), ['2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01']);
  assert.equal(leap[0].occurrences.at(-1).date, '2028-03-27');

  const year = calculateHabitSchedule([trackedHabit('2026-12-25', daily())], '2026-12-25');
  assert.equal(year[0].occurrences.at(-1).date, '2027-01-23');
});

test('monthly day 31 skips a month where that date does not exist', () => {
  const recurrence = { frequency: 'monthly', monthlyMode: 'date', monthlyDay: 31, endType: 'never' };
  const schedule = calculateHabitSchedule([trackedHabit('2026-01-31', recurrence)], '2026-01-31');
  assert.deepEqual(dates(schedule), ['2026-01-31']);
});

test('a real completed occurrence takes precedence and is not duplicated as a forecast', () => {
  const habit = trackedHabit('2026-01-01', daily(), { completed: true });
  const schedule = calculateHabitSchedule([habit], '2026-01-01');
  assert.equal(schedule[0].occurrences.length, 30);
  assert.equal(schedule[0].occurrences[0].task, habit.occurrences[0]);
  assert.equal(schedule[0].occurrences[0].completed, true);
  assert.equal(schedule[0].occurrences[0].isForecast, false);
  assert.equal(schedule[0].occurrences[1].isForecast, true);
});

test('failure does not create an actual next task but forecast remains independent', () => {
  const task = { ...trackedHabit('2026-01-01', daily()).occurrences[0], failed: true };
  const data = { tasks: [task], habitLogs: [] };
  const forecast = calculateHabitSchedule([{ id: 'habit-1', title: 'Run', recurrence: task.recurrence, occurrences: [task] }], '2026-01-01');
  assert.equal(forecast[0].occurrences[1].date, '2026-01-02');
  assert.equal(forecast[0].occurrences[1].isForecast, true);
  assert.equal(ensureHabitOccurrences(data), false);
  assert.equal(data.tasks.length, 1);
});

test('completion still creates the next real To-do occurrence and completion log', () => {
  const task = { ...trackedHabit('2026-01-01', daily()).occurrences[0], completed: true };
  const data = { tasks: [task], habitLogs: [] };
  assert.equal(ensureHabitOccurrences(data), true);
  assert.equal(data.tasks.length, 2);
  assert.equal(data.tasks[1].date, '2026-01-02');
  assert.equal(data.tasks[1].occurrenceNumber, 2);
  assert.deepEqual(data.habitLogs.map((log) => log.date), ['2026-01-01']);
});

test('completion log sync adds on completion and removes on undo', () => {
  const task = trackedHabit('2026-01-01', daily()).occurrences[0];
  const data = { tasks: [task], habitLogs: [] };
  task.completed = true;
  assert.equal(syncHabitLog(data, task), true);
  assert.deepEqual(data.habitLogs.map(({ habitId, date }) => ({ habitId, date })), [{ habitId: 'habit-1', date: '2026-01-01' }]);
  task.completed = false;
  assert.equal(syncHabitLog(data, task), true);
  assert.deepEqual(data.habitLogs, []);
});

test('forecast calculation does not mutate tasks, completion logs, or recurrence data', () => {
  const habit = trackedHabit('2026-01-01', daily());
  const before = structuredClone(habit);
  calculateHabitSchedule([habit], '2026-01-01');
  assert.deepEqual(habit, before);
});

test('forecast leaves LocalStorage data unchanged and data remains readable after reload', () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  try {
    const task = trackedHabit('2026-01-01', daily()).occurrences[0];
    const data = {
      version: 1, events: [], tasks: [task], habits: [], habitLogs: [],
      activities: [], categories: [], settings: {},
    };
    assert.equal(saveData(data), true);
    const storedBefore = values.get('my-schedule-data');
    calculateHabitSchedule(getTrackedHabits(getData()), '2026-01-01');
    assert.equal(values.get('my-schedule-data'), storedBefore);
    assert.deepEqual(getData().tasks, [task]);
  } finally {
    delete globalThis.localStorage;
  }
});
