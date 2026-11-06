import { getTodayKey } from './storage.js';

const PERIODS = {
  week: { days: 7, bucketSize: 1, label: '최근 7일' },
  month: { days: 30, bucketSize: 5, label: '최근 30일' },
};

const shiftDate = (date, amount) => {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + amount);
  return shifted;
};

const eventDate = (event) => event.startDate || event.date || '';

export function calculateStatistics(data, period = 'week', now = new Date()) {
  const today = getTodayKey(now);
  const isYear = period === 'year';
  const days = isYear ? 0 : PERIODS[period]?.days || PERIODS.week.days;
  const startDate = isYear
    ? new Date(now.getFullYear(), now.getMonth() - 11, 1)
    : shiftDate(new Date(`${today}T00:00:00`), -(days - 1));
  const start = getTodayKey(startDate);
  const buckets = isYear
    ? Array.from({ length: 12 }, (_, index) => {
      const date = new Date(startDate.getFullYear(), startDate.getMonth() + index, 1);
      const nextDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      return {
        start: getTodayKey(date),
        end: getTodayKey(nextDate),
        label: new Intl.DateTimeFormat('ko-KR', { month: 'short' }).format(date),
        tasks: 0, completed: 0, failed: 0, pending: 0, events: 0,
      };
    })
    : Array.from({ length: Math.ceil(days / (PERIODS[period]?.bucketSize || 1)) }, (_, index) => {
      const bucketSize = PERIODS[period]?.bucketSize || 1;
      const from = shiftDate(startDate, index * bucketSize);
      const to = shiftDate(startDate, Math.min(days - 1, (index + 1) * bucketSize - 1));
      return {
        start: getTodayKey(from),
        end: getTodayKey(to),
        label: bucketSize === 1
          ? new Intl.DateTimeFormat('ko-KR', { weekday: 'short' }).format(from)
          : `${Number(getTodayKey(from).slice(-2))}–${Number(getTodayKey(to).slice(-2))}`,
        tasks: 0, completed: 0, failed: 0, pending: 0, events: 0,
      };
    });

  const bucketFor = (date) => buckets.find((bucket) => date >= bucket.start && date <= bucket.end);
  const dueTasks = (data.tasks || []).filter((task) => task.date && task.date >= start && task.date <= today);
  dueTasks.forEach((task) => {
    const bucket = bucketFor(task.date);
    if (!bucket) return;
    bucket.tasks += 1;
    if (task.completed) bucket.completed += 1;
    else if (task.failed) bucket.failed += 1;
    else bucket.pending += 1;
  });

  const events = (data.events || []).filter((event) => {
    const date = eventDate(event);
    return date && date >= start && date <= today;
  });
  events.forEach((event) => {
    const bucket = bucketFor(eventDate(event));
    if (bucket) bucket.events += 1;
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
  return {
    period,
    periodLabel: isYear ? '최근 12개월' : PERIODS[period]?.label || PERIODS.week.label,
    start,
    end: today,
    buckets,
    totals: { tasks: dueTasks.length, completed, failed, pending, events: events.length },
    completionRate: dueTasks.length ? Math.round((completed / dueTasks.length) * 100) : null,
    categories: [...categories.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko')).slice(0, 6),
  };
}
