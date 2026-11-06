import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackupPayload, isValidBackup, normalizeImportedData } from './settings.js';

const baseBackupData = () => ({
  version: 1,
  events: [{ id: 'event-1' }],
  tasks: [{ id: 'task-1' }],
  habits: [{ id: 'habit-1' }],
  habitLogs: [{ id: 'log-1' }],
  activities: [{ id: 'activity-1' }],
  categories: [],
  settings: {},
});

test('backup payload includes Inbox alongside existing data', () => {
  const data = { ...baseBackupData(), inbox: [{ id: 'inbox-1', text: '메모', createdAt: '2026-11-06T00:00:00.000Z', updatedAt: '2026-11-06T00:00:00.000Z' }] };
  const backup = createBackupPayload(data);
  assert.equal(backup.app, 'MY SCHEDULE');
  assert.deepEqual(backup.data.inbox, data.inbox);
  assert.deepEqual(backup.data.tasks, data.tasks);
});

test('legacy backup without Inbox remains valid and normalizes Inbox to empty', () => {
  const legacy = baseBackupData();
  assert.equal(isValidBackup(legacy), true);
  const normalized = normalizeImportedData(legacy);
  assert.deepEqual(normalized.inbox, []);
  assert.deepEqual(normalized.events, legacy.events);
  assert.deepEqual(normalized.tasks, legacy.tasks);
  assert.deepEqual(normalized.habits, legacy.habits);
  assert.deepEqual(normalized.activities, legacy.activities);
});

test('backup import accepts valid Inbox entries and preserves additional data fields', () => {
  const backup = {
    app: 'MY SCHEDULE',
    data: {
      ...baseBackupData(),
      inbox: [{ id: 'inbox-1', text: ' 메모 ', createdAt: '2026-11-06T00:00:00.000Z', updatedAt: '2026-11-06T00:00:00.000Z' }],
      futureData: { retained: true },
    },
  };
  assert.equal(isValidBackup(backup), true);
  const normalized = normalizeImportedData(backup.data);
  assert.deepEqual(normalized.inbox, backup.data.inbox);
  assert.deepEqual(normalized.futureData, { retained: true });
});

test('backup import rejects malformed Inbox data instead of replacing existing data', () => {
  const malformed = { ...baseBackupData(), inbox: [{ id: 'inbox-1', text: '제목만 있고 시간 필드 누락' }] };
  assert.equal(isValidBackup(malformed), false);
});
