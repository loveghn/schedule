import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTodo } from './todo.js';

const STORAGE_KEY = 'my-schedule-data';
const emptyData = (overrides = {}) => ({
  version: 1,
  events: [], tasks: [], inbox: [], habits: [], habitLogs: [], activities: [], categories: [], settings: {},
  ...overrides,
});

function withBrowserData(data, hash, run) {
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  let raw = JSON.stringify(data);
  globalThis.localStorage = {
    getItem: (key) => key === STORAGE_KEY ? raw : null,
    setItem: (key, value) => { if (key === STORAGE_KEY) raw = value; },
  };
  globalThis.window = { location: { hash } };
  try {
    return run();
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

test('To-do page renders the two tabs and selects the To-do list by default', () => {
  withBrowserData(emptyData(), '', () => {
    const html = renderTodo();
    assert.match(html, /id="todo-tab-tasks"[^>]*aria-selected="true"/);
    assert.match(html, /id="todo-tab-inbox"[^>]*aria-selected="false"/);
    assert.match(html, /MY TASKS/);
  });
});

test('Inbox tab renders editable, deletable, and convertible Inbox entries', () => {
  const item = {
    id: 'inbox-1', text: '<빠른 메모>',
    createdAt: '2026-11-06T01:00:00.000Z', updatedAt: '2026-11-06T01:00:00.000Z',
  };
  withBrowserData(emptyData({ inbox: [item] }), '#inbox', () => {
    const html = renderTodo();
    assert.match(html, /id="todo-tab-inbox"[^>]*aria-selected="true"/);
    assert.match(html, /&lt;빠른 메모&gt;/);
    assert.match(html, /data-inbox-convert="inbox-1"/);
    assert.match(html, /data-inbox-edit="inbox-1"/);
    assert.match(html, /data-inbox-delete="inbox-1"/);
  });
});
