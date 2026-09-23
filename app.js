import { countdown, deadlineState, formatDeadline, getRows, selectEdition } from './deadlines.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const safeUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' ? escape(url.href) : '#'; } catch { return '#'; } };
const categoryNames = { RO: '机器人', ML: '机器学习', CV: '计算机视觉', CG: '图形与仿真', AI: '综合 AI' };
const params = new URLSearchParams(location.search);
const initialYear = params.get('year');
const state = { section: params.get('tab') === 'journals' ? 'journals' : 'conferences',
  category: ['RO', 'ML', 'CV', 'CG', 'AI'].includes(params.get('sub')) ? params.get('sub') : 'all',
  year: initialYear && /^20\d\d$/.test(initialYear) ? initialYear : 'current',
  status: ['open', 'pending', 'closed'].includes(params.get('status')) ? params.get('status') : 'all',
  timezone: 'Asia/Shanghai', backup: params.get('backup') === '1', query: '', view: 'list' };
if (state.category === 'AI') state.backup = true;
let data;
let journalData;
const journalState = { category: 'all', query: '' };
let lastStateSignature = '';

function link(url, label, className = '') {
  return `<a class="${className}" href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function dateRange(edition) {
  if (!edition.conferenceStart) return edition.location || '会期待核实';
  const start = edition.conferenceStart.replaceAll('-', '.');
  const end = edition.conferenceEnd ? edition.conferenceEnd.slice(5).replace('-', '.') : '';
  return `${start}${end ? `–${end}` : ''}${edition.location ? ` · ${edition.location}` : ''}`;
}

function renderCard({ conference, edition, status }, now) {
  const days = edition.paperDeadline ? countdown(edition.paperDeadline, now).days : null;
  const grade = conference.ccf;
  const badge = grade ? `CCF ${escape(grade)}` : 'CCF 未收录';
  const tier = conference.priority === 'backup' ? '<span class="badge tier-badge">备选</span>' : conference.priority === 'emerging' ? '<span class="badge tier-badge">新兴</span>' : '';
  const previous = conference.editions.filter(item => item.year < edition.year && item.paperDeadline).sort((a, b) => b.year - a.year)[0];
  const abstractClosed = status === 'open' && edition.abstractDeadline && Date.parse(edition.abstractDeadline) <= now;
  let dates = '';
  if (edition.paperDeadline) {
    dates = `<div class="deadline-row"><span class="deadline-label">全文</span><time datetime="${escape(edition.paperDeadline)}">${escape(formatDeadline(edition.paperDeadline, state.timezone))}</time></div>`;
    if (edition.abstractDeadline) dates += `<div class="deadline-row abstract"><span class="deadline-label">摘要 / 注册</span><time datetime="${escape(edition.abstractDeadline)}">${escape(formatDeadline(edition.abstractDeadline, state.timezone))}</time></div>`;
    dates += `<p class="date-context">${state.timezone === 'original' ? '以上为官方原始时间' : state.timezone === 'UTC' ? '以上为 UTC 时间' : '以上为北京时间（UTC+8）'}</p>`;
    if (abstractClosed) dates += '<p class="abstract-warning">摘要 / 注册已截止，仅已登记稿件可继续。</p>';
  } else if (edition.paperDeadlineDate) {
    dates = `<div class="deadline-row"><span class="deadline-label">全文</span><time datetime="${escape(edition.paperDeadlineDate)}">${escape(edition.paperDeadlineDate)}</time></div><p class="date-context">官方已公布日期，具体时刻和时区待核实。</p>`;
  } else {
    dates = `<div class="deadline-row"><span>本届截稿日期待公布</span></div><p class="date-context">往届节奏：${conference.cycleMonths.map(month => `${month} 月`).join(' / ')}投稿</p>`;
    if (previous) dates += `<p class="date-context">${previous.year} 届全文：${escape(formatDeadline(previous.paperDeadline, 'original'))}</p>`;
  }
  if (edition.note && status !== 'pending' && !edition.paperDeadlineDate) dates += `<p class="date-context">${escape(edition.note)}</p>`;
  dates += link(edition.sourceUrl || edition.website, '官方日期来源 ↗', 'source-link');
  const countdownHtml = status === 'open' ? `<span class="countdown-label">距全文截止</span><span class="countdown-value"><strong data-days></strong><em>天</em></span><span class="countdown-clock" data-clock></span>` : `<span class="status-text">${status === 'pending' ? '日期待公布' : status === 'date-only' ? '时刻待核实' : '本届已截止'}</span><p class="status-caption">${status === 'closed' ? '可查看下一届安排' : '暂不显示倒计时'}</p>`;
  return `<article class="conference-card ${status}${status === 'open' && days < 7 ? ' urgent' : ''}" data-series="${escape(conference.series)}" data-status="${status}">
    <div class="card-info"><div class="card-title"><h2>${link(edition.website, `${escape(conference.series)}<span class="edition-year">${edition.year}</span>`)}</h2>${link(data.ccfSource, `<span class="badge ccf-${grade ? grade.toLowerCase() : 'none'}" title="${escape(data.ccfVersion)}">${badge}</span>`)}${tier}</div><p class="full-name">${escape(conference.name)}${conference.scope ? `<br>${escape(conference.scope)}` : ''}</p><div class="card-meta"><span class="category-tag">${escape(conference.category)} · ${escape(categoryNames[conference.category])}</span><span class="meta-separator">/</span><span>${escape(dateRange(edition))}</span></div></div>
    <div class="card-date">${dates}</div><div class="card-countdown" ${status === 'open' ? `data-deadline="${escape(edition.paperDeadline)}"` : ''}>${countdownHtml}</div></article>`;
}

function updateCountdowns(now = Date.now()) {
  document.querySelectorAll('[data-deadline]').forEach(element => {
    const remaining = countdown(element.dataset.deadline, now);
    element.querySelector('[data-days]').textContent = remaining.days;
    element.querySelector('[data-clock]').textContent = [remaining.hours, remaining.minutes, remaining.seconds].map(part => String(part).padStart(2, '0')).join(' : ');
  });
}

function renderRhythm() {
  const conferences = data.conferences.filter(item => state.backup || item.priority !== 'backup')
    .filter(item => state.category === 'all' || item.category === state.category)
    .filter(item => `${item.series} ${item.name}`.toLowerCase().includes(state.query.trim().toLowerCase()));
  $('#rhythm').innerHTML = '<p class="rhythm-intro">按往届全文截稿月份规划全年；这里不代表下一届的确定日期，年份和投稿状态筛选仅作用于截止列表。</p><div class="month-grid">' + Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const items = conferences.filter(item => item.cycleMonths.includes(month));
    return `<article class="month-card"><h2 class="month-title"><strong>${String(month).padStart(2, '0')}</strong>月</h2><div class="month-pills">${items.length ? items.map(item => `<span class="month-pill">${escape(item.series)}</span>`).join('') : '<span class="month-empty">暂无常规截稿</span>'}</div></article>`;
  }).join('') + '</div>';
}

function render() {
  if (!data) return;
  const now = Date.now();
  const rows = getRows(data.conferences, state, now);
  const sections = [{ status: 'open', label: '尚未截止' }, { status: 'date-only', label: '已公布日期 · 时刻待核实' }, { status: 'pending', label: '等待新一届日期' }, { status: 'closed', label: '已截止' }];
  $('#results').innerHTML = rows.length ? sections.map(section => {
    const items = rows.filter(row => row.status === section.status);
    return items.length ? `<h2 class="section-label">${section.label}<span>${items.length}</span></h2>${items.map(row => renderCard(row, now)).join('')}` : '';
  }).join('') : '<div class="empty"><strong>没有符合条件的会议</strong>试试切换年份、方向或投稿状态。<br><button id="reset-filters">重置筛选</button></div>';
  $('#reset-filters')?.addEventListener('click', () => { Object.assign(state, { category: 'all', year: 'current', status: 'all', query: '' }); syncControls(); render(); });
  $('#result-count').textContent = state.view === 'list' ? `${rows.length} 个会议轮次 · 按状态与全文截止排序` : '12 个月 · 往届投稿节奏';
  const followed = data.conferences.filter(item => state.backup || item.priority !== 'backup');
  const upcoming = followed.map(item => ({ conference: item, edition: selectEdition(item, 'current', now) }))
    .filter(row => row.edition && ['open', 'date-only'].includes(deadlineState(row.edition, now)))
    .sort((a, b) => Date.parse(a.edition.paperDeadline || a.edition.paperDeadlineDate) - Date.parse(b.edition.paperDeadline || b.edition.paperDeadlineDate));
  $('#series-count').textContent = followed.length;
  $('#followed-note').textContent = state.backup ? '含 2 个备选会议' : '核心会议 + RLC';
  $('#soon-count').textContent = upcoming.filter(row => Date.parse(row.edition.paperDeadline || row.edition.paperDeadlineDate) - now <= 90 * 86400000).length;
  const next = upcoming[0];
  $('#next-conference').textContent = next ? `${next.conference.series} ${next.edition.year}` : '等待新日期';
  $('#next-date').textContent = next ? next.edition.paperDeadline ? formatDeadline(next.edition.paperDeadline, state.timezone) : `${next.edition.paperDeadlineDate} · 时刻待核实` : '已公布轮次均已截止';
  $('#today-label').textContent = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric' }).format(now);
  if (state.section === 'conferences') $('#verified-label').textContent = `日期核对 ${data.updatedAt}`;
  $('#ccf-note').innerHTML = `分级依据${link(data.ccfSource, escape(data.ccfVersion))}；“未收录”不等于 C 类，也不代表学术质量评价。`;
  $('#results').hidden = state.view !== 'list';
  $('#rhythm').hidden = state.view !== 'rhythm';
  renderRhythm();
  updateCountdowns(now);
  lastStateSignature = stateSignature(now);
  const url = new URL(location.href);
  for (const key of ['sub', 'year', 'status', 'backup']) url.searchParams.delete(key);
  if (state.category !== 'all') url.searchParams.set('sub', state.category);
  if (state.year !== 'current') url.searchParams.set('year', state.year);
  if (state.status !== 'all') url.searchParams.set('status', state.status);
  if (state.backup) url.searchParams.set('backup', '1');
  history.replaceState(null, '', url);
}

function stateSignature(now) {
  return data.conferences.map(conference => conference.editions.map(edition => `${deadlineState(edition, now)}:${edition.abstractDeadline && Date.parse(edition.abstractDeadline) <= now}`).join('|')).join(';');
}

function syncControls() {
  $('#year').value = state.year; $('#status').value = state.status; $('#timezone').value = state.timezone;
  $('#search').value = state.query; $('#show-backup').checked = state.backup;
  document.querySelector('[data-category="AI"]').hidden = !state.backup;
  document.querySelectorAll('[data-category]').forEach(button => { const active = button.dataset.category === state.category; button.classList.toggle('active', active); button.setAttribute('aria-pressed', active); });
  document.querySelectorAll('[data-view]').forEach(button => { const active = button.dataset.view === state.view; button.classList.toggle('active', active); button.setAttribute('aria-pressed', active); });
}

function activateSection(section) {
  state.section = section;
  const journals = section === 'journals';
  $('#conference-panel').hidden = journals;
  $('#journal-panel').hidden = !journals;
  document.querySelectorAll('[data-section]').forEach(button => {
    const active = button.dataset.section === section;
    button.setAttribute('aria-selected', active);
    button.tabIndex = active ? 0 : -1;
  });
  $('.skip-link').href = journals ? '#journal-results' : '#results';
  $('.skip-link').textContent = journals ? '跳至期刊列表' : '跳至会议列表';
  $('#data-link').href = `https://github.com/liujiting123/embodied-deadlines/blob/main/data/${journals ? 'journals' : 'conferences'}.json`;
  const activeData = journals ? journalData : data;
  $('#verified-label').textContent = activeData ? `${journals ? '资料' : '日期'}核对 ${activeData.updatedAt}` : `正在载入${journals ? '期刊' : '会议'}数据`;
  const url = new URL(location.href);
  if (journals) url.searchParams.set('tab', 'journals');
  else url.searchParams.delete('tab');
  history.replaceState(null, '', url);
}

function renderJournals() {
  if (!journalData) return;
  const query = journalState.query.trim().toLowerCase();
  const journals = journalData.journals.filter(journal => journalState.category === 'all' || journal.categories.includes(journalState.category))
    .filter(journal => `${journal.acronym} ${journal.name} ${journal.scope}`.toLowerCase().includes(query));
  $('#journal-count').textContent = `${journals.length} 本期刊 · 共关注 ${journalData.journals.length} 本`;
  $('#journal-results').innerHTML = journals.length ? journals.map(journal => {
    const grade = journal.ccf;
    return `<article class="journal-card" data-journal="${escape(journal.id)}">
      <div class="journal-card-top"><h2>${link(journal.website, escape(journal.acronym))}</h2>${link(journalData.ccfSource, `<span class="badge ccf-${grade ? grade.toLowerCase() : 'none'}" title="${escape(journalData.ccfVersion)}">${grade ? `CCF ${escape(grade)}` : 'CCF 未收录'}</span>`)}</div>
      <p class="journal-name">${escape(journal.name)}</p><div class="journal-categories">${journal.categories.map(category => `<span class="category-tag">${escape(categoryNames[category])}</span>`).join('<span class="meta-separator"> / </span>')}</div>
      <p class="journal-scope">${escape(journal.scope)}</p>
      <div class="journal-submission"><span>常规投稿</span><strong>${escape(journal.submissionMode)}</strong></div>
      <p class="journal-note">${escape(journal.note)}</p>
      <div class="journal-links">${link(journal.authorGuide, '投稿与作者指南 ↗')}${journal.presentationGuide ? link(journal.presentationGuide, '会议展示规则 ↗') : link(journal.website, '期刊官网 ↗')}</div>
    </article>`;
  }).join('') : '<div class="empty"><strong>没有符合条件的期刊</strong>试试更换方向或关键词。<br><button id="reset-journals">重置筛选</button></div>';
  $('#reset-journals')?.addEventListener('click', () => {
    journalState.category = 'all'; journalState.query = ''; $('#journal-search').value = '';
    syncJournalFilters(); renderJournals();
  });
  $('#journal-ccf-note').innerHTML = `分级依据${link(journalData.ccfSource, escape(journalData.ccfVersion))}；“未收录”不等于 C 类，也不代表学术质量评价。`;
  if (state.section === 'journals') $('#verified-label').textContent = `资料核对 ${journalData.updatedAt}`;
}

function syncJournalFilters() {
  document.querySelectorAll('[data-journal-category]').forEach(button => {
    const active = button.dataset.journalCategory === journalState.category;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', active);
  });
}

async function loadJournals() {
  try {
    const response = await fetch('./data/journals.json');
    if (!response.ok) throw new Error(`Journal data request failed: ${response.status}`);
    journalData = await response.json(); renderJournals();
  } catch (error) {
    console.error(error);
    $('#journal-results').innerHTML = '<div class="error"><strong>期刊数据暂时无法载入</strong>请检查网络后 <button id="retry-journals">重新载入</button>。</div>';
    $('#journal-count').textContent = '期刊数据载入失败';
    $('#retry-journals').addEventListener('click', loadJournals);
  }
}

document.querySelectorAll('[data-section]').forEach(button => {
  button.addEventListener('click', () => activateSection(button.dataset.section));
  button.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const section = event.key === 'Home' ? 'conferences' : event.key === 'End' ? 'journals' : state.section === 'conferences' ? 'journals' : 'conferences';
    activateSection(section); document.querySelector(`[data-section="${section}"]`).focus();
  });
});
document.querySelectorAll('[data-journal-category]').forEach(button => button.addEventListener('click', () => {
  journalState.category = button.dataset.journalCategory; syncJournalFilters(); renderJournals();
}));
$('#journal-search').addEventListener('input', event => { journalState.query = event.target.value; renderJournals(); });

document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => { state.category = button.dataset.category; syncControls(); render(); }));
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { state.view = button.dataset.view; syncControls(); render(); }));
for (const id of ['year', 'status', 'timezone']) $(`#${id}`).addEventListener('change', event => { state[id] = event.target.value; render(); });
$('#search').addEventListener('input', event => { state.query = event.target.value; render(); });
$('#show-backup').addEventListener('change', event => { state.backup = event.target.checked; if (!state.backup && state.category === 'AI') state.category = 'all'; syncControls(); render(); });

async function load() {
  try {
    const response = await fetch('./data/conferences.json');
    if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
    data = await response.json();
    const years = [...new Set(data.conferences.flatMap(conference => conference.editions.map(edition => edition.year)))].sort((a, b) => b - a);
    $('#year').innerHTML = '<option value="current">当前投稿轮次</option>' + years.map(year => `<option value="${year}">${year} 年会议</option>`).join('');
    if (state.year !== 'current' && !years.includes(Number(state.year))) state.year = 'current';
    syncControls(); render();
  } catch (error) {
    console.error(error);
    $('#results').innerHTML = '<div class="error"><strong>会议数据暂时无法载入</strong>请检查网络后 <button id="retry">重新载入</button>。</div>';
    $('#result-count').textContent = '数据载入失败';
    $('#retry').addEventListener('click', load);
  }
}
activateSection(state.section);
load();
loadJournals();
setInterval(() => { if (!data) return; const now = Date.now(); if (stateSignature(now) !== lastStateSignature) render(); else updateCountdowns(now); }, 1000);
