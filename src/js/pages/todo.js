import { getData, saveData, createId, getTodayKey } from '../core/storage.js';
import { getNextRecurrenceDate, isRecurrenceWithinEnd } from '../core/recurrence.js';
import { ensureHabitOccurrences, syncHabitLog } from '../core/habits.js';
import { ensureSettings, isHexColor } from '../core/settings.js';
import { enhanceDateInputs } from '../components/date-picker.js';
import { createModal } from '../components/modal.js';
import { createButton } from '../components/button.js';
import { showToast } from '../components/toast.js';
import { createTitleColorControl } from '../components/title-color.js';
import { renderPageHeader } from '../components/page-header.js';
import { PAGINATION_PAGE_SIZE, renderPagination } from '../components/pagination.js';

let activeFilter = 'all';
let activePriority = 'all';
let activeCategory = 'all';
let activePage = 1;
let currentModal = null;

const FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'today', label: '오늘' },
  { value: 'upcoming', label: '예정' },
  { value: 'completed', label: '완료' },
  { value: 'failed', label: '실패' },
];

const PRIORITIES = [
  { value: 'high', label: '높음' },
  { value: 'normal', label: '보통' },
  { value: 'low', label: '낮음' },
];

const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

const today = () => getTodayKey();

function getVisibleTasks(tasks) {
  const now = today();

  return tasks
    .filter((task) => {
      if (activeFilter === 'today') return task.date === now;
      if (activeFilter === 'upcoming') return !task.completed && !task.failed && task.date && task.date > now;
      if (activeFilter === 'completed') return task.completed;
      if (activeFilter === 'failed') return !task.completed && task.failed;
      return true;
    })
    .filter((task) => activePriority === 'all' || (task.priority || 'normal') === activePriority)
    .filter((task) => activeCategory === 'all' || (task.category || '') === activeCategory)
    .sort((a, b) => {
      const dateRank = (date) => !date ? 2 : date < now ? 1 : 0;
      const aDateRank = dateRank(a.date);
      const bDateRank = dateRank(b.date);
      if (aDateRank !== bDateRank) return aDateRank - bDateRank;
      if (a.date && b.date && a.date !== b.date) {
        return aDateRank === 1 ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
      }
      const stateRank = (task) => task.completed ? 1 : task.failed ? 2 : 0;
      if (stateRank(a) !== stateRank(b)) return stateRank(a) - stateRank(b);
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority || 'normal'] - priorityOrder[b.priority || 'normal'];
      if (priorityDiff) return priorityDiff;
      return a.title.localeCompare(b.title, 'ko');
    });
}

function renderTask(task) {
  const priority = task.priority || 'normal';
  const isFailed = !task.completed && Boolean(task.failed);
  const categoryColor = isHexColor(task.categoryColor) ? task.categoryColor : '#EDEDED';
  const dueLabel = task.date
    ? new Intl.DateTimeFormat('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    }).format(new Date(`${task.date}T00:00:00`))
    : '날짜 미정';

  return `
    <li class="todo-item ${task.completed ? 'is-completed' : ''} ${isFailed ? 'is-failed' : ''}" data-task-id="${escapeHTML(task.id)}">
      <div class="todo-item__status-controls">
        <label class="todo-item__check">
          <input type="checkbox" data-todo-toggle="${escapeHTML(task.id)}" ${task.completed ? 'checked' : ''} aria-label="${task.completed ? '완료 취소' : '완료 처리'}: ${escapeHTML(task.title)}">
          <span aria-hidden="true"></span>
        </label>
        <button type="button" class="btn btn--outline btn--icon todo-item__fail ${isFailed ? 'is-active' : ''}" data-todo-fail="${escapeHTML(task.id)}" aria-label="${isFailed ? '실패 취소' : '실패 처리'}: ${escapeHTML(task.title)}" aria-pressed="${isFailed}" title="${isFailed ? '실패 취소' : '실패 처리'}"><span class="material-symbols-outlined" aria-hidden="true">close</span></button>
      </div>
      <div class="todo-item__main">
        <strong class="todo-item__title">${escapeHTML(task.title)}</strong>
        ${task.description ? `<p class="todo-item__description">${escapeHTML(task.description)}</p>` : ''}
        <div class="todo-item__meta">
          <span class="todo-priority todo-priority--${priority}">${PRIORITIES.find((item) => item.value === priority)?.label || '보통'}</span>
          ${isFailed ? '<span class="todo-status todo-status--failed">실패</span>' : ''}
          ${task.category ? `<span class="badge badge--category" style="--category-color:${categoryColor}"><span class="badge__label">${escapeHTML(task.category)}</span></span>` : ''}
          <time datetime="${escapeHTML(task.date || '')}">${escapeHTML(dueLabel)}</time>
        </div>
      </div>
      <div class="todo-item__actions">
        <button type="button" class="btn btn--outline btn--icon" data-todo-edit="${escapeHTML(task.id)}" aria-label="${escapeHTML(task.title)} 수정" title="수정"><span class="material-symbols-outlined" aria-hidden="true">edit</span></button>
        <button type="button" class="btn btn--outline btn--icon" data-todo-duplicate="${escapeHTML(task.id)}" aria-label="${escapeHTML(task.title)} 복제" title="복제"><span class="material-symbols-outlined" aria-hidden="true">content_copy</span></button>
        <button type="button" class="btn btn--danger btn--icon" data-todo-delete="${escapeHTML(task.id)}" aria-label="${escapeHTML(task.title)} 삭제" title="삭제"><span class="material-symbols-outlined" aria-hidden="true">delete</span></button>
      </div>
    </li>
  `;
}

export function renderTodo() {
  const data = getData();
  const settingsChanged = ensureSettings(data);
  const habitOccurrencesChanged = ensureHabitOccurrences(data);
  if ((settingsChanged || habitOccurrencesChanged) && !saveData(data)) {
    showToast({ type: 'error', title: '할 일 설정을 저장하지 못했습니다.' });
  }
  const tasks = data.tasks;
  const taskCategories = [...new Set(data.categories.map((category) => category.name).filter(Boolean))];
  if (activeCategory !== 'all' && !taskCategories.includes(activeCategory)) activeCategory = 'all';
  const visibleTasks = getVisibleTasks(tasks);
  const pageCount = Math.max(1, Math.ceil(visibleTasks.length / PAGINATION_PAGE_SIZE));
  activePage = Math.min(activePage, pageCount);
  const pageTasks = visibleTasks.slice((activePage - 1) * PAGINATION_PAGE_SIZE, activePage * PAGINATION_PAGE_SIZE);
  const completed = tasks.filter((task) => task.completed).length;
  const failed = tasks.filter((task) => !task.completed && task.failed).length;
  const pending = tasks.length - completed - failed;
  const rate = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  return `
    <article class="page page--todo todo-page">
      ${renderPageHeader('todo', { meta: today(), metaDateTime: today() })}

      <section class="todo-summary" aria-label="할 일 요약">
        <div class="todo-summary__item todo-summary__item--total"><span>전체 할 일</span><strong>${tasks.length}</strong></div>
        <div class="todo-summary__item"><span>진행 중</span><strong>${pending}</strong></div>
        <div class="todo-summary__item"><span>완료</span><strong>${completed}</strong></div>
        <div class="todo-summary__item"><span>실패</span><strong>${failed}</strong></div>
        <div class="todo-summary__item"><span>완료율</span><strong>${rate}<small>%</small></strong></div>
      </section>

      <section class="todo-workspace" aria-label="할 일 목록">
        <div class="todo-toolbar">
          <div class="todo-filters" role="group" aria-label="할 일 필터">
            ${FILTERS.map((filter) => `<button type="button" class="todo-filter ${activeFilter === filter.value ? 'is-active' : ''}" data-todo-filter="${filter.value}" aria-pressed="${activeFilter === filter.value}">${filter.label}</button>`).join('')}
          </div>
          <div class="todo-toolbar__actions">
            <label class="todo-priority-filter">
              <span class="sr-only">우선순위 선택</span>
              <select data-todo-priority>
                <option value="all" ${activePriority === 'all' ? 'selected' : ''}>우선순위 선택</option>
                ${PRIORITIES.map((item) => `<option value="${item.value}" ${activePriority === item.value ? 'selected' : ''}>${item.label}</option>`).join('')}
              </select>
            </label>
            <label class="todo-category-filter">
              <span class="sr-only">카테고리 선택</span>
              <select data-todo-category>
                <option value="all" ${activeCategory === 'all' ? 'selected' : ''}>카테고리 선택</option>
                ${taskCategories.map((category) => `<option value="${escapeHTML(category)}" ${activeCategory === category ? 'selected' : ''}>${escapeHTML(category)}</option>`).join('')}
              </select>
            </label>
          </div>
        </div>

        <div class="todo-list-heading"><h2>MY TASKS</h2><span>${visibleTasks.length} ITEMS</span></div>
        ${visibleTasks.length
          ? `<ul class="todo-list">${pageTasks.map(renderTask).join('')}</ul>${renderPagination({ page: activePage, totalItems: visibleTasks.length, attribute: 'todo' })}`
          : `<div class="todo-empty"><strong>표시할 할 일이 없습니다.</strong><span>새로운 할 일을 추가하거나 다른 필터를 선택하세요.</span></div>`}
      </section>
    </article>
  `;
}

function createField(label, name, type = 'text', value = '', options = null) {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-group';

  const fieldLabel = document.createElement('label');
  fieldLabel.className = 'form-group__label';
  fieldLabel.htmlFor = `todo-${name}`;
  fieldLabel.textContent = label;

  let control;
  if (type === 'select') {
    control = document.createElement('select');
    control.className = 'form-control form-control--select';
    options.forEach(({ value: optionValue, label: optionLabel }) => {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = optionLabel;
      control.append(option);
    });
  } else if (type === 'textarea') {
    control = document.createElement('textarea');
    control.className = 'form-control form-control--textarea';
    control.rows = 3;
  } else {
    control = document.createElement('input');
    control.className = 'form-control';
    control.type = type;
  }

  control.id = `todo-${name}`;
  control.name = name;
  control.value = value;
  wrapper.append(fieldLabel, control);
  return wrapper;
}

function createNextRecurringTask(data, task, now) {
  const recurrence = task.recurrence;
  if (!recurrence || recurrence.frequency === 'none') return null;

  const nextDate = getNextRecurrenceDate(task.date, recurrence);
  if (!nextDate) return null;
  const nextOccurrence = Number(task.occurrenceNumber || 1) + 1;
  if (!isRecurrenceWithinEnd(recurrence, nextDate, nextOccurrence)) return null;

  const seriesId = task.seriesId || task.id;
  const alreadyCreated = data.tasks.some((item) => item.seriesId === seriesId && Number(item.occurrenceNumber) === nextOccurrence);
  if (alreadyCreated) return null;

  task.seriesId = seriesId;
  task.occurrenceNumber = Number(task.occurrenceNumber || 1);
  return {
    ...task,
    id: createId('task'),
    seriesId,
    occurrenceNumber: nextOccurrence,
    generatedFromId: task.id,
    date: nextDate,
    description: '',
    completed: false,
    failed: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function openTaskModal(task = null) {
  currentModal?.destroy();

  const isEdit = Boolean(task);
  const form = document.createElement('form');
  form.className = 'todo-form';
  form.id = createId('todo-form');

  form.append(
    createField('할 일 제목', 'title', 'text', task?.title || ''),
    createField('상세 내용', 'description', 'textarea', task?.description || ''),
  );
  const titleField = form.querySelector('[name="title"]').closest('.form-group');
  const titleHeader = document.createElement('div');
  titleHeader.className = 'form-group__label-row';
  titleHeader.append(titleField.querySelector('label'), createTitleColorControl(task?.titleColor || '#000000'));
  titleField.prepend(titleHeader);

  const row = document.createElement('div');
  row.className = 'form-row';
  const data = getData();
  if (ensureSettings(data)) saveData(data);
  const categoryOptions = [
    { value: '', label: '선택 안 함' },
    ...data.categories.map(({ name }) => ({ value: name, label: name })),
  ];
  const taskDefaults = data.settings.taskDefaults;
  row.append(
    createField('마감일', 'date', 'date', task?.date || ''),
    createField('우선순위', 'priority', 'select', task?.priority || taskDefaults.priority, [
      { value: 'high', label: '높음' },
      { value: 'normal', label: '보통' },
      { value: 'low', label: '낮음' },
    ]),
    createField('카테고리', 'category', 'select', task ? (task.category ?? '') : taskDefaults.category, categoryOptions),
  );
  form.append(row);

  const repeatField = createField('반복', 'repeatFrequency', 'select', task?.recurrence?.frequency || 'none', [
    { value: 'none', label: '반복 안 함' },
    { value: 'daily', label: '매일' },
    { value: 'weekly', label: '매주' },
    { value: 'monthly', label: '매월' },
  ]);
  repeatField.classList.add('todo-repeat-field');
  const repeatOptions = document.createElement('div');
  repeatOptions.className = 'todo-repeat-options';
  repeatOptions.innerHTML = `<fieldset class="todo-repeat-weekdays"><legend class="form-group__label">반복 요일 (여러 개 선택 가능)</legend><div>${['일','월','화','수','목','금','토'].map((day, index) => `<label><input type="checkbox" name="repeatWeekday" value="${index}" ${(task?.recurrence?.weekdays || []).includes(index) ? 'checked' : ''}><span>${day}</span></label>`).join('')}</div></fieldset><fieldset class="todo-repeat-monthly"><legend class="form-group__label">매월 반복 방식</legend><div class="todo-repeat-monthly__choices"><label><input type="radio" name="monthlyMode" value="date" ${(task?.recurrence?.monthlyMode || 'date') === 'date' ? 'checked' : ''}><span>날짜</span></label><label><input type="radio" name="monthlyMode" value="weekday" ${task?.recurrence?.monthlyMode === 'weekday' ? 'checked' : ''}><span>몇 번째 요일</span></label></div><label class="todo-repeat-day">매월 <select class="form-control form-control--select" name="monthlyDay">${Array.from({ length: 31 }, (_, index) => `<option value="${index + 1}" ${Number(task?.recurrence?.monthlyDay || task?.date?.slice(-2) || 1) === index + 1 ? 'selected' : ''}>${index + 1}일</option>`).join('')}</select></label><div class="todo-repeat-weekday"><select class="form-control form-control--select" name="monthlyOrdinal">${['첫 번째','두 번째','세 번째','네 번째','다섯 번째','마지막'].map((label, index) => `<option value="${index === 5 ? 'last' : index + 1}" ${String(task?.recurrence?.monthlyOrdinal || 1) === String(index === 5 ? 'last' : index + 1) ? 'selected' : ''}>${label}</option>`).join('')}</select><select class="form-control form-control--select" name="monthlyWeekday">${['일','월','화','수','목','금','토'].map((label, index) => `<option value="${index}" ${Number(task?.recurrence?.monthlyWeekday || 0) === index ? 'selected' : ''}>${label}요일</option>`).join('')}</select></div></fieldset><div class="todo-repeat-ending"><div class="form-group"><label class="form-group__label" for="todo-repeatEndType">반복 종료</label><select class="form-control form-control--select" id="todo-repeatEndType" name="repeatEndType"><option value="never" ${(task?.recurrence?.endType || 'never') === 'never' ? 'selected' : ''}>계속 반복</option><option value="date" ${task?.recurrence?.endType === 'date' ? 'selected' : ''}>날짜까지</option><option value="count" ${task?.recurrence?.endType === 'count' ? 'selected' : ''}>횟수 지정</option></select></div>${createField('종료 날짜', 'repeatEndDate', 'date', task?.recurrence?.endDate || '').outerHTML}${createField('총 횟수 (첫 할 일 포함)', 'repeatCount', 'number', task?.recurrence?.count || 5).outerHTML}</div>`;
  repeatOptions.querySelector('[name="repeatCount"]').min = '1';
  form.append(repeatField, repeatOptions);
  const habitField = document.createElement('label');
  habitField.className = 'form-check todo-habit-track';
  habitField.innerHTML = `<input class="form-check__input" type="checkbox" name="trackHabit" ${task?.trackHabit ? 'checked' : ''}><span class="form-check__label">습관으로 추적</span>`;
  form.append(habitField);
  const frequencySelect = repeatField.querySelector('select');
  const syncRepeatOptions = () => {
    repeatOptions.hidden = frequencySelect.value === 'none';
    habitField.hidden = frequencySelect.value === 'none';
    repeatOptions.querySelector('.todo-repeat-weekdays').hidden = frequencySelect.value !== 'weekly';
    const monthlyField = repeatOptions.querySelector('.todo-repeat-monthly');
    monthlyField.hidden = frequencySelect.value !== 'monthly';
    const monthlyMode = form.querySelector('[name="monthlyMode"]:checked')?.value || 'date';
    monthlyField.querySelector('.todo-repeat-day').hidden = monthlyMode !== 'date';
    monthlyField.querySelector('.todo-repeat-weekday').hidden = monthlyMode !== 'weekday';
    const endType = repeatOptions.querySelector('[name="repeatEndType"]').value;
    repeatOptions.querySelector('[name="repeatEndDate"]').closest('.form-group').hidden = endType !== 'date';
    repeatOptions.querySelector('[name="repeatCount"]').closest('.form-group').hidden = endType !== 'count';
  };
  frequencySelect.addEventListener('change', syncRepeatOptions);
  repeatOptions.querySelector('[name="repeatEndType"]').addEventListener('change', syncRepeatOptions);
  repeatOptions.querySelectorAll('[name="monthlyMode"]').forEach((input) => input.addEventListener('change', syncRepeatOptions));
  syncRepeatOptions();
  enhanceDateInputs(form);

  const footer = document.createElement('div');
  footer.className = 'form-actions';
  const cancelButton = createButton({ label: '취소', variant: 'outline' });
  const submitButton = createButton({ label: isEdit ? '수정 저장' : '할 일 추가', variant: 'primary', type: 'submit' });
  submitButton.setAttribute('form', form.id);
  footer.append(cancelButton, submitButton);

  currentModal = createModal({
    title: isEdit ? '할 일 수정' : '새 할 일',
    description: '필요한 정보를 입력하세요.',
    content: form,
    footer,
  });

  const modal = currentModal;
  modal.element.addEventListener('close', () => {
    if (currentModal === modal) currentModal = null;
    modal.element.remove();
  }, { once: true });

  cancelButton.addEventListener('click', () => currentModal?.close('cancel'));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const title = String(formData.get('title') || '').trim();

    if (!title) {
      form.querySelector('[name="title"]').focus();
      showToast({ type: 'warning', title: '제목을 입력하세요.' });
      return;
    }

    const repeatFrequency = String(formData.get('repeatFrequency') || 'none');
    if (repeatFrequency !== 'none' && !String(formData.get('date') || '')) {
      form.querySelector('[data-date-picker-display="true"]')?.focus();
      showToast({ type: 'warning', title: '반복 할 일의 시작 날짜를 선택하세요.' });
      return;
    }
    if (repeatFrequency === 'weekly' && formData.getAll('repeatWeekday').length === 0) {
      showToast({ type: 'warning', title: '반복할 요일을 하나 이상 선택하세요.' });
      return;
    }
    const repeatEndType = String(formData.get('repeatEndType') || 'never');
    const repeatEndDate = String(formData.get('repeatEndDate') || '');
    const repeatCount = Number(formData.get('repeatCount') || 0);
    const trackHabit = repeatFrequency !== 'none' && formData.get('trackHabit') === 'on';
    if (repeatFrequency !== 'none' && repeatEndType === 'date' && (!repeatEndDate || repeatEndDate < String(formData.get('date') || ''))) {
      form.querySelector('[name="repeatEndDate"]').focus();
      showToast({ type: 'warning', title: '종료 날짜는 시작 날짜 이후로 선택하세요.' });
      return;
    }
    if (repeatFrequency !== 'none' && repeatEndType === 'count' && (!Number.isInteger(repeatCount) || repeatCount < 1)) {
      form.querySelector('[name="repeatCount"]').focus();
      showToast({ type: 'warning', title: '반복 횟수는 1회 이상 입력하세요.' });
      return;
    }

    const data = getData();
    ensureSettings(data);
    const now = new Date().toISOString();
    const selectedCategory = String(formData.get('category') || '').trim();
    const selectedCategoryData = data.categories.find((category) => category.name === selectedCategory);
    const values = {
      title,
      description: String(formData.get('description') || '').trim(),
      date: String(formData.get('date') || ''),
      priority: String(formData.get('priority') || 'normal'),
      category: selectedCategory,
      categoryColor: selectedCategoryData?.color || '#EDEDED',
      titleColor: formData.get('titleColor') === '#FFFFFF' ? '#FFFFFF' : '#000000',
      recurrence: {
        frequency: repeatFrequency,
        weekdays: formData.getAll('repeatWeekday').map(Number),
        monthlyMode: String(formData.get('monthlyMode') || 'date'),
        monthlyDay: Number(formData.get('monthlyDay') || 1),
        monthlyOrdinal: String(formData.get('monthlyOrdinal') || '1'),
        monthlyWeekday: Number(formData.get('monthlyWeekday') || 0),
        endType: repeatFrequency === 'none' ? 'never' : repeatEndType,
        endDate: repeatFrequency !== 'none' && repeatEndType === 'date' ? repeatEndDate : '',
        count: repeatFrequency !== 'none' && repeatEndType === 'count' ? repeatCount : null,
      },
      trackHabit,
      trackHabitSince: trackHabit ? (task?.trackHabit ? task.trackHabitSince || task.date : today()) : '',
      updatedAt: now,
    };

    if (isEdit) {
      const target = data.tasks.find((item) => item.id === task.id);
      if (!target) return;
      const wasHabit = Boolean(target.trackHabit);
      const seriesId = target.seriesId || target.id;
      Object.assign(target, values);
      if (wasHabit !== trackHabit || trackHabit) {
        const seriesTasks = data.tasks.filter((item) => (item.seriesId || item.id) === seriesId);
        seriesTasks.forEach((item) => {
          item.trackHabit = trackHabit;
          item.trackHabitSince = trackHabit ? values.trackHabitSince : '';
          if (trackHabit) {
            item.recurrence = values.recurrence;
            item.title = values.title;
            item.titleColor = values.titleColor;
          }
        });
        if (trackHabit) {
          data.tasks = data.tasks.filter((item) => !((item.seriesId || item.id) === seriesId && item.id !== target.id && item.generatedFromId && !item.completed && item.date > today()));
        } else {
          data.tasks = data.tasks.filter((item) => !((item.seriesId || item.id) === seriesId && item.id !== target.id && item.generatedFromId && !item.completed && item.date > today()));
          data.habitLogs = data.habitLogs.filter((log) => log.habitId !== seriesId);
        }
      }
    } else {
      const id = createId('task');
      data.tasks.push({
        id,
        ...values,
        ...(repeatFrequency !== 'none' ? { seriesId: id, occurrenceNumber: 1 } : {}),
        completed: false,
        failed: false,
        createdAt: now,
      });
    }

    if (trackHabit) ensureHabitOccurrences(data);

    if (!saveData(data)) {
      showToast({ type: 'error', title: '저장하지 못했습니다.', message: '브라우저 저장 공간을 확인하세요.' });
      return;
    }

    modal.destroy();
    if (document.querySelector('.todo-page')) refreshTodo({ scrollToTop: true });
    else document.dispatchEvent(new CustomEvent('planner:datachange'));
    showToast({ type: 'success', title: isEdit ? '할 일을 수정했습니다.' : '할 일을 추가했습니다.' });
  });

  currentModal.open();
  form.querySelector('[name="title"]').focus();
}

function refreshTodo({ scrollToTop = false } = {}) {
  const outlet = document.querySelector('#page-outlet');
  if (!outlet) return;
  outlet.innerHTML = renderTodo();
  if (scrollToTop) outlet.scrollTop = 0;
  initTodoPage();
}

export function initTodoPage() {
  const outlet = document.querySelector('#page-outlet');
  if (!outlet || !outlet.querySelector('.todo-page')) return;

  outlet.querySelectorAll('[data-todo-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.todoFilter;
      activePage = 1;
      refreshTodo({ scrollToTop: true });
    });
  });

  outlet.querySelectorAll('[data-pagination="todo"]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.disabled) return;
      activePage = Number(button.dataset.page);
      refreshTodo();
      outlet.querySelector('.todo-list-heading')?.scrollIntoView({ block: 'start' });
    });
  });

  outlet.querySelector('[data-todo-priority]')?.addEventListener('change', (event) => {
    activePriority = event.target.value;
    activePage = 1;
    refreshTodo();
  });

  outlet.querySelector('[data-todo-category]')?.addEventListener('change', (event) => {
    activeCategory = event.target.value;
    activePage = 1;
    refreshTodo();
  });

  outlet.querySelectorAll('[data-todo-duplicate]').forEach((button) => {
    button.addEventListener('click', () => {
      const source = getData().tasks.find((item) => item.id === button.dataset.todoDuplicate);
      if (!source) return;
      const data = getData();
      const { generatedFromId, ...sourceTask } = source;
      const now = new Date().toISOString();
      const id = createId('task');
      const duplicate = { ...sourceTask, id, title: `${source.title} (복사)`, description: '', completed: false, failed: false, createdAt: now, updatedAt: now };
      if (duplicate.recurrence?.frequency && duplicate.recurrence.frequency !== 'none') {
        duplicate.seriesId = id;
        duplicate.occurrenceNumber = 1;
      } else {
        delete duplicate.seriesId;
        delete duplicate.occurrenceNumber;
      }
      data.tasks.push(duplicate);
      if (duplicate.trackHabit) duplicate.trackHabitSince = duplicate.date;
      if (duplicate.trackHabit) ensureHabitOccurrences(data);
      if (!saveData(data)) { showToast({ type: 'error', title: '복제하지 못했습니다.' }); return; }
      refreshTodo({ scrollToTop: true });
      showToast({ type: 'success', title: '할 일을 복제했습니다.' });
    });
  });

  outlet.querySelectorAll('[data-todo-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      const task = getData().tasks.find((item) => item.id === button.dataset.todoEdit);
      if (task) openTaskModal(task);
    });
  });

  outlet.querySelectorAll('[data-todo-delete]').forEach((button) => {
    button.addEventListener('click', () => {
      const taskId = button.dataset.todoDelete;
      const data = getData();
      const task = data.tasks.find((item) => item.id === taskId);
      if (!task) return;
      if (!window.confirm(`"${task.title}" 할 일을 삭제할까요?`)) return;
      data.tasks = data.tasks.filter((item) => item.id !== taskId);
      if (!saveData(data)) {
        showToast({ type: 'error', title: '삭제하지 못했습니다.' });
        return;
      }
      refreshTodo();
      showToast({ type: 'success', title: '할 일을 삭제했습니다.' });
    });
  });

  outlet.querySelectorAll('[data-todo-toggle]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const data = getData();
      const task = data.tasks.find((item) => item.id === checkbox.dataset.todoToggle);
      if (!task) return;
      const originalTask = { ...task };
      const now = new Date().toISOString();
      task.completed = checkbox.checked;
      task.failed = false;
      task.updatedAt = now;
      const nextTask = checkbox.checked ? createNextRecurringTask(data, task, now) : null;
      if (nextTask) data.tasks.push(nextTask);
      syncHabitLog(data, task);
      if (task.trackHabit) ensureHabitOccurrences(data);
      if (!saveData(data)) {
        Object.assign(task, originalTask);
        if (nextTask) data.tasks = data.tasks.filter((item) => item.id !== nextTask.id);
        checkbox.checked = !checkbox.checked;
        showToast({ type: 'error', title: '상태를 저장하지 못했습니다.' });
        return;
      }
      refreshTodo();
      if (nextTask) showToast({ type: 'success', title: `다음 반복 할 일을 ${nextTask.date}에 추가했습니다.` });
    });
  });

  outlet.querySelectorAll('[data-todo-fail]').forEach((button) => {
    button.addEventListener('click', () => {
      const data = getData();
      const task = data.tasks.find((item) => item.id === button.dataset.todoFail);
      if (!task) return;
      const originalTask = { ...task };
      const now = new Date().toISOString();
      const isFailed = !task.failed || task.completed;
      task.completed = false;
      task.failed = isFailed;
      task.updatedAt = now;
      syncHabitLog(data, task);
      if (task.trackHabit) ensureHabitOccurrences(data);
      if (!saveData(data)) {
        Object.assign(task, originalTask);
        showToast({ type: 'error', title: '상태를 저장하지 못했습니다.' });
        return;
      }
      refreshTodo();
      showToast({ type: 'success', title: isFailed ? '실패로 기록했습니다. 완료 처리하면 다음 반복 회차가 추가됩니다.' : '실패 기록을 취소했습니다.' });
    });
  });
}
