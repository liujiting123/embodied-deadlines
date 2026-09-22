import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { countdown, deadlineState, formatDeadline, getRows, selectEdition } from '../deadlines.js';

const data = JSON.parse(readFileSync(new URL('../data/conferences.json', import.meta.url)));
const now = Date.parse('2026-09-23T02:30:00+08:00');
const defaults = { category: 'all', year: 'current', status: 'all', backup: false, query: '' };

test('AoE converts to the following evening in Beijing without using the machine timezone', () => {
  const deadline = '2026-09-25T23:59:59-12:00';
  assert.equal(formatDeadline(deadline, 'Asia/Shanghai'), '2026-09-26 19:59');
  assert.equal(formatDeadline(deadline, 'UTC'), '2026-09-26 11:59');
  assert.equal(formatDeadline(deadline, 'original'), '2026-09-25 23:59 AoE');
  assert.equal(formatDeadline('2026-03-05T23:00:00+01:00', 'Asia/Shanghai'), '2026-03-06 06:00');
});

test('current cycle keeps the open edition and switches to the next after the deadline', () => {
  const iclr = data.conferences.find(item => item.series === 'ICLR');
  assert.equal(selectEdition(iclr, 'current', now).year, 2027);
  assert.equal(selectEdition(iclr, 'current', Date.parse('2026-09-26T12:00:00Z')).year, 2028);
  assert.equal(selectEdition(iclr, '2026', now), null);
});

test('date-only deadlines do not invent a time and expired dates are classified as closed', () => {
  const edition = { paperDeadline: null, paperDeadlineDate: '2027-03-01' };
  assert.equal(deadlineState(edition, now), 'date-only');
  assert.equal(deadlineState(edition, Date.parse('2027-03-02T12:00:00Z')), 'closed');
  assert.equal(deadlineState({ paperDeadline: null }, now), 'pending');
});

test('11 followed series and 2 opt-in backups stay separate, with meaningful filtering', () => {
  const rows = getRows(data.conferences, defaults, now);
  assert.equal(rows.length, 11);
  assert.equal(rows[0].conference.series, 'ICLR');
  assert.equal(rows[1].conference.series, 'CVPR');
  assert.equal(getRows(data.conferences, { ...defaults, backup: true }, now).length, 13);
  assert.equal(getRows(data.conferences, { ...defaults, query: 'corl' }, now)[0].conference.series, 'CoRL');
  assert.equal(getRows(data.conferences, { ...defaults, category: 'RO' }, now).length, 4);
  assert.equal(getRows(data.conferences, { ...defaults, status: 'open' }, now).length, 3);
});

test('countdown never becomes negative after expiry', () => {
  assert.deepEqual(countdown('2026-09-23T00:00:00Z', Date.parse('2026-09-22T22:58:59Z')), { days: 0, hours: 1, minutes: 1, seconds: 1, expired: false });
  assert.deepEqual(countdown('2026-01-01T00:00:00Z', now), { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
});

test('published data uses explicit offsets and preserves the 2026 CCF revision', () => {
  assert.equal(new Set(data.conferences.map(item => item.series)).size, 13);
  for (const conference of data.conferences) {
    assert.ok([null, 'A', 'B', 'C'].includes(conference.ccf));
    assert.ok(conference.cycleMonths.every(month => Number.isInteger(month) && month >= 1 && month <= 12));
    for (const edition of conference.editions) {
      assert.ok(edition.sourceUrl.startsWith('https://'));
      for (const field of ['paperDeadline', 'abstractDeadline']) {
        if (!edition[field]) continue;
        assert.match(edition[field], /T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/);
        assert.ok(Number.isFinite(Date.parse(edition[field])));
      }
      if (edition.abstractDeadline && edition.paperDeadline) assert.ok(Date.parse(edition.abstractDeadline) <= Date.parse(edition.paperDeadline));
    }
  }
  const grades = Object.fromEntries(data.conferences.map(item => [item.series, item.ccf]));
  assert.equal(grades.ICLR, 'A');
  assert.equal(grades.IJCAI, 'B');
  assert.equal(grades.RSS, null);
});
