import { createId } from './storage.js';
import { getNextRecurrenceDate, isRecurrenceWithinEnd } from './recurrence.js';
import { ensureHabitOccurrences, syncHabitLog } from './habits.js';

function createNextRecurringTask(data, task, now) {
  const recurrence = task.recurrence;
  if (!recurrence || recurrence.frequency === 'none') return null;

  const nextDate = getNextRecurrenceDate(task.date, recurrence);
  if (!nextDate) return null;
  const nextOccurrence = Number(task.occurrenceNumber || 1) + 1;
  if (!isRecurrenceWithinEnd(recurrence, nextDate, nextOccurrence)) return null;

  const seriesId = task.seriesId || task.id;
  const alreadyCreated = data.tasks.some((item) =>
    (item.seriesId || item.id) === seriesId && Number(item.occurrenceNumber) === nextOccurrence,
  );
  if (alreadyCreated) return null;

  task.seriesId = seriesId;
  task.occurrenceNumber = Number(task.occurrenceNumber || 1);
  return {
    ...task,
    id: createId('task'),
    seriesId,
    occurrenceNumber: nextOccurrence,
    generatedFromId: task.id,
    date: nextDate,
    description: '',
    completed: false,
    failed: false,
    createdAt: now,
    updatedAt: now,
  };
}

/** Apply a task state transition and its recurrence / habit data effects. */
export function setTaskStatus(data, taskId, status, now = new Date().toISOString()) {
  if (!['completed', 'failed', 'pending'].includes(status)) {
    throw new TypeError('할 일 상태가 올바르지 않습니다.');
  }

  const task = data.tasks.find((item) => item.id === taskId);
  if (!task) return null;

  task.completed = status === 'completed';
  task.failed = status === 'failed';
  task.updatedAt = now;

  let nextTask = null;
  if (status === 'completed') {
    nextTask = createNextRecurringTask(data, task, now);
    if (nextTask) data.tasks.push(nextTask);
  }

  syncHabitLog(data, task);
  if (task.trackHabit) ensureHabitOccurrences(data);

  return { task, nextTask, status };
}
