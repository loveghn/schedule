// ========================================
// LOCAL STORAGE
// MY SCHEDULE
// ========================================

const STORAGE_KEY = 'my-schedule-data';
const DATA_VERSION = 1;

function createEmptyData() {
  return {
    version: DATA_VERSION,
    events: [],
    tasks: [],
    inbox: [],
    habits: [],
    habitLogs: [],
    activities: [],
    categories: [],
    settings: {},
  };
}

function isValidData(value) {
  return (
    value &&
    typeof value === 'object' &&
    Array.isArray(value.events) &&
    Array.isArray(value.tasks) &&
    Array.isArray(value.habits) &&
    Array.isArray(value.habitLogs) &&
    Array.isArray(value.activities)
  );
}

export function isValidInboxItem(item) {
  return Boolean(
    item &&
    typeof item === 'object' &&
    !Array.isArray(item) &&
    typeof item.id === 'string' && item.id.trim() &&
    typeof item.text === 'string' && item.text.trim() &&
    typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt)) &&
    typeof item.updatedAt === 'string' && Number.isFinite(Date.parse(item.updatedAt))
  );
}

function normalizeInbox(value) {
  return Array.isArray(value) ? value.filter(isValidInboxItem) : [];
}

export function getData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      const initialData = createEmptyData();
      saveData(initialData);
      return initialData;
    }

    const parsed = JSON.parse(raw);

    if (!isValidData(parsed)) {
      throw new Error('저장된 데이터 구조가 올바르지 않습니다.');
    }

    return {
      ...createEmptyData(),
      ...parsed,
      inbox: normalizeInbox(parsed.inbox),
      version: DATA_VERSION,
    };
  } catch (error) {
    console.error('[MY SCHEDULE] 데이터 읽기 실패:', error);
    return createEmptyData();
  }
}

export function saveData(data) {
  if (!isValidData(data) || (data.inbox !== undefined && (!Array.isArray(data.inbox) || !data.inbox.every(isValidInboxItem)))) {
    throw new TypeError('저장할 데이터 구조가 올바르지 않습니다.');
  }

  const payload = {
    ...data,
    version: DATA_VERSION,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.error('[MY SCHEDULE] 데이터 저장 실패:', error);
    return false;
  }
}

export function updateData(updater) {
  if (typeof updater !== 'function') {
    throw new TypeError('updater 함수가 필요합니다.');
  }

  const currentData = getData();
  const nextData = updater(currentData);

  if (!nextData || !saveData(nextData)) {
    return false;
  }

  return true;
}

export function createId(prefix = 'item') {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getTodayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
