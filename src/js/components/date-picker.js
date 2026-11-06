import { getTodayKey } from '../core/storage.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
let cleanupObserver = null;

function formatValue(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()];
  return `${year}. ${String(month).padStart(2, '0')}. ${String(day).padStart(2, '0')} (${weekday})`;
}

export function setDatePickerValue(target, value) {
  if (!target || !value) return false;
  const wrapper = target.closest?.('.date-picker') || target;
  const displayInput = wrapper.matches?.('[data-date-picker-display]')
    ? wrapper
    : wrapper.querySelector?.('[data-date-picker-display]');
  const valueInput = displayInput?.closest('.date-picker')?.querySelector('[data-date-picker-value]');
  if (!displayInput || !valueInput) return false;

  displayInput.dataset.dateIso = value;
  displayInput.value = formatValue(value);
  valueInput.value = value;
  [displayInput, valueInput].forEach((input) => {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  return true;
}

function monthStart(value) {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

function dateKey(date) {
  return getTodayKey(date);
}

function monthLabel(date) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(date);
}

function renderDays(calendar, month, selectedValue) {
  const today = getTodayKey();
  const firstDay = month.getDay();
  const first = new Date(month.getFullYear(), month.getMonth(), 1 - firstDay);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    const value = dateKey(date);
    const outside = date.getMonth() !== month.getMonth();
    const classes = ['date-picker__day', outside ? 'is-outside' : '', value === today ? 'is-today' : '', value === selectedValue ? 'is-selected' : ''].filter(Boolean).join(' ');
    return `<button type="button" class="${classes}" data-date-value="${value}" aria-label="${date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}" ${value === selectedValue ? 'aria-pressed="true"' : ''}>${date.getDate()}</button>`;
  }).join('');
  calendar.querySelector('.date-picker__month').textContent = monthLabel(month);
  calendar.querySelector('.date-picker__days').innerHTML = `${WEEKDAYS.map((day, index) => `<span class="date-picker__weekday ${index === 0 || index === 6 ? 'is-weekend' : ''}" aria-hidden="true">${day}</span>`).join('')}${days}`;
}

function positionCalendar(control, calendar) {
  const rect = control.getBoundingClientRect();
  const width = Math.min(320, window.innerWidth - 24);
  const height = calendar.offsetHeight;
  const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
  const top = rect.bottom + height + 8 <= window.innerHeight
    ? rect.bottom + 8
    : Math.max(8, rect.top - height - 8);
  calendar.style.left = `${left}px`;
  calendar.style.top = `${top}px`;
}

function createPicker(input) {
  if (input.dataset.datePickerReady === 'true') return;
  input.dataset.datePickerReady = 'true';
  const initialValue = input.value;
  const name = input.name;
  const id = input.id || `date-picker-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
  input.id = id;
  input.type = 'text';
  input.removeAttribute('name');
  input.dataset.datePickerDisplay = 'true';
  input.readOnly = true;
  input.autocomplete = 'off';
  input.inputMode = 'none';
  input.placeholder = '날짜 선택';
  input.setAttribute('aria-haspopup', 'dialog');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', `${id}-calendar`);
  if (input.required) {
    input.setAttribute('aria-required', 'true');
    input.required = false;
  }
  input.dataset.dateIso = initialValue;
  input.value = formatValue(initialValue);

  const control = document.createElement('div');
  control.className = 'date-picker';
  const valueInput = document.createElement('input');
  valueInput.type = 'hidden';
  valueInput.name = name;
  valueInput.value = initialValue;
  valueInput.dataset.datePickerValue = 'true';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'date-picker__trigger';
  trigger.setAttribute('aria-label', '달력 열기');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', `${id}-calendar`);
  trigger.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">calendar_month</span>';

  const calendar = document.createElement('div');
  calendar.className = 'date-picker__calendar';
  calendar.id = `${id}-calendar`;
  calendar.setAttribute('popover', 'manual');
  calendar.setAttribute('role', 'dialog');
  calendar.setAttribute('aria-label', '날짜 선택');
  calendar.innerHTML = '<div class="date-picker__header"><button type="button" class="btn btn--outline btn--icon date-picker__shift" data-month-shift="-1" aria-label="이전 달"><span class="material-symbols-outlined" aria-hidden="true">chevron_left</span></button><strong class="date-picker__month"></strong><button type="button" class="btn btn--outline btn--icon date-picker__shift" data-month-shift="1" aria-label="다음 달"><span class="material-symbols-outlined" aria-hidden="true">chevron_right</span></button></div><div class="date-picker__days" role="grid"></div><button type="button" class="date-picker__today" data-pick-today>오늘</button>';

  input.parentNode.insertBefore(control, input);
  control.append(input, trigger, valueInput);
  if (!cleanupObserver && 'MutationObserver' in window) {
    cleanupObserver = new MutationObserver(() => {
      document.querySelectorAll('.date-picker__calendar[id]').forEach((panel) => {
        if (!document.getElementById(panel.id.replace(/-calendar$/, ''))) panel.remove();
      });
    });
    cleanupObserver.observe(document.body, { childList: true, subtree: true });
  }

  let visibleMonth = initialValue ? monthStart(initialValue) : monthStart(getTodayKey());
  let removeOpenListeners = () => {};

  const close = ({ restoreFocus = false } = {}) => {
    if (calendar.matches(':popover-open')) calendar.hidePopover();
    input.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-expanded', 'false');
    removeOpenListeners();
    removeOpenListeners = () => {};
    if (restoreFocus) input.focus();
  };

  const open = () => {
    if (calendar.matches(':popover-open')) { close(); return; }
    const popoverHost = input.closest('dialog') || document.body;
    if (calendar.parentElement !== popoverHost) popoverHost.append(calendar);
    visibleMonth = input.dataset.dateIso ? monthStart(input.dataset.dateIso) : monthStart(getTodayKey());
    renderDays(calendar, visibleMonth, input.dataset.dateIso);
    calendar.showPopover();
    input.setAttribute('aria-expanded', 'true');
    trigger.setAttribute('aria-expanded', 'true');
    positionCalendar(control, calendar);
    const onPointerDown = (event) => {
      if (!control.contains(event.target) && !calendar.contains(event.target)) close();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close({ restoreFocus: true }); }
    };
    const onViewportChange = () => close();
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
    removeOpenListeners = () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
    };
  };

  input.addEventListener('click', open);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
  });
  trigger.addEventListener('click', open);
  calendar.addEventListener('click', (event) => {
    const shift = event.target.closest('[data-month-shift]');
    if (shift) {
      visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + Number(shift.dataset.monthShift), 1);
      renderDays(calendar, visibleMonth, input.dataset.dateIso);
      positionCalendar(control, calendar);
      return;
    }
    const todayButton = event.target.closest('[data-pick-today]');
    const dayButton = event.target.closest('[data-date-value]');
    const value = todayButton ? getTodayKey() : dayButton?.dataset.dateValue;
    if (!value) return;
    input.dataset.dateIso = value;
    input.value = formatValue(value);
    valueInput.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    valueInput.dispatchEvent(new Event('input', { bubbles: true }));
    valueInput.dispatchEvent(new Event('change', { bubbles: true }));
    close({ restoreFocus: true });
  });

}

export function enhanceDateInputs(root) {
  root.querySelectorAll('input[type="date"]').forEach(createPicker);
}
