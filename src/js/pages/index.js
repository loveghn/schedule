import { renderOverview } from './overview.js';
import { renderTodo } from './todo.js';
import { renderCalendar } from './calendar.js';
import { renderActivity } from './activity.js';
import { renderHabits } from './habits.js';
import { renderSettings } from './settings.js';
import { renderStatistics } from './statistics.js';

export const pages = {
  overview: renderOverview,
  calendar: renderCalendar,
  todo: renderTodo,
  activity: renderActivity,
  habits: renderHabits,
  statistics: renderStatistics,
  settings: renderSettings,
};
