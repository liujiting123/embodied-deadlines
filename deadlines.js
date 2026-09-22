export function deadlineState(edition, now = Date.now()) {
  if (!edition.paperDeadline && edition.paperDeadlineDate) {
    // A date without a timezone has no exact countdown. Only mark it closed
    // once that calendar day has ended everywhere on Earth.
    return now > Date.parse(`${edition.paperDeadlineDate}T23:59:59-12:00`) ? 'closed' : 'date-only';
  }
  if (!edition.paperDeadline) return 'pending';
  return Date.parse(edition.paperDeadline) > now ? 'open' : 'closed';
}

export function selectEdition(conference, year = 'current', now = Date.now()) {
  const editions = [...conference.editions].sort((a, b) => a.year - b.year);
  if (year !== 'current') return editions.find(edition => edition.year === Number(year)) ?? null;
  const open = editions.filter(edition => ['open', 'date-only'].includes(deadlineState(edition, now)))
    .sort((a, b) => Date.parse(a.paperDeadline || a.paperDeadlineDate) - Date.parse(b.paperDeadline || b.paperDeadlineDate));
  if (open.length) return open[0];
  const newest = editions.at(-1);
  return newest ?? null;
}

export function countdown(deadline, now = Date.now()) {
  const remaining = Math.max(0, Math.floor((Date.parse(deadline) - now) / 1000));
  return { days: Math.floor(remaining / 86400), hours: Math.floor(remaining / 3600) % 24,
    minutes: Math.floor(remaining / 60) % 60, seconds: remaining % 60, expired: remaining === 0 };
}

export function formatDeadline(value, timezone = 'Asia/Shanghai') {
  if (!value) return '待公布';
  if (timezone === 'original') {
    const local = value.slice(0, 16).replace('T', ' ');
    const offset = value.slice(19);
    const zone = offset === '-12:00' ? 'AoE' : offset === 'Z' || offset === '+00:00' ? 'UTC' : `UTC${offset}`;
    return `${local} ${zone}`;
  }
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  const part = type => parts.find(p => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`;
}

export function getRows(conferences, state, now = Date.now()) {
  const query = (state.query ?? '').trim().toLowerCase();
  return conferences.filter(conference => state.backup || conference.priority !== 'backup')
    .filter(conference => state.category === 'all' || conference.category === state.category)
    .filter(conference => `${conference.series} ${conference.name}`.toLowerCase().includes(query))
    .map(conference => ({ conference, edition: selectEdition(conference, state.year, now) }))
    .filter(row => row.edition)
    .map(row => ({ ...row, status: deadlineState(row.edition, now) }))
    .filter(row => state.status === 'all' || row.status === state.status || (state.status === 'open' && row.status === 'date-only'))
    .sort((a, b) => {
      const order = { open: 0, 'date-only': 1, pending: 2, closed: 3 };
      if (a.status !== b.status) return order[a.status] - order[b.status];
      if (a.status === 'open') return Date.parse(a.edition.paperDeadline) - Date.parse(b.edition.paperDeadline);
      if (a.status === 'date-only') return a.edition.paperDeadlineDate.localeCompare(b.edition.paperDeadlineDate);
      if (a.status === 'closed') return Date.parse(b.edition.paperDeadline || b.edition.paperDeadlineDate) - Date.parse(a.edition.paperDeadline || a.edition.paperDeadlineDate);
      const am = a.conference.cycleMonths[0] ?? 13, bm = b.conference.cycleMonths[0] ?? 13;
      return am - bm || a.conference.series.localeCompare(b.conference.series);
    });
}
