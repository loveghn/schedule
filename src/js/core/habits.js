import { createId, getTodayKey } from './storage.js';
import { getNextRecurrenceDate, isRecurrenceWithinEnd } from './recurrence.js';

const seriesIdOf = (task) => task.seriesId || task.id;
export const HABIT_SCHEDULE_DAYS = 14;

function shiftDateKey(dateKey, amount) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function getTrackedHabits(data) {
  const groups = new Map();
  data.tasks.filter((task) => task.trackHabit && task.recurrence?.frequency && task.recurrence.frequency !== 'none').forEach((task) => {
    const id = seriesIdOf(task);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(task);
  });

  return [...groups.entries()].map(([id, occurrences]) => {
    occurrences.sort((a, b) => Number(a.occurrenceNumber || 1) - Number(b.occurrenceNumber || 1) || (a.date || '').localeCompare(b.date || ''));
    const source = occurrences[0];
    return { id, title: source.title, recurrence: source.recurrence, occurrences };
  }).sort((a, b) => a.title.localeCompare(b.title, 'ko'));
}

/**
 * Calculate display-only habit occurrences for a bounded date window.
 * This function is intentionally pure: it never creates tasks or changes its inputs.
 */
export function calculateHabitSchedule(habits, baseDate, dayCount = HABIT_SCHEDULE_DAYS, habitLogs = []) {
  const days = Math.max(0, Math.floor(Number(dayCount) || 0));
  if (!baseDate || !days) return habits.map((habit) => ({ habitId: habit.id, occurrences: [] }));

  const lastDate = shiftDateKey(baseDate, days - 1);
  return habits.map((habit) => {
    const occurrences = [...(habit.occurrences || [])].sort((a, b) =>
      Number(a.occurrenceNumber || 1) - Number(b.occurrenceNumber || 1) || (a.date || '').localeCompare(b.date || ''),
    );
    const first = occurrences[0];
    const recurrence = first?.recurrence || habit.recurrence;
    if (!first?.date || !recurrence || recurrence.frequency === 'none') {
      return { habitId: habit.id, occurrences: [] };
    }

    const actualByDate = new Map();
    occurrences.forEach((task) => {
      if (!task.date) return;
      const current = actualByDate.get(task.date);
      if (!current || (task.completed && !current.completed) || (task.failed && !current.completed && !current.failed)) {
        actualByDate.set(task.date, task);
      }
    });

    const scheduled = [];
    let date = first.date;
    let occurrenceNumber = Number(first.occurrenceNumber || 1);
    // The guard protects against malformed recurrence data while allowing long-running series.
    for (let index = 0; date && date <= lastDate && index < 10000; index += 1) {
      if (!isRecurrenceWithinEnd(recurrence, date, occurrenceNumber)) break;
      if (date >= baseDate) {
        const task = actualByDate.get(date) || null;
        scheduled.push({
          date,
          occurrenceNumber,
          task,
          completed: Boolean(task?.completed || habitLogs.some((log) => log?.habitId === habit.id && log.date === date && log.completed)),
          failed: Boolean(task?.failed),
          isForecast: !task,
        });
      }

      const nextDate = getNextRecurrenceDate(date, recurrence);
      if (!nextDate || nextDate <= date) break;
      date = nextDate;
      occurrenceNumber += 1;
    }

    return { habitId: habit.id, occurrences: scheduled };
  });
}

/** Share the same display-only schedule and completion source across Dashboard and Habits. */
export function getHabitSchedule(data, baseDate, dayCount = HABIT_SCHEDULE_DAYS) {
  const habits = getTrackedHabits(data);
  const schedules = new Map(calculateHabitSchedule(habits, baseDate, dayCount, data.habitLogs || [])
    .map((schedule) => [schedule.habitId, schedule.occurrences]));
  return habits.map((habit) => ({
    ...habit,
    scheduledOccurrences: schedules.get(habit.id) || [],
  }));
}

export function syncHabitLog(data, task) {
  if (!task?.trackHabit || !task.date) return false;
  const habitId = seriesIdOf(task);
  const index = data.habitLogs.findIndex((log) => log.habitId === habitId && log.date === task.date);
  if (task.completed) {
    const log = { habitId, date: task.date, completed: true, taskId: task.id };
    if (index < 0) {
      data.habitLogs.push(log);
      return true;
    }
    if (data.habitLogs[index].taskId === task.id && data.habitLogs[index].completed) return false;
    data.habitLogs[index] = { ...data.habitLogs[index], ...log };
    return true;
  } else if (index >= 0) {
    data.habitLogs.splice(index, 1);
    return true;
  }
  return false;
}

export function ensureHabitOccurrences(data) {
  const today = getTodayKey();
  let changed = false;

  getTrackedHabits(data).forEach((habit) => {
    habit.occurrences.forEach((task) => {
      if (task.completed && syncHabitLog(data, task)) changed = true;
    });

    const occurrences = [...habit.occurrences].sort((a, b) => Number(a.occurrenceNumber || 1) - Number(b.occurrenceNumber || 1));
    const pending = occurrences.filter((task) => !task.completed && !task.failed);
    const extraGeneratedIds = new Set(pending.slice(1)
      .filter((task) => task.generatedFromId)
      .map((task) => task.id));
    if (extraGeneratedIds.size) {
      data.tasks = data.tasks.filter((task) => !extraGeneratedIds.has(task.id));
      changed = true;
    }

    // Keep one open occurrence at a time. Advance only after completion.
    if (pending.length) return;
    const latest = occurrences.at(-1);
    if (!latest?.completed) return;
    const recurrence = latest.recurrence || habit.recurrence;
    const nextDate = getNextRecurrenceDate(latest.date, recurrence);
    const nextNumber = Number(latest.occurrenceNumber || 1) + 1;
    if (!nextDate || !isRecurrenceWithinEnd(recurrence, nextDate, nextNumber)) return;
    const duplicate = data.tasks.some((task) => seriesIdOf(task) === habit.id && Number(task.occurrenceNumber) === nextNumber);
    if (duplicate) return;

    const now = new Date().toISOString();
    data.tasks.push({
      ...latest,
      id: createId('task'),
      seriesId: habit.id,
      occurrenceNumber: nextNumber,
      generatedFromId: latest.id,
      date: nextDate,
      description: '',
      trackHabit: true,
      trackHabitSince: latest.trackHabitSince || occurrences[0].trackHabitSince || occurrences[0].date,
      completed: false,
      failed: false,
      createdAt: now,
      updatedAt: now,
    });
    changed = true;
  });

  return changed;
}

export function getHabitStreak(habit, today = getTodayKey()) {
  const due = habit.occurrences.filter((task) => task.date <= today).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (due[0]?.date === today && !due[0].completed) due.shift();
  let streak = 0;
  for (const task of due) {
    if (!task.completed) break;
    streak += 1;
  }
  return streak;
}
