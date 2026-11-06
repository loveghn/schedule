// ========================================
// LOCAL STORAGE
// MY SCHEDULE
// ========================================

const STORAGE_KEY = 'my-schedule-data';
const DATA_VERSION = 1;

let storageStatus = 'unknown';
let corruptRawData = null;

export class DataIntegrityError extends Error {
  constructor(message = '저장된 데이터가 손상되었습니다.') {
    super(message);
    this.name = 'DataIntegrityError';
  }
}

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
    !Array.isArray(value) &&
    Array.isArray(value.events) &&
    Array.isArray(value.tasks) &&
    Array.isArray(value.habits) &&
    Array.isArray(value.habitLogs) &&
    Array.isArray(value.activities) &&
    ['events', 'tasks', 'habits', 'habitLogs', 'activities'].every((key) =>
      value[key].every((item) => item && typeof item === 'object' && !Array.isArray(item)),
    ) &&
    (value.inbox === undefined || (Array.isArray(value.inbox) && value.inbox.every(isValidInboxItem))) &&
    (value.categories === undefined || (Array.isArray(value.categories) && value.categories.every((item) => item && typeof item === 'object' && !Array.isArray(item)))) &&
    (value.settings === undefined || (value.settings && typeof value.settings === 'object' && !Array.isArray(value.settings)))
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

function readStoredValue() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    storageStatus = 'unavailable';
    throw new Error('브라우저 저장소에 접근할 수 없습니다.', { cause: error });
  }

  if (raw === null) {
    storageStatus = 'missing';
    corruptRawData = null;
    return { status: 'missing', raw: null, data: null };
  }

  try {
    const data = JSON.parse(raw);
    if (!isValidData(data)) throw new DataIntegrityError('저장된 데이터 필드가 올바르지 않습니다.');
    storageStatus = 'ready';
    corruptRawData = null;
    return { status: 'ready', raw, data };
  } catch (error) {
    storageStatus = 'corrupt';
    corruptRawData = raw;
    return { status: 'corrupt', raw, data: null, error };
  }
}

export function getData() {
  const stored = readStoredValue();
  if (stored.status === 'corrupt') {
    console.error('[MY SCHEDULE] 데이터 읽기 실패:', stored.error);
    throw new DataIntegrityError();
  }
  if (stored.status === 'missing') {
    const initialData = createEmptyData();
    saveData(initialData);
    return initialData;
  }

  return {
    ...createEmptyData(),
    ...stored.data,
    inbox: stored.data.inbox ?? [],
    version: DATA_VERSION,
  };
}

export function getStorageStatus() {
  try {
    const stored = readStoredValue();
    return { status: stored.status, raw: stored.status === 'corrupt' ? stored.raw : null };
  } catch (error) {
    return { status: 'unavailable', raw: null, error };
  }
}

export function getCorruptRawData() {
  const stored = readStoredValue();
  return stored.status === 'corrupt' ? stored.raw : corruptRawData;
}

function serializeData(data) {
  return JSON.stringify({ ...data, version: DATA_VERSION });
}

function writeData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, serializeData(data));
    storageStatus = 'ready';
    corruptRawData = null;
    return true;
  } catch (error) {
    console.error('[MY SCHEDULE] 데이터 저장 실패:', error);
    return false;
  }
}

export function saveData(data) {
  if (!isValidData(data)) {
    throw new TypeError('저장할 데이터 구조가 올바르지 않습니다.');
  }
  try {
    const current = readStoredValue();
    if (current.status === 'corrupt' || current.status === 'unavailable') return false;
    return writeData(data);
  } catch {
    return false;
  }
}

/** Explicit user-approved recovery path. The caller must validate and confirm the replacement. */
export function restoreData(data) {
  if (!isValidData(data)) throw new TypeError('복구할 데이터 구조가 올바르지 않습니다.');
  return writeData({ ...createEmptyData(), ...data, inbox: data.inbox ?? [] });
}

/** Explicit user-approved reset path. */
export function resetStoredData() {
  return writeData(createEmptyData());
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
