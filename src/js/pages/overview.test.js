import test from 'node:test';
import assert from 'node:assert/strict';
import { getRecentInboxItems, renderOverview } from './overview.js';

const STORAGE_KEY = 'my-schedule-data';
const emptyData = () => ({
  version: 1,
  events: [], tasks: [], inbox: [], habits: [], habitLogs: [], activities: [], categories: [], settings: {},
});

function withData(data, run) {
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => key === STORAGE_KEY ? JSON.stringify(data) : null,
    setItem: () => {},
  };
  try {
    return run();
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
}

test('Inbox preview sorts newest first and shows no more than three entries', () => {
  const items = [1, 5, 3, 2, 4].map((day) => ({
    id: `inbox-${day}`,
    text: `메모 ${day}`,
    createdAt: `2026-11-0${day}T00:00:00.000Z`,
    updatedAt: `2026-11-0${day}T00:00:00.000Z`,
  }));
  assert.deepEqual(getRecentInboxItems(items).map((item) => item.text), ['메모 5', '메모 4', '메모 3']);
});

test('Dashboard shows Inbox count and recent preview separately from To-do data', () => {
  const inbox = [1, 2, 3, 4].map((day) => ({
    id: `inbox-${day}`,
    text: `캡처 ${day}`,
    createdAt: `2026-11-0${day}T00:00:00.000Z`,
    updatedAt: `2026-11-0${day}T00:00:00.000Z`,
  }));
  withData({ ...emptyData(), tasks: [{ id: 'task-1', title: 'To-do와 분리' }], inbox }, () => {
    const html = renderOverview();
    assert.match(html, /overview-inbox__count[\s\S]*?<strong>4<\/strong>/);
    assert.ok(html.indexOf('캡처 4') < html.indexOf('캡처 3'));
    assert.ok(html.indexOf('캡처 3') < html.indexOf('캡처 2'));
    assert.equal(html.includes('캡처 1'), false);
    assert.match(html, /빠른 기록/);
    assert.doesNotMatch(html, /전체 Inbox 보기/);
  });
});

test('Dashboard shows an empty Inbox state when there are no captured entries', () => {
  withData(emptyData(), () => {
    const html = renderOverview();
    assert.match(html, /아직 미분류 항목이 없습니다\./);
    assert.match(html, /overview-inbox__count[\s\S]*?<strong>0<\/strong>/);
  });
});
