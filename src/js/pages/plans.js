import { getData, saveData, createId, getTodayKey } from '../core/storage.js';
import { createModal } from '../components/modal.js';
import { createButton } from '../components/button.js';
import { showToast } from '../components/toast.js';
import { enhanceDateInputs, setDatePickerValue } from '../components/date-picker.js';
import { createTitleColorControl, getContrastingTitleColor } from '../components/title-color.js';

const EVENT_COLORS = [
  { name: '노랑', value: '#FFD200' },
  { name: '빨강', value: '#FF5B58' },
  { name: '주황', value: '#FF8C00' },
  { name: '시안', value: '#00C3FF' },
  { name: '파랑', value: '#2864DC' },
  { name: '청보라', value: '#6B5CFF' },
  { name: '갈색', value: '#8B5A2B' },
  { name: '회색', value: '#888888' },
  { name: '검정', value: '#000000' },
  { name: '흰색', value: '#FFFFFF' },
];

const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function field(label, name, type, value = '', placeholder = '') {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-group';
  const labelElement = document.createElement('label');
  labelElement.className = 'form-group__label';
  labelElement.htmlFor = `event-${name}`;
  labelElement.textContent = label;
  const control = type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
  control.className = type === 'textarea' ? 'form-control form-control--textarea' : 'form-control';
  if (type !== 'textarea') control.type = type;
  control.id = `event-${name}`;
  control.name = name;
  control.value = value;
  if (placeholder) control.placeholder = placeholder;
  if (['title', 'startDate', 'endDate', 'startTime', 'endTime'].includes(name)) control.required = true;
  if (name === 'title') control.maxLength = 100;
  if (name === 'description') { control.rows = 3; control.maxLength = 500; }
  wrapper.append(labelElement, control);
  return wrapper;
}

function refreshCurrentPage() {
  document.dispatchEvent(new CustomEvent('planner:datachange'));
}

export function openEventModal(template = null, { duplicate = false, edit = false } = {}) {
  const initialDate = template?.startDate || template?.date || getTodayKey();
  const form = document.createElement('form');
  form.className = 'plan-form event-form';
  form.noValidate = true;
  const titleField = field('일정 제목', 'title', 'text', `${template?.title || ''}${duplicate ? ' (복사)' : ''}`, '일정 제목을 입력하세요.');
  const titleHeader = document.createElement('div');
  titleHeader.className = 'form-group__label-row';
  titleHeader.append(titleField.querySelector('label'), createTitleColorControl(template?.titleColor || getContrastingTitleColor(template?.color || EVENT_COLORS[0].value)));
  titleField.prepend(titleHeader);
  const descriptionField = field('상세 내용', 'description', 'textarea', template?.description || '', '상세 내용을 작성하세요.');
  form.append(titleField);

  const colorGroup = document.createElement('fieldset');
  colorGroup.className = 'event-color-field';
  colorGroup.innerHTML = `<legend class="form-group__label">일정 색상</legend><div class="event-color-options">${EVENT_COLORS.map((color) => `<label class="event-color-choice" title="${color.name}"><input type="radio" name="color" value="${color.value}" aria-label="${color.name}" ${color.value === (template?.color || EVENT_COLORS[0].value) ? 'checked' : ''}><span style="--swatch:${color.value}"></span></label>`).join('')}</div>`;
  form.append(colorGroup);
  form.append(descriptionField);

  const dateRow = document.createElement('div');
  dateRow.className = 'form-row';
  dateRow.append(field('시작 날짜', 'startDate', 'date', initialDate), field('종료 날짜', 'endDate', 'date', template?.endDate || template?.date || initialDate));
  form.append(dateRow);

  const allDayLabel = document.createElement('label');
  allDayLabel.className = 'form-check event-all-day';
  allDayLabel.innerHTML = '<input class="form-check__input" type="checkbox" name="allDay"><span class="form-check__label">하루 종일</span>';
  allDayLabel.querySelector('input').checked = Boolean(template?.allDay);
  form.append(allDayLabel);

  const timeRow = document.createElement('div');
  timeRow.className = 'form-row event-time-fields';
  timeRow.append(field('시작 시간', 'startTime', 'time', template?.startTime || template?.time || ''), field('종료 시간', 'endTime', 'time', template?.endTime || ''));
  form.append(timeRow);
  const syncTimeFields = () => { timeRow.hidden = allDayLabel.querySelector('input').checked; };
  allDayLabel.querySelector('input').addEventListener('change', syncTimeFields);
  syncTimeFields();
  enhanceDateInputs(form);
  const [startDateInput, endDateInput] = dateRow.querySelectorAll('[data-date-picker-display]');
  const keepEndDateOnOrAfterStart = () => {
    const startDate = startDateInput.dataset.dateIso;
    const endDate = endDateInput.dataset.dateIso;
    if (startDate && endDate < startDate) setDatePickerValue(endDateInput, startDate);
  };
  startDateInput.addEventListener('change', keepEndDateOnOrAfterStart);
  endDateInput.addEventListener('change', keepEndDateOnOrAfterStart);
  keepEndDateOnOrAfterStart();

  const footer = document.createElement('div');
  footer.className = 'form-actions';
  const cancel = createButton({ label: '취소', variant: 'outline' });
  const submit = createButton({ label: edit ? '변경사항 저장' : duplicate ? '복제 일정 만들기' : '일정 만들기', variant: 'primary', type: 'submit' });
  submit.setAttribute('form', `event-form-${createId()}`);
  form.id = submit.getAttribute('form');
  footer.append(cancel, submit);

  const modal = createModal({ title: edit ? '일정 수정' : duplicate ? '일정 복제' : '일정 만들기', description: '일정 정보를 입력하세요.', content: form, footer });
  cancel.addEventListener('click', () => modal.close('cancel'));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(form);
    const title = String(values.get('title') || '').trim();
    if (!title) { form.elements.namedItem('title').focus(); showToast({ type: 'warning', title: '일정 제목을 입력하세요.' }); return; }
    const startDate = String(values.get('startDate') || '');
    const endDate = String(values.get('endDate') || '');
    if (!startDate || !endDate || endDate < startDate) { showToast({ type: 'warning', title: '시작·종료 날짜를 확인하세요.' }); return; }
    const allDay = values.get('allDay') === 'on';
    const startTime = allDay ? '' : String(values.get('startTime') || '');
    const endTime = allDay ? '' : String(values.get('endTime') || '');
    if (!allDay && (!startTime || !endTime)) { showToast({ type: 'warning', title: '시작·종료 시간을 선택하거나 하루 종일을 체크하세요.' }); return; }
    if (!allDay && startDate === endDate && startTime && endTime && endTime < startTime) { showToast({ type: 'warning', title: '종료 시간은 시작 시간 이후여야 합니다.' }); return; }
    const data = getData();
    const eventData = {
      id: edit ? template.id : createId('event'), title, description: String(values.get('description') || '').trim(),
      date: startDate, time: startTime, startDate, startTime, endDate, endTime, allDay,
      color: EVENT_COLORS.some((color) => color.value === values.get('color')) ? values.get('color') : edit && !values.get('color') ? template?.color : EVENT_COLORS[0].value,
      titleColor: values.get('titleColor') === '#FFFFFF' ? '#FFFFFF' : '#000000',
      createdAt: edit ? template.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (edit) {
      const eventIndex = data.events.findIndex((item) => item.id === template.id);
      if (eventIndex < 0) { showToast({ type: 'error', title: '수정할 일정을 찾지 못했습니다.' }); return; }
      data.events[eventIndex] = eventData;
    } else {
      data.events.push(eventData);
    }
    if (!saveData(data)) { showToast({ type: 'error', title: '저장하지 못했습니다.', message: '브라우저 저장 공간을 확인하세요.' }); return; }
    modal.close('saved');
    refreshCurrentPage();
    showToast({ type: 'success', title: edit ? '일정을 수정했습니다.' : duplicate ? '일정을 복제했습니다.' : '일정을 만들었습니다.' });
  });
  modal.element.addEventListener('close', () => modal.element.remove(), { once: true });
  modal.open();
  requestAnimationFrame(() => form.elements.namedItem('title')?.focus());
}
