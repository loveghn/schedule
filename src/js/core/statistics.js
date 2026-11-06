import { calculateHabitSchedule, getTrackedHabits } from './habits.js';
import { getTodayKey } from './storage.js';

const PERIODS = {
  week: { days: 7, bucketSize: 1, label: '최근 7일' },
  month: { days: 30, bucketSize: 5, label: '최근 30일' },
};

const isDateKey = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const dateKey = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
const dateFromKey = (key) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};
const shiftDateKey = (key, amount) => {
  const date = dateFromKey(key);
  date.setUTCDate(date.getUTCDate() + amount);
  return dateKey(date);
};
const daysBetweenInclusive = (start, end) => {
  if (!isDateKey(start) || !isDateKey(end) || end < start) return 0;
  return (dateFromKey(end) - dateFromKey(start)) / 86400000 + 1;
};

const eventStart = (event) => event?.startDate || event?.date || '';
const eventEnd = (event) => event?.endDate || event?.date || eventStart(event);

function createBuckets(period, start, end) {
  if (period === 'year') {
    const [year, month] = start.split('-').map(Number);
    return Array.from({ length: 12 }, (_, index) => {
      const first = new Date(Date.UTC(year, month - 1 + index, 1));
      const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
      return createBucket(dateKey(first), dateKey(last), new Intl.DateTimeFormat('ko-KR', { month: 'short', timeZone: 'UTC' }).format(first));
    });
  }

  const { days, bucketSize } = PERIODS[period];
  return Array.from({ length: Math.ceil(days / bucketSize) }, (_, index) => {
    const bucketStart = shiftDateKey(start, index * bucketSize);
    const bucketEnd = shiftDateKey(start, Math.min(days - 1, (index + 1) * bucketSize - 1));
    const startDay = Number(bucketStart.slice(-2));
    const endDay = Number(bucketEnd.slice(-2));
    const label = period === 'week'
      ? new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'UTC' }).format(dateFromKey(bucketStart))
      : bucketStart.slice(0, 7) === bucketEnd.slice(0, 7)
        ? `${startDay}–${endDay}`
        : `${bucketStart.slice(5)}–${bucketEnd.slice(5)}`;
    return createBucket(bucketStart, bucketEnd, label);
  });
}

function createBucket(start, end, label) {
  return {
    start,
    end,
    label,
    tasks: 0,
    completed: 0,
    failed: 0,
    pending: 0,
    events: 0,
    habitOccurrences: 0,
    habitCompleted: 0,
    habitFailed: 0,
    habitPending: 0,
  };
}

export function calculateStatistics(data, requestedPeriod = 'week', now = new Date()) {
  const period = Object.hasOwn(PERIODS, requestedPeriod) || requestedPeriod === 'year' ? requestedPeriod : 'week';
  const today = getTodayKey(now);
  const start = period === 'year'
    ? dateKey(new Date(Date.UTC(now.getFullYear(), now.getMonth() - 11, 1)))
    : shiftDateKey(today, -(PERIODS[period].days - 1));
  const buckets = createBuckets(period, start, today);
  const bucketFor = (key) => buckets.find((bucket) => key >= bucket.start && key <= bucket.end);

  const dueTasks = (data.tasks || []).filter((task) => isDateKey(task.date) && task.date >= start && task.date <= today);
  dueTasks.forEach((task) => {
    const bucket = bucketFor(task.date);
    if (!bucket) return;
    bucket.tasks += 1;
    if (task.completed) bucket.completed += 1;
    else if (task.failed) bucket.failed += 1;
    else bucket.pending += 1;
  });

  const events = (data.events || []).filter((event) => {
    const from = eventStart(event);
    const to = eventEnd(event);
    return isDateKey(from) && isDateKey(to) && from <= today && to >= start && to >= from;
  });
  events.forEach((event) => {
    const from = eventStart(event);
    const to = eventEnd(event);
    buckets.forEach((bucket) => {
      if (from <= bucket.end && to >= bucket.start) bucket.events += 1;
    });
  });

  const trackedHabits = getTrackedHabits({ tasks: data.tasks || [] });
  const schedules = calculateHabitSchedule(trackedHabits, start, daysBetweenInclusive(start, today));
  const completedLogKeys = new Set((data.habitLogs || [])
    .filter((log) => log?.completed && typeof log.habitId === 'string' && isDateKey(log.date))
    .map((log) => `${log.habitId}\u0000${log.date}`));
  schedules.forEach((schedule) => {
    schedule.occurrences.forEach((occurrence) => {
      const bucket = bucketFor(occurrence.date);
      if (!bucket) return;
      const key = `${schedule.habitId}\u0000${occurrence.date}`;
      // Logs are keyed by habit and date; a duplicate log must not inflate the count.
      const completed = completedLogKeys.has(key);
      const failed = !completed && Boolean(occurrence.failed);
      bucket.habitOccurrences += 1;
      if (completed) bucket.habitCompleted += 1;
      else if (failed) bucket.habitFailed += 1;
      else bucket.habitPending += 1;
    });
  });

  const categories = new Map();
  dueTasks.forEach((task) => {
    const name = task.category || '카테고리 없음';
    const color = /^#[\da-f]{6}$/i.test(task.categoryColor || '') ? task.categoryColor : '#EDEDED';
    const current = categories.get(name) || { name, color, count: 0, completed: 0 };
    current.count += 1;
    if (task.completed) current.completed += 1;
    categories.set(name, current);
  });

  const completed = dueTasks.filter((task) => task.completed).length;
  const failed = dueTasks.filter((task) => !task.completed && task.failed).length;
  const pending = dueTasks.length - completed - failed;
  const habitCompleted = buckets.reduce((sum, bucket) => sum + bucket.habitCompleted, 0);
  const habitFailed = buckets.reduce((sum, bucket) => sum + bucket.habitFailed, 0);
  const habitOccurrences = buckets.reduce((sum, bucket) => sum + bucket.habitOccurrences, 0);
  const habitPending = habitOccurrences - habitCompleted - habitFailed;
  return {
    period,
    periodLabel: period === 'year' ? '최근 12개월' : PERIODS[period].label,
    start,
    end: today,
    buckets,
    totals: { tasks: dueTasks.length, completed, failed, pending, events: events.length },
    completionRate: dueTasks.length ? Math.round((completed / dueTasks.length) * 100) : null,
    habits: {
      tracked: trackedHabits.length,
      occurrences: habitOccurrences,
      completed: habitCompleted,
      failed: habitFailed,
      pending: habitPending,
      completionRate: habitOccurrences ? Math.round((habitCompleted / habitOccurrences) * 100) : null,
    },
    categories: [...categories.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko')).slice(0, 6),
  };
}
