import { createId } from './storage.js';

const LEGACY_COLOR_MAP = {
  yellow: '#FFD200', red: '#FF5B58', cyan: '#00C3FF', pink: '#FF4EFF',
  green: '#00E43D', indigo: '#6B5CFF', muted: '#EDEDED', black: '#000000', white: '#FFFFFF',
  work: '#00C3FF', personal: '#FF4EFF', learning: '#FFD200', health: '#00E43D', other: '#EDEDED',
};

const LEGACY_CATEGORIES = [
  { name: '업무', color: '#00C3FF' },
  { name: '개인', color: '#FF4EFF' },
  { name: '학습', color: '#FFD200' },
  { name: '건강', color: '#00E43D' },
  { name: '기타', color: '#EDEDED' },
];

export function normalizeColorCode(value) {
  if (typeof value !== 'string') return '';
  if (/^#[\da-f]{6}$/i.test(value)) return value.toUpperCase();
  return LEGACY_COLOR_MAP[value] || '';
}

export function isHexColor(value) {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
}

export function ensureSettings(data) {
  let changed = false;
  if (!Array.isArray(data.categories)) { data.categories = []; changed = true; }
  if (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) { data.settings = {}; changed = true; }

  if (!data.settings.categoriesInitialized) {
    LEGACY_CATEGORIES.forEach((legacy) => {
      if (!data.categories.some((category) => category?.name === legacy.name)) {
        data.categories.push({ id: createId('category'), ...legacy, createdAt: new Date().toISOString() });
        changed = true;
      }
    });
    data.tasks.forEach((task) => {
      if (!task.category || data.categories.some((category) => category?.name === task.category)) return;
      const color = normalizeColorCode(task.categoryColor) || '#EDEDED';
      data.categories.push({ id: createId('category'), name: task.category, color, createdAt: new Date().toISOString() });
      changed = true;
    });
    data.settings.categoriesInitialized = true;
    changed = true;
  }

  data.categories.forEach((category) => {
    if (!category.id) { category.id = createId('category'); changed = true; }
    const normalizedColor = normalizeColorCode(category.color) || '#EDEDED';
    if (category.color !== normalizedColor) { category.color = normalizedColor; changed = true; }
  });

  data.tasks.forEach((task) => {
    if (!task.category) return;
    const category = data.categories.find((item) => item.name === task.category);
    if (category && task.categoryColor !== category.color) {
      task.categoryColor = category.color;
      changed = true;
    }
  });

  if (!data.settings.taskDefaults || typeof data.settings.taskDefaults !== 'object') {
    data.settings.taskDefaults = { priority: 'normal', category: '' };
    changed = true;
  } else {
    const defaults = data.settings.taskDefaults;
    if (!['high', 'normal', 'low'].includes(defaults.priority)) { defaults.priority = 'normal'; changed = true; }
    if (typeof defaults.category !== 'string') { defaults.category = ''; changed = true; }
    if (defaults.category && !data.categories.some((category) => category.name === defaults.category)) { defaults.category = ''; changed = true; }
  }

  return changed;
}
