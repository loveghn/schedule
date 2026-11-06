import test from 'node:test';
import assert from 'node:assert/strict';
import { getData, getStorageStatus, resetStoredData, restoreData, saveData } from './storage.js';

const STORAGE_KEY = 'my-schedule-data';
const emptyData = () => ({
  version: 1, events: [], tasks: [], inbox: [], habits: [], habitLogs: [], activities: [], categories: [], settings: {},
});

function withLocalStorage(initialRaw, callback, { failWrites = false } = {}) {
  const previous = globalThis.localStorage;
  let raw = initialRaw;
  globalThis.localStorage = {
    getItem: (key) => key === STORAGE_KEY ? raw : null,
    setItem: (key, value) => {
      if (failWrites) throw new Error('quota exceeded');
      if (key === STORAGE_KEY) raw = String(value);
    },
  };
  try {
    callback(() => raw);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
}

test('first run creates an empty data store and normal reads and writes continue to work', () => {
  withLocalStorage(null, (readRaw) => {
    assert.equal(getStorageStatus().status, 'missing');
    assert.deepEqual(getData(), emptyData());
    assert.ok(readRaw());
    const data = getData();
    data.tasks.push({ id: 'task-1', title: '정상 저장' });
    assert.equal(saveData(data), true);
    assert.equal(getData().tasks[0].id, 'task-1');
  });
});

test('unparseable JSON is reported as corrupt and preserved against reads and ordinary writes', () => {
  const raw = '{broken json';
  withLocalStorage(raw, (readRaw) => {
    assert.equal(getStorageStatus().status, 'corrupt');
    assert.throws(() => getData(), /손상/);
    assert.equal(saveData(emptyData()), false);
    assert.equal(readRaw(), raw);
  });
});

test('missing required collections and malformed collection entries are treated as corruption', () => {
  for (const raw of [
    JSON.stringify({ ...emptyData(), tasks: undefined }),
    JSON.stringify({ ...emptyData(), tasks: [{ id: 'task-1' }, null] }),
    JSON.stringify({ ...emptyData(), inbox: [{ id: 'inbox-1', text: '필드 손상' }] }),
  ]) {
    withLocalStorage(raw, (readRaw) => {
      assert.equal(getStorageStatus().status, 'corrupt');
      assert.throws(() => getData(), /손상/);
      const incoming = { ...emptyData(), tasks: [{ id: 'new-task' }] };
      assert.equal(saveData(incoming), false);
      assert.equal(readRaw(), raw);
    });
  }
});

test('explicit backup restoration replaces corrupt data only after a valid replacement is supplied', () => {
  const raw = '{broken json';
  withLocalStorage(raw, (readRaw) => {
    const backup = { ...emptyData(), events: [{ id: 'event-restored' }], tasks: [{ id: 'task-restored' }] };
    assert.equal(restoreData(backup), true);
    assert.equal(getStorageStatus().status, 'ready');
    assert.equal(getData().events[0].id, 'event-restored');
    assert.equal(getData().tasks[0].id, 'task-restored');
    assert.notEqual(readRaw(), raw);
    assert.throws(() => restoreData({ tasks: [] }), /복구할 데이터 구조/);
  });
});

test('explicit reset is separate from normal reads and writes', () => {
  const raw = JSON.stringify({ ...emptyData(), tasks: [{ id: 'existing' }] });
  withLocalStorage(raw, () => {
    assert.equal(getData().tasks.length, 1);
    assert.equal(resetStoredData(), true);
    assert.deepEqual(getData().tasks, []);
  });
});

test('LocalStorage write failure leaves the previous stored data unchanged', () => {
  const raw = JSON.stringify({ ...emptyData(), tasks: [{ id: 'original' }] });
  withLocalStorage(raw, (readRaw) => {
    const data = getData();
    data.tasks.push({ id: 'new' });
    assert.equal(saveData(data), false);
    assert.equal(JSON.parse(readRaw()).tasks.length, 1);
  }, { failWrites: true });
});
