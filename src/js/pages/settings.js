import { createId, getData, isValidInboxItem, saveData } from '../core/storage.js';
import { ensureSettings, isHexColor, normalizeColorCode } from '../core/settings.js';
import { createModal } from '../components/modal.js';
import { createButton } from '../components/button.js';
import { showToast } from '../components/toast.js';
import { renderPageHeader } from '../components/page-header.js';

const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function renderCategory(category, data) {
  const count = data.tasks.filter((task) => task.category === category.name).length;
  const color = isHexColor(category.color) ? category.color.toUpperCase() : '#EDEDED';
  return `<li class="settings-category">
    <span class="settings-category__swatch" style="--category-color:${color}" aria-hidden="true"></span>
    <div class="settings-category__details"><strong>${escapeHTML(category.name)}</strong><span>${color} · 할 일 ${count}개</span></div>
    <div class="settings-category__actions">
      <button type="button" class="btn btn--outline btn--icon" data-category-edit="${escapeHTML(category.id)}" aria-label="${escapeHTML(category.name)} 수정" title="수정"><span class="material-symbols-outlined" aria-hidden="true">edit</span></button>
      <button type="button" class="btn btn--danger btn--icon" data-category-delete="${escapeHTML(category.id)}" aria-label="${escapeHTML(category.name)} 삭제" title="삭제"><span class="material-symbols-outlined" aria-hidden="true">delete</span></button>
    </div>
  </li>`;
}

export function renderSettings() {
  const data = getData();
  if (ensureSettings(data)) saveData(data);
  const defaults = data.settings.taskDefaults;
  const categories = [...data.categories].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
  const categoryOptions = [{ value: '', label: '선택 안 함' }, ...categories.map(({ name }) => ({ value: name, label: name }))];

  return `<article class="page page--settings settings-page">
    ${renderPageHeader('settings', { meta: '기본 설정' })}

    <section class="settings-section" aria-labelledby="settings-categories-title">
      <div class="settings-section__heading"><div><p class="settings-section__index">TASK CATEGORIES</p><h2 id="settings-categories-title">할 일 카테고리</h2><p>카테고리와 색상은 할 일 등록, 필터, 목록 표시에 함께 적용됩니다.</p></div><button type="button" class="btn btn--primary btn--icon" data-category-add aria-label="카테고리 추가" title="카테고리 추가"><span class="material-symbols-outlined" aria-hidden="true">add</span></button></div>
      ${categories.length ? `<ul class="settings-category-list">${categories.map((category) => renderCategory(category, data)).join('')}</ul>` : `<div class="settings-empty"><strong>등록된 카테고리가 없습니다.</strong><span>추가 버튼으로 첫 카테고리를 만들어 보세요.</span></div>`}
    </section>

    <section class="settings-section" aria-labelledby="settings-task-defaults-title">
      <div class="settings-section__heading"><div><p class="settings-section__index">TASK DEFAULTS</p><h2 id="settings-task-defaults-title">할 일 기본값</h2><p>새 할 일 모달을 열었을 때 미리 선택할 값을 지정합니다.</p></div></div>
      <form class="settings-defaults" data-task-defaults-form>
        <label class="form-group"><span class="form-group__label">기본 우선순위</span><select class="form-control form-control--select" name="priority"><option value="high" ${defaults.priority === 'high' ? 'selected' : ''}>높음</option><option value="normal" ${defaults.priority === 'normal' ? 'selected' : ''}>보통</option><option value="low" ${defaults.priority === 'low' ? 'selected' : ''}>낮음</option></select></label>
        <label class="form-group"><span class="form-group__label">기본 카테고리</span><select class="form-control form-control--select" name="category">${categoryOptions.map(({ value, label }) => `<option value="${escapeHTML(value)}" ${defaults.category === value ? 'selected' : ''}>${escapeHTML(label)}</option>`).join('')}</select></label>
        <button type="submit" class="btn btn--primary">기본값 저장</button>
      </form>
    </section>

    <section class="settings-section" aria-labelledby="settings-data-title">
      <div class="settings-section__heading"><div><p class="settings-section__index">LOCAL DATA</p><h2 id="settings-data-title">데이터 백업</h2><p>모든 일정, 할 일, 습관 기록과 설정을 이 기기에서 파일로 관리합니다.</p></div></div>
      <div class="settings-data-actions"><button type="button" class="btn btn--outline" data-data-export><span class="material-symbols-outlined" aria-hidden="true">download</span> 백업 파일 내보내기</button><button type="button" class="btn btn--outline" data-data-import><span class="material-symbols-outlined" aria-hidden="true">upload</span> 백업 파일 가져오기</button><input type="file" accept=".json,application/json" data-backup-file hidden></div>
      <p class="settings-data-note">가져오기는 현재 브라우저의 데이터를 백업 파일 내용으로 교체합니다. 가져오기 전에 현재 데이터를 내보내 보관하세요.</p>
    </section>
  </article>`;
}

function refreshSettings() {
  const outlet = document.querySelector('#page-outlet');
  if (!outlet) return;
  outlet.innerHTML = renderSettings();
  initSettingsPage();
}

function openCategoryModal(category = null) {
  const form = document.createElement('form');
  form.className = 'settings-category-form';
  const initialColor = normalizeColorCode(category?.color) || '#00C3FF';
  form.innerHTML = `<div class="form-group"><label class="form-group__label" for="settings-category-name">카테고리 이름</label><input class="form-control" id="settings-category-name" name="name" type="text" maxlength="24" placeholder="예: 독서" value="${escapeHTML(category?.name || '')}" required></div><fieldset class="settings-color-field"><legend class="form-group__label">카테고리 색상</legend><div class="settings-color-inputs"><label class="settings-color-swatch-label" for="settings-category-color-picker"><span class="sr-only">색상 선택기</span><input id="settings-category-color-picker" type="color" value="${initialColor}" aria-label="카테고리 색상 선택"></label><label class="form-group"><span class="sr-only">HEX 컬러코드</span><input class="form-control settings-color-code" name="colorCode" type="text" inputmode="text" autocapitalize="characters" spellcheck="false" maxlength="7" pattern="#[0-9A-Fa-f]{6}" placeholder="#00C3FF" value="${initialColor}" aria-describedby="settings-color-help" required></label><p class="form-group__help" id="settings-color-help">HEX 컬러코드 형식으로 입력하세요. 예: #00C3FF</p></div></fieldset>`;
  const colorPicker = form.querySelector('[type="color"]');
  const colorCode = form.querySelector('[name="colorCode"]');
  colorPicker.addEventListener('input', () => { colorCode.value = colorPicker.value.toUpperCase(); });
  colorCode.addEventListener('input', () => {
    if (isHexColor(colorCode.value.trim())) colorPicker.value = colorCode.value.trim();
  });
  const footer = document.createElement('div');
  footer.className = 'form-actions';
  const cancel = createButton({ label: '취소', variant: 'outline' });
  const submit = createButton({ label: category ? '수정 저장' : '카테고리 추가', variant: 'primary', type: 'submit' });
  submit.setAttribute('form', 'settings-category-form');
  form.id = 'settings-category-form';
  footer.append(cancel, submit);
  const modal = createModal({ title: category ? '카테고리 수정' : '카테고리 추가', description: '할 일에서 사용할 이름과 색상을 지정하세요.', content: form, footer });
  modal.element.addEventListener('close', () => modal.element.remove(), { once: true });
  cancel.addEventListener('click', () => modal.close('cancel'));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = String(new FormData(form).get('name') || '').trim();
    const colorInput = String(new FormData(form).get('colorCode') || '').trim();
    if (!name) { form.elements.namedItem('name').focus(); showToast({ type: 'warning', title: '카테고리 이름을 입력하세요.' }); return; }
    if (!isHexColor(colorInput)) { colorCode.focus(); showToast({ type: 'warning', title: 'HEX 컬러코드를 #RRGGBB 형식으로 입력하세요.' }); return; }
    const color = colorInput.toUpperCase();
    const data = getData();
    ensureSettings(data);
    const duplicateName = data.categories.some((item) => item.name.toLocaleLowerCase('ko') === name.toLocaleLowerCase('ko') && item.id !== category?.id);
    if (duplicateName) { form.elements.namedItem('name').focus(); showToast({ type: 'warning', title: '이미 사용 중인 카테고리 이름입니다.' }); return; }
    if (category) {
      const target = data.categories.find((item) => item.id === category.id);
      if (!target) return;
      const previousName = target.name;
      target.name = name;
      target.color = color;
      data.tasks.forEach((task) => {
        if (task.category === previousName) { task.category = name; task.categoryColor = target.color; }
      });
      if (data.settings.taskDefaults.category === previousName) data.settings.taskDefaults.category = name;
    } else {
      data.categories.push({ id: createId('category'), name, color, createdAt: new Date().toISOString() });
    }
    if (!saveData(data)) { showToast({ type: 'error', title: '카테고리를 저장하지 못했습니다.', message: '브라우저 저장 공간을 확인하세요.' }); return; }
    modal.close('saved');
    document.dispatchEvent(new CustomEvent('planner:datachange'));
    showToast({ type: 'success', title: category ? '카테고리를 수정했습니다.' : '카테고리를 추가했습니다.' });
  });
  modal.open();
  requestAnimationFrame(() => form.elements.namedItem('name')?.focus());
}

function openDeleteCategoryModal(category) {
  const data = getData();
  const count = data.tasks.filter((task) => task.category === category.name).length;
  const message = document.createElement('p');
  message.className = 'settings-delete-message';
  message.textContent = count
    ? `“${category.name}” 카테고리를 삭제합니다. 연결된 할 일 ${count}개는 유지하고 카테고리만 해제합니다.`
    : `“${category.name}” 카테고리를 삭제할까요?`;
  const footer = document.createElement('div');
  footer.className = 'form-actions';
  const cancel = createButton({ label: '취소', variant: 'outline' });
  const confirm = createButton({ label: '카테고리 삭제', variant: 'danger' });
  footer.append(cancel, confirm);
  const modal = createModal({ title: '카테고리 삭제', description: '이 작업은 되돌릴 수 없습니다.', content: message, footer });
  modal.element.addEventListener('close', () => modal.element.remove(), { once: true });
  cancel.addEventListener('click', () => modal.close('cancel'));
  confirm.addEventListener('click', () => {
    const current = getData();
    ensureSettings(current);
    current.categories = current.categories.filter((item) => item.id !== category.id);
    current.tasks.forEach((task) => {
      if (task.category === category.name) { task.category = ''; task.categoryColor = '#EDEDED'; }
    });
    if (current.settings.taskDefaults.category === category.name) current.settings.taskDefaults.category = '';
    if (!saveData(current)) { showToast({ type: 'error', title: '카테고리를 삭제하지 못했습니다.' }); return; }
    modal.close('deleted');
    document.dispatchEvent(new CustomEvent('planner:datachange'));
    showToast({ type: 'success', title: '카테고리를 삭제했습니다.' });
  });
  modal.open();
}

export function isValidBackup(value) {
  const candidate = value?.app === 'MY SCHEDULE' ? value.data : value;
  const arrays = ['events', 'tasks', 'habits', 'habitLogs', 'activities'];
  if (!candidate || typeof candidate !== 'object' || arrays.some((key) => !Array.isArray(candidate[key]))) return false;
  if (arrays.some((key) => !candidate[key].every((item) => item && typeof item === 'object' && !Array.isArray(item)))) return false;
  if (candidate.inbox !== undefined && (!Array.isArray(candidate.inbox) || !candidate.inbox.every(isValidInboxItem))) return false;
  return !Array.isArray(candidate.categories) || candidate.categories.every((item) => item && typeof item === 'object' && typeof item.name === 'string');
}

export function normalizeImportedData(imported) {
  return {
    ...imported,
    version: imported.version || 1,
    events: imported.events,
    tasks: imported.tasks,
    inbox: imported.inbox ?? [],
    habits: imported.habits,
    habitLogs: imported.habitLogs,
    activities: imported.activities,
    categories: Array.isArray(imported.categories) ? imported.categories.filter((item) => item && typeof item === 'object' && typeof item.name === 'string') : [],
    settings: imported.settings && typeof imported.settings === 'object' && !Array.isArray(imported.settings) ? imported.settings : {},
  };
}

export function createBackupPayload(data) {
  return { app: 'MY SCHEDULE', version: data.version || 1, exportedAt: new Date().toISOString(), data };
}

function showImportConfirmation(imported) {
  const details = document.createElement('p');
  details.className = 'settings-delete-message';
  details.textContent = `일정 ${imported.events.length}개, 할 일 ${imported.tasks.length}개, 카테고리 ${imported.categories?.length || 0}개를 가져옵니다. 현재 데이터는 백업 파일 내용으로 교체됩니다.`;
  const footer = document.createElement('div');
  footer.className = 'form-actions';
  const cancel = createButton({ label: '취소', variant: 'outline' });
  const confirm = createButton({ label: '데이터 교체', variant: 'danger' });
  footer.append(cancel, confirm);
  const modal = createModal({ title: '백업 데이터 가져오기', description: '가져오기 전 현재 데이터 백업을 권장합니다.', content: details, footer });
  modal.element.addEventListener('close', () => modal.element.remove(), { once: true });
  cancel.addEventListener('click', () => modal.close('cancel'));
  confirm.addEventListener('click', () => {
    const replacement = normalizeImportedData(imported);
    ensureSettings(replacement);
    if (!saveData(replacement)) { showToast({ type: 'error', title: '데이터를 가져오지 못했습니다.', message: '브라우저 저장 공간을 확인하세요.' }); return; }
    modal.close('imported');
    document.dispatchEvent(new CustomEvent('planner:datachange'));
    showToast({ type: 'success', title: '백업 데이터를 가져왔습니다.' });
  });
  modal.open();
}

export function initSettingsPage() {
  const outlet = document.querySelector('#page-outlet');
  if (!outlet?.querySelector('.settings-page')) return;

  outlet.querySelector('[data-category-add]')?.addEventListener('click', () => openCategoryModal());
  outlet.querySelectorAll('[data-category-edit]').forEach((button) => button.addEventListener('click', () => {
    const category = getData().categories.find((item) => item.id === button.dataset.categoryEdit);
    if (category) openCategoryModal(category);
  }));
  outlet.querySelectorAll('[data-category-delete]').forEach((button) => button.addEventListener('click', () => {
    const category = getData().categories.find((item) => item.id === button.dataset.categoryDelete);
    if (category) openDeleteCategoryModal(category);
  }));

  outlet.querySelector('[data-task-defaults-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const data = getData();
    ensureSettings(data);
    const category = String(values.get('category') || '');
    data.settings.taskDefaults = {
      priority: ['high', 'normal', 'low'].includes(values.get('priority')) ? values.get('priority') : 'normal',
      category: data.categories.some((item) => item.name === category) ? category : '',
    };
    if (!saveData(data)) { showToast({ type: 'error', title: '기본값을 저장하지 못했습니다.' }); return; }
    showToast({ type: 'success', title: '할 일 기본값을 저장했습니다.' });
  });

  outlet.querySelector('[data-data-export]')?.addEventListener('click', () => {
    try {
      const data = getData();
      ensureSettings(data);
      const backup = createBackupPayload(data);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `my-schedule-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast({ type: 'success', title: '백업 파일을 내보냈습니다.' });
    } catch (error) {
      console.error('[MY SCHEDULE] 백업 내보내기 실패:', error);
      showToast({ type: 'error', title: '백업 파일을 만들지 못했습니다.' });
    }
  });

  const fileInput = outlet.querySelector('[data-backup-file]');
  const importButton = outlet.querySelector('[data-data-import]');
  importButton?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    importButton.disabled = true;
    importButton.setAttribute('aria-busy', 'true');
    try {
      const parsed = JSON.parse(await file.text());
      const imported = parsed?.app === 'MY SCHEDULE' ? parsed.data : parsed;
      if (!isValidBackup(parsed)) throw new Error('지원하지 않는 백업 파일 형식입니다.');
      showImportConfirmation(imported);
    } catch (error) {
      console.error('[MY SCHEDULE] 백업 가져오기 실패:', error);
      showToast({ type: 'error', title: '백업 파일을 읽지 못했습니다.', message: error instanceof SyntaxError ? 'JSON 형식이 올바르지 않습니다.' : error.message });
    } finally {
      importButton.disabled = false;
      importButton.removeAttribute('aria-busy');
      fileInput.value = '';
    }
  });
}
