import test from 'node:test';
import assert from 'node:assert/strict';
import { addInboxItem, deleteInboxItem, getInboxItems, updateInboxItem } from './inbox.js';
import { getData, saveData } from './storage.js';

const STORAGE_KEY = 'my-schedule-data';

function withLocalStorage(initial, run) {
  const previousStorage = globalThis.localStorage;
  let raw = initial === undefined ? null : JSON.stringify(initial);
  globalThis.localStorage = {
    getItem: (key) => key === STORAGE_KEY ? raw : null,
    setItem: (key, value) => { if (key === STORAGE_KEY) raw = value; },
  };
  const readRaw = () => raw;
  const restore = () => {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  };
  try {
    const result = run(readRaw);
    if (result && typeof result.then === 'function') return result.finally(restore);
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

const legacyData = () => ({
  version: 1,
  events: [{ id: 'event-1', title: '기존 일정' }],
  tasks: [{ id: 'task-1', title: '기존 할 일' }],
  habits: [{ id: 'habit-1', name: '기존 습관' }],
  habitLogs: [],
  activities: [{ id: 'activity-1', title: '기존 활동' }],
  categories: [],
  settings: {},
});

test('legacy data without inbox loads with an empty inbox and preserves existing collections', () => {
  withLocalStorage(legacyData(), () => {
    const data = getData();
    assert.deepEqual(data.inbox, []);
    assert.equal(data.events[0].id, 'event-1');
    assert.equal(data.tasks[0].id, 'task-1');
    assert.equal(data.habits[0].id, 'habit-1');
    assert.equal(data.activities[0].id, 'activity-1');
  });
});

test('Inbox supports add, read, update and delete without changing unrelated data', async () => {
  await withLocalStorage(legacyData(), async () => {
    const first = addInboxItem('  빠른 메모  ');
    const second = addInboxItem('두 번째 항목');
    assert.match(first.id, /^inbox-/);
    assert.notEqual(first.id, second.id);
    assert.equal(first.text, '빠른 메모');
    assert.equal(first.createdAt, first.updatedAt);
    assert.deepEqual(getInboxItems().map(({ text }) => text), ['빠른 메모', '두 번째 항목']);

    await new Promise((resolve) => setTimeout(resolve, 3));
    const updated = updateInboxItem(first.id, '  수정된 메모  ');
    assert.equal(updated.text, '수정된 메모');
    assert.notEqual(updated.updatedAt, first.updatedAt);

    assert.equal(deleteInboxItem(first.id), true);
    assert.deepEqual(getInboxItems().map(({ id }) => id), [second.id]);
    assert.equal(deleteInboxItem('missing-id'), false);
    assert.equal(getData().tasks[0].id, 'task-1');
    assert.equal(getData().events[0].id, 'event-1');
  });
});

test('blank text is rejected without changing persisted data', () => {
  withLocalStorage(legacyData(), (readRaw) => {
    const before = readRaw();
    assert.throws(() => addInboxItem('  '), /공백만/);
    assert.equal(readRaw(), before);
  });
});

test('Inbox data remains available after reloading storage and is isolated from To-do tasks', () => {
  withLocalStorage(legacyData(), () => {
    const item = addInboxItem('새 메모');
    const reloaded = getData();
    assert.equal(reloaded.inbox[0].id, item.id);
    assert.equal(reloaded.tasks.length, 1);
    assert.equal(reloaded.tasks[0].id, 'task-1');
  });
});

test('invalid Inbox records are isolated on read and rejected on save without overwriting storage', () => {
  const data = { ...legacyData(), inbox: [{ id: 'bad', text: '유효하지 않은 항목' }] };
  withLocalStorage(data, (readRaw) => {
    const loaded = getData();
    assert.deepEqual(loaded.inbox, []);
    assert.equal(loaded.tasks[0].id, 'task-1');
    const before = readRaw();
    assert.throws(() => saveData({ ...loaded, inbox: [{ id: '', text: '' }] }), /저장할 데이터 구조/);
    assert.equal(readRaw(), before);
  });
});

test('failed LocalStorage writes leave the previous stored value untouched', () => {
  const previousStorage = globalThis.localStorage;
  const raw = JSON.stringify(legacyData());
  globalThis.localStorage = {
    getItem: () => raw,
    setItem: () => { throw new Error('quota exceeded'); },
  };
  try {
    assert.throws(() => addInboxItem('저장 실패 테스트'), /저장하지 못했습니다/);
    assert.equal(globalThis.localStorage.getItem(STORAGE_KEY), raw);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});
