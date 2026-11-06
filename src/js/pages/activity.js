import { getData, getTodayKey, saveData } from '../core/storage.js';
import { openEventModal } from './plans.js';
import { showToast } from '../components/toast.js';
import { renderPageHeader } from '../components/page-header.js';
import { PAGINATION_PAGE_SIZE, renderPagination } from '../components/pagination.js';

let activeFilter = 'all';
let activePage = 1;

const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const startDateOf = (event) => event.startDate || event.date || '';
const endDateOf = (event) => event.endDate || event.date || startDateOf(event);
const safeColor = (value) => /^#[\da-f]{6}$/i.test(value || '') ? value : '#00E83B';
const isEventPast = (event, today, currentTime) => {
  const endDate = endDateOf(event);
  if (endDate < today) return true;
  if (endDate > today || event.allDay) return false;
  const endTime = event.endTime || event.startTime || event.time || '';
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) && endTime <= currentTime;
};

function formatDateRange(event) {
  const start = startDateOf(event);
  const end = endDateOf(event);
  if (!start) return '날짜 미정';
  const format = (key) => new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(`${key}T00:00:00`));
  return start === end ? format(start) : `${format(start)} ~<br>${format(end)}`;
}

function formatTime(event) {
  if (event.allDay || (event.allDay === undefined && !event.startTime && !event.time)) return '종일';
  const start = event.startTime || event.time || '';
  return [start, event.endTime].filter(Boolean).join(' – ') || '시간 미정';
}

function renderRecord(event, past) {
  const status = past ? '완료' : '예정';
  return `<li class="schedule-record">
    <span class="schedule-record__color" style="--record-color:${safeColor(event.color)}" aria-hidden="true"></span>
    <div class="schedule-record__date"><time datetime="${escapeHTML(startDateOf(event))}">${formatDateRange(event)}</time><span>${escapeHTML(formatTime(event))}</span></div>
    <div class="schedule-record__details"><strong>${escapeHTML(event.title)}</strong>${event.description ? `<p>${escapeHTML(event.description)}</p>` : ''}</div>
    <span class="schedule-record__status ${past ? 'is-past' : ''}">${status}</span>
    <div class="schedule-record__actions">
      <button type="button" class="btn btn--outline btn--icon" data-record-edit="${escapeHTML(event.id)}" aria-label="${escapeHTML(event.title)} 수정" title="수정"><span class="material-symbols-outlined" aria-hidden="true">edit</span></button>
      <button type="button" class="btn btn--outline btn--icon" data-record-duplicate="${escapeHTML(event.id)}" aria-label="${escapeHTML(event.title)} 복제" title="복제"><span class="material-symbols-outlined" aria-hidden="true">content_copy</span></button>
      <button type="button" class="btn btn--danger btn--icon" data-record-delete="${escapeHTML(event.id)}" aria-label="${escapeHTML(event.title)} 삭제" title="삭제"><span class="material-symbols-outlined" aria-hidden="true">delete</span></button>
    </div>
  </li>`;
}

export function renderActivity() {
  const events = getData().events.filter((event) => startDateOf(event)).sort((a, b) => `${endDateOf(b)}${b.startTime || b.time || ''}`.localeCompare(`${endDateOf(a)}${a.startTime || a.time || ''}`));
  const now = new Date();
  const today = getTodayKey(now);
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const pastCount = events.filter((event) => isEventPast(event, today, currentTime)).length;
  const upcomingCount = events.length - pastCount;
  const visibleEvents = events.filter((event) => {
    const past = isEventPast(event, today, currentTime);
    if (activeFilter === 'past') return past;
    if (activeFilter === 'upcoming') return !past;
    return true;
  });
  const pageCount = Math.max(1, Math.ceil(visibleEvents.length / PAGINATION_PAGE_SIZE));
  activePage = Math.min(activePage, pageCount);
  const pageEvents = visibleEvents.slice((activePage - 1) * PAGINATION_PAGE_SIZE, activePage * PAGINATION_PAGE_SIZE);

  return `<article class="page page--activity schedule-log-page">
    ${renderPageHeader('activity', { meta: today, metaDateTime: today })}
    <section class="schedule-log-summary" aria-label="일정 기록 요약">
      <div class="schedule-log-summary__total"><span>전체 일정</span><strong>${events.length}</strong></div>
      <div><span>지난 일정</span><strong>${pastCount}</strong></div>
      <div><span>예정 일정</span><strong>${upcomingCount}</strong></div>
    </section>
    <section class="schedule-log-listing" aria-label="저장된 일정 기록">
      <div class="schedule-log-toolbar"><div class="schedule-log-filters" role="group" aria-label="일정 기록 필터">
        ${[['all','전체'],['past','지난 일정'],['upcoming','예정 일정']].map(([value,label]) => `<button type="button" class="schedule-log-filter ${activeFilter === value ? 'is-active' : ''}" data-record-filter="${value}" aria-pressed="${activeFilter === value}">${label}</button>`).join('')}
      </div><span>${visibleEvents.length} RECORDS</span></div>
      ${visibleEvents.length ? `<ul class="schedule-record-list">${pageEvents.map((event) => renderRecord(event, isEventPast(event, today, currentTime))).join('')}</ul>${renderPagination({ page: activePage, totalItems: visibleEvents.length, attribute: 'activity' })}` : `<div class="schedule-log-empty"><span class="material-symbols-outlined" aria-hidden="true">event_note</span><strong>${events.length ? '선택한 일정 기록이 없습니다.' : '아직 쌓인 일정이 없습니다.'}</strong><p>${events.length ? '다른 필터를 선택해 보세요.' : '사이드바의 일정 만들기에서 일정을 추가하면 이곳에 기록됩니다.'}</p></div>`}
    </section>
  </article>`;
}

export function initActivityPage() {
  const outlet = document.querySelector('#page-outlet');
  if (!outlet?.querySelector('.schedule-log-page')) return;
  if (outlet.dataset.activityEventsBound === 'true') return;
  outlet.dataset.activityEventsBound = 'true';
  outlet.addEventListener('click', (event) => {
    const filter = event.target.closest('[data-record-filter]');
    if (filter) {
      activeFilter = filter.dataset.recordFilter;
      activePage = 1;
      outlet.innerHTML = renderActivity();
      return;
    }

    const pageButton = event.target.closest('[data-pagination="activity"]');
    if (pageButton && !pageButton.disabled) {
      activePage = Number(pageButton.dataset.page);
      outlet.innerHTML = renderActivity();
      outlet.querySelector('.schedule-log-listing')?.scrollIntoView({ block: 'start' });
      return;
    }

    const edit = event.target.closest('[data-record-edit]');
    const duplicate = event.target.closest('[data-record-duplicate]');
    const remove = event.target.closest('[data-record-delete]');
    const action = edit || duplicate || remove;
    if (!action) return;
    const data = getData();
    const record = data.events.find((item) => item.id === action.dataset.recordEdit || item.id === action.dataset.recordDuplicate || item.id === action.dataset.recordDelete);
    if (!record) return;

    if (edit) {
      openEventModal(record, { edit: true });
      return;
    }
    if (duplicate) {
      openEventModal(record, { duplicate: true });
      return;
    }

    if (!window.confirm(`"${record.title}" 일정을 삭제할까요?`)) return;
    data.events = data.events.filter((item) => item.id !== record.id);
    if (!saveData(data)) {
      showToast({ type: 'error', title: '삭제하지 못했습니다.' });
      return;
    }
    outlet.innerHTML = renderActivity();
    showToast({ type: 'success', title: '일정을 삭제했습니다.' });
  });
}
