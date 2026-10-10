'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { buildSummary, fillRate } = require('../src/summary');

const rows = [
  { id: 1, title: 'A', event_date: '2026-11-01 09:00:00', max_participants: 2, approved: '2', pending: '1', rejected: '0' },
  { id: 2, title: 'B', event_date: '2026-11-02 09:00:00', max_participants: 10, approved: '1', pending: '0', rejected: '1' },
];

test('fill rate is a rounded percentage', () => {
  assert.strictEqual(fillRate(1, 3), 33);
  assert.strictEqual(fillRate(0, 0), 0);
});

test('summary totals, full events, and most popular event', () => {
  const s = buildSummary(rows, 7);
  assert.deepStrictEqual(s.totals, { events: 2, users: 7, registrations: 5, approved: 3, pending: 1, rejected: 1, full_events: 1 });
  assert.strictEqual(s.most_popular.title, 'A');
  assert.strictEqual(s.events[0].is_full, true);
});
