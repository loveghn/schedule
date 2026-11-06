import { createId, getData, isValidInboxItem, saveData } from './storage.js';

const normalizeText = (text) => {
  if (typeof text !== 'string') throw new TypeError('Inbox 내용은 문자열이어야 합니다.');
  const normalized = text.trim();
  if (!normalized) throw new TypeError('공백만 있는 Inbox 항목은 저장할 수 없습니다.');
  return normalized;
};

const createUniqueId = (items) => {
  let id = createId('inbox');
  while (items.some((item) => item.id === id)) id = createId('inbox');
  return id;
};

const saveOrThrow = (data) => {
  if (!saveData(data)) throw new Error('Inbox 데이터를 저장하지 못했습니다.');
};

export function getInboxItems() {
  return getData().inbox;
}

export function addInboxItem(text) {
  const data = getData();
  const normalizedText = normalizeText(text);
  const now = new Date().toISOString();
  const item = {
    id: createUniqueId(data.inbox),
    text: normalizedText,
    createdAt: now,
    updatedAt: now,
  };

  data.inbox.push(item);
  saveOrThrow(data);
  return item;
}

export function updateInboxItem(id, text) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('Inbox 항목 ID가 필요합니다.');
  const data = getData();
  const item = data.inbox.find((entry) => entry.id === id);
  if (!item) return null;

  item.text = normalizeText(text);
  item.updatedAt = new Date().toISOString();
  if (!isValidInboxItem(item)) throw new TypeError('수정한 Inbox 항목이 올바르지 않습니다.');
  saveOrThrow(data);
  return item;
}

export function deleteInboxItem(id) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('Inbox 항목 ID가 필요합니다.');
  const data = getData();
  const index = data.inbox.findIndex((item) => item.id === id);
  if (index < 0) return false;

  data.inbox.splice(index, 1);
  saveOrThrow(data);
  return true;
}

/** Add the newly created task and consume its Inbox source in the same data snapshot. */
export function convertInboxItemToTask(data, inboxId, task) {
  if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.inbox) || !task || typeof task !== 'object') {
    throw new TypeError('Inbox 전환 데이터가 올바르지 않습니다.');
  }
  const index = data.inbox.findIndex((item) => item.id === inboxId);
  if (index < 0) return false;

  data.tasks.push(task);
  data.inbox.splice(index, 1);
  return true;
}
