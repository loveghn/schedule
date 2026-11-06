import { getData, getTodayKey } from '../core/storage.js';
import { calculateStatistics } from '../core/statistics.js';
import { renderPageHeader } from '../components/page-header.js';

let activePeriod = 'week';

const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const formatDate = (key) => new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(`${key}T00:00:00`));

function renderLineChart(buckets) {
  const width = 760;
  const height = 220;
  const left = 42;
  const right = 14;
  const top = 16;
  const bottom = 8;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const points = buckets.map((bucket, index) => ({
    x: left + (buckets.length > 1 ? (index / (buckets.length - 1)) * chartWidth : chartWidth / 2),
    y: bucket.tasks ? top + ((100 - Math.round((bucket.completed / bucket.tasks) * 100)) / 100) * chartHeight : null,
    bucket,
  }));
  const grid = [0, 25, 50, 75, 100].map((rate) => {
    const y = top + ((100 - rate) / 100) * chartHeight;
    return `<line class="statistics-chart__grid" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"/>`;
  }).join('');
  const runs = [];
  points.forEach((point, index) => {
    if (!point.bucket.tasks) return;
    const previousRun = runs.at(-1);
    if (!previousRun || points[index - 1]?.bucket.tasks === 0) runs.push([]);
    runs.at(-1).push(point);
  });
  const lines = runs.map((run) => {
    const line = run.map(({ x, y }, index) => `${index ? 'L' : 'M'} ${x} ${y}`).join(' ');
    return `<path class="statistics-chart__line" d="${line}"/>`;
  }).join('');
  const dots = points.filter(({ bucket }) => bucket.tasks).map(({ x, y, bucket }) => `<circle class="statistics-chart__point" cx="${x}" cy="${y}" r="5"><title>${escapeHTML(bucket.label)}: ${Math.round((bucket.completed / bucket.tasks) * 100)}% (${bucket.completed}/${bucket.tasks})</title></circle>`).join('');
  const labels = buckets.map((bucket, index) => `<span>${buckets.length <= 7 || index === 0 || index === buckets.length - 1 || index % 2 === 0 ? escapeHTML(bucket.label) : ''}</span>`).join('');
  const yLabels = [100, 75, 50, 25, 0].map((rate) => `<span style="--axis-position:${((100 - rate) / 100) * 100}%">${rate}%</span>`).join('');
  const hasTasks = buckets.some((bucket) => bucket.tasks);
  return `<div class="statistics-chart"><div class="statistics-chart__plot"><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="기간별 할 일 완료율 선형 그래프">${grid}${hasTasks ? `${lines}${dots}` : ''}</svg><div class="statistics-chart__y-axis" aria-hidden="true">${yLabels}</div></div><div class="statistics-chart__x-axis" style="--axis-count:${buckets.length}" aria-hidden="true">${labels}</div>${hasTasks ? '' : '<p class="statistics-chart__empty">선택한 기간에 완료율을 계산할 할 일 기록이 없습니다.</p>'}</div>`;
}

function renderDonut(stats) {
  const { completed, failed, pending, tasks } = stats.totals;
  if (!tasks) return `<div class="statistics-donut statistics-donut--empty"><div class="statistics-donut__graphic"><svg viewBox="0 0 160 160" role="img" aria-label="할 일 기록 없음"><circle cx="80" cy="80" r="62"/></svg><div><strong>—</strong><span>기록 없음</span></div></div><p>선택한 기간에 마감된 할 일이 없습니다.</p></div>`;
  const circumference = 2 * Math.PI * 62;
  let offset = 0;
  const segments = [
    { value: completed, className: 'is-completed', label: '완료' },
    { value: failed, className: 'is-failed', label: '실패' },
    { value: pending, className: 'is-pending', label: '미완료' },
  ].map((segment) => {
    const length = (segment.value / tasks) * circumference;
    const node = segment.value ? `<circle class="${segment.className}" cx="80" cy="80" r="62" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}"/>` : '';
    offset += length;
    return node;
  }).join('');
  const rate = Math.round((completed / tasks) * 100);
  return `<div class="statistics-donut"><div class="statistics-donut__graphic"><svg viewBox="0 0 160 160" role="img" aria-label="완료 ${completed}건, 실패 ${failed}건, 미완료 ${pending}건">${segments}</svg><div><strong>${rate}%</strong><span>완료율</span></div></div><ul class="statistics-donut__legend"><li><i class="is-completed"></i><span>완료</span><strong>${completed}</strong></li><li><i class="is-failed"></i><span>실패</span><strong>${failed}</strong></li><li><i class="is-pending"></i><span>미완료</span><strong>${pending}</strong></li></ul></div>`;
}

function renderCategoryBars(categories) {
  if (!categories.length) return '<p class="statistics-empty">아직 분류별로 집계할 할 일 기록이 없습니다.</p>';
  const max = Math.max(...categories.map(({ count }) => count));
  return `<ul class="statistics-categories">${categories.map((category) => `<li><div class="statistics-categories__label"><strong>${escapeHTML(category.name)}</strong><span>${category.completed} / ${category.count} 완료</span></div><div class="statistics-categories__track"><span class="statistics-categories__bar" style="--bar-width:${Math.max((category.count / max) * 100, 2)}%;--category-color:${category.color}"></span></div></li>`).join('')}</ul>`;
}

function renderEventBars(buckets) {
  const max = Math.max(1, ...buckets.map(({ events }) => events));
  return `<div class="statistics-event-bars" role="img" aria-label="기간별 일정 기록 수">${buckets.map((bucket) => `<div class="statistics-event-bars__column" title="${escapeHTML(bucket.label)} 일정 ${bucket.events}건"><span>${bucket.events || ''}</span><i style="--bar-height:${bucket.events ? Math.max((bucket.events / max) * 100, 4) : 0}%"></i><small>${escapeHTML(bucket.label)}</small></div>`).join('')}</div>`;
}

export function renderStatistics() {
  const stats = calculateStatistics(getData(), activePeriod);
  const today = getTodayKey();
  const periods = [['week', '7일'], ['month', '30일'], ['year', '12개월']];
  const tasksLabel = stats.totals.tasks ? `${formatDate(stats.start)} – ${formatDate(today)}` : '집계된 할 일 기록 없음';
  return `<article class="page page--statistics statistics-page">
    ${renderPageHeader('statistics', { meta: today, metaDateTime: today })}
    <div class="statistics-toolbar"><p>${escapeHTML(stats.periodLabel)} · 오늘까지의 기록</p><div class="statistics-period" role="group" aria-label="통계 기간">${periods.map(([value, label]) => `<button type="button" class="btn btn--outline btn--small ${activePeriod === value ? 'is-active' : ''}" data-statistics-period="${value}" aria-pressed="${activePeriod === value}">${label}</button>`).join('')}</div></div>
    <section class="statistics-metrics" aria-label="기간 요약">
      <article class="statistics-metric statistics-metric--primary"><span>완료한 할 일</span><strong>${stats.totals.completed}</strong><small>${escapeHTML(tasksLabel)}</small></article>
      <article class="statistics-metric"><span>할 일 완료율</span><strong>${stats.completionRate === null ? '—' : `${stats.completionRate}%`}</strong><small>${stats.totals.tasks ? `${stats.totals.completed} / ${stats.totals.tasks}건` : '분석할 기록이 없습니다'}</small></article>
      <article class="statistics-metric"><span>실패 기록</span><strong>${stats.totals.failed}</strong><small>${stats.totals.tasks ? '기간 내 마감 할 일' : '분석할 기록이 없습니다'}</small></article>
      <article class="statistics-metric"><span>쌓인 일정</span><strong>${stats.totals.events}</strong><small>${stats.periodLabel} 동안 시작한 일정</small></article>
    </section>
    <div class="statistics-detail-grid">
      <section class="statistics-panel statistics-trend" aria-labelledby="statistics-trend-title"><div class="statistics-panel__heading"><div><p class="statistics-section-index">TASK COMPLETION</p><h2 id="statistics-trend-title">완료율 추이</h2></div><span>${escapeHTML(tasksLabel)}</span></div>${renderLineChart(stats.buckets)}</section>
      <section class="statistics-panel" aria-labelledby="statistics-status-title"><div class="statistics-panel__heading"><div><p class="statistics-section-index">TASK STATUS</p><h2 id="statistics-status-title">할 일 처리 현황</h2></div><span>${stats.totals.tasks}건</span></div>${renderDonut(stats)}</section>
      <section class="statistics-panel" aria-labelledby="statistics-category-title"><div class="statistics-panel__heading"><div><p class="statistics-section-index">CATEGORY BREAKDOWN</p><h2 id="statistics-category-title">카테고리별 기록</h2></div><span>완료 / 전체</span></div>${renderCategoryBars(stats.categories)}</section>
    </div>
    <section class="statistics-panel statistics-events" aria-labelledby="statistics-events-title"><div class="statistics-panel__heading"><div><p class="statistics-section-index">SCHEDULE LOG</p><h2 id="statistics-events-title">일정 기록 추이</h2></div><span>${stats.periodLabel} · 총 ${stats.totals.events}건</span></div>${renderEventBars(stats.buckets)}</section>
  </article>`;
}

export function initStatisticsPage() {
  const outlet = document.querySelector('#page-outlet');
  if (!outlet?.querySelector('.statistics-page')) return;
  outlet.querySelectorAll('[data-statistics-period]').forEach((button) => {
    button.addEventListener('click', () => {
      activePeriod = button.dataset.statisticsPeriod;
      outlet.innerHTML = renderStatistics();
      initStatisticsPage();
    });
  });
}
