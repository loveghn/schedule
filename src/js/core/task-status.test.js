import test from 'node:test';
import assert from 'node:assert/strict';
import { setTaskStatus } from './task-status.js';

const recurrence = { frequency: 'daily', endType: 'never' };
const createTask = (overrides = {}) => ({
  id: 'task-1',
  seriesId: 'series-1',
  occurrenceNumber: 1,
  title: 'Daily run',
  description: 'Today only details',
  date: '2026-11-06',
  recurrence,
  trackHabit: false,
  completed: false,
  failed: false,
  ...overrides,
});
const createData = (task, extraTasks = [], habitLogs = []) => ({
  tasks: [task, ...extraTasks],
  habitLogs,
});

test('completion creates one next recurrence and clears its date-specific description', () => {
  const task = createTask();
  const data = createData(task);

  const result = setTaskStatus(data, task.id, 'completed', '2026-11-06T12:00:00.000Z');

  assert.equal(task.completed, true);
  assert.equal(task.failed, false);
  assert.equal(data.tasks.length, 2);
  assert.equal(result.nextTask.date, '2026-11-07');
  assert.equal(result.nextTask.description, '');
  assert.equal(data.tasks[1].generatedFromId, task.id);
});

test('habit completion creates the next task and records the matching date', () => {
  const task = createTask({ trackHabit: true });
  const data = createData(task);

  setTaskStatus(data, task.id, 'completed', '2026-11-06T12:00:00.000Z');

  assert.equal(data.tasks.length, 2);
  assert.deepEqual(data.habitLogs, [{
    habitId: 'series-1', date: task.date, completed: true, taskId: task.id,
  }]);
});

test('undoing completion clears the habit log and removes its generated pending habit occurrence', () => {
  const task = createTask({ trackHabit: true, completed: true });
  const nextTask = createTask({
    id: 'task-2', occurrenceNumber: 2, date: '2026-11-07',
    description: '', trackHabit: true, generatedFromId: task.id,
  });
  const data = createData(task, [nextTask], [{
    habitId: 'series-1', date: task.date, completed: true, taskId: task.id,
  }]);

  setTaskStatus(data, task.id, 'pending', '2026-11-06T13:00:00.000Z');

  assert.equal(task.completed, false);
  assert.equal(task.failed, false);
  assert.deepEqual(data.habitLogs, []);
  assert.deepEqual(data.tasks.map((item) => item.id), [task.id]);
});

test('failure does not create the next recurrence or a habit completion log', () => {
  const task = createTask({ trackHabit: true });
  const data = createData(task);

  setTaskStatus(data, task.id, 'failed', '2026-11-06T14:00:00.000Z');

  assert.equal(task.completed, false);
  assert.equal(task.failed, true);
  assert.equal(data.tasks.length, 1);
  assert.deepEqual(data.habitLogs, []);
});

test('canceling failure returns the task to pending without generating a recurrence', () => {
  const task = createTask({ failed: true });
  const data = createData(task);

  setTaskStatus(data, task.id, 'pending', '2026-11-06T15:00:00.000Z');

  assert.equal(task.completed, false);
  assert.equal(task.failed, false);
  assert.equal(data.tasks.length, 1);
});

test('status changes do not duplicate a recurrence that already exists', () => {
  const task = createTask();
  const nextTask = createTask({ id: 'task-2', occurrenceNumber: 2, date: '2026-11-07' });
  const data = createData(task, [nextTask]);

  const result = setTaskStatus(data, task.id, 'completed', '2026-11-06T12:00:00.000Z');

  assert.equal(result.nextTask, null);
  assert.equal(data.tasks.length, 2);
});
