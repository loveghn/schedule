// ========================================
// FORM COMPONENT
// ========================================

function createElement(tag, className, text = '') {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text) {
    element.textContent = text;
  }

  return element;
}

// ========================================
// FORM GROUP
// ========================================

export function createFormGroup({
  label = '',
  name = '',
  required = false,
  help = '',
  error = '',
  control,
} = {}) {
  if (!(control instanceof HTMLElement)) {
    throw new TypeError('유효한 입력 요소가 필요합니다.');
  }

  const group = createElement('div', 'form-group');
  const id = `form-${name || crypto.randomUUID()}`;

  control.id = id;

  if (name) {
    control.name = name;
  }

  if (label) {
    const labelElement = createElement(
      'label',
      'form-group__label',
    );

    labelElement.htmlFor = id;

    const labelText = createElement(
      'span',
      '',
      label,
    );

    labelElement.append(labelText);

    if (required) {
      const requiredMark = createElement(
        'span',
        'form-group__required',
        '*',
      );

      requiredMark.setAttribute('aria-hidden', 'true');
      labelElement.append(requiredMark);
    }

    group.append(labelElement);
  }

  if (required) {
    control.required = true;
  }

  group.append(control);

  if (help) {
    const helpElement = createElement(
      'span',
      'form-group__help',
      help,
    );

    helpElement.id = `${id}-help`;
    group.append(helpElement);

    control.setAttribute('aria-describedby', helpElement.id);
  }

  if (error) {
    group.classList.add('is-invalid');

    const errorElement = createElement(
      'span',
      'form-group__error',
      error,
    );

    errorElement.id = `${id}-error`;
    errorElement.setAttribute('role', 'alert');

    group.append(errorElement);

    control.setAttribute('aria-invalid', 'true');

    const describedBy = [
      control.getAttribute('aria-describedby'),
      errorElement.id,
    ].filter(Boolean);

    control.setAttribute(
      'aria-describedby',
      describedBy.join(' '),
    );
  }

  return group;
}

// ========================================
// INPUT
// ========================================

export function createInput({
  type = 'text',
  placeholder = '',
  value = '',
  min,
  max,
  step,
  required = false,
  disabled = false,
  ...groupOptions
} = {}) {
  const allowedTypes = [
    'text',
    'number',
    'date',
    'time',
    'email',
    'search',
  ];

  if (!allowedTypes.includes(type)) {
    throw new TypeError('지원하지 않는 입력 유형입니다.');
  }

  const input = createElement(
    'input',
    'form-control',
  );

  input.type = type;
  input.placeholder = placeholder;
  input.value = value;
  input.disabled = disabled;

  if (min !== undefined) input.min = min;
  if (max !== undefined) input.max = max;
  if (step !== undefined) input.step = step;

  return createFormGroup({
    ...groupOptions,
    required,
    control: input,
  });
}

// ========================================
// TEXTAREA
// ========================================

export function createTextarea({
  placeholder = '',
  value = '',
  rows = 4,
  required = false,
  disabled = false,
  ...groupOptions
} = {}) {
  const textarea = createElement(
    'textarea',
    'form-control form-control--textarea',
  );

  textarea.placeholder = placeholder;
  textarea.value = value;
  textarea.rows = rows;
  textarea.disabled = disabled;

  return createFormGroup({
    ...groupOptions,
    required,
    control: textarea,
  });
}

// ========================================
// SELECT
// ========================================

export function createSelect({
  options = [],
  value = '',
  required = false,
  disabled = false,
  placeholder = '선택하세요',
  ...groupOptions
} = {}) {
  const select = createElement(
    'select',
    'form-control form-control--select',
  );

  select.disabled = disabled;

  const placeholderOption = createElement(
    'option',
    '',
    placeholder,
  );

  placeholderOption.value = '';
  placeholderOption.disabled = true;

  select.append(placeholderOption);

  options.forEach((option) => {
    const item = createElement(
      'option',
      '',
      option.label,
    );

    item.value = String(option.value);

    select.append(item);
  });

  select.value = value;

  return createFormGroup({
    ...groupOptions,
    required,
    control: select,
  });
}

// ========================================
// CHECKBOX
// ========================================

export function createCheckbox({
  label = '',
  name = '',
  checked = false,
  disabled = false,
} = {}) {
  const wrapper = createElement(
    'label',
    'form-check',
  );

  const checkbox = createElement(
    'input',
    'form-check__input',
  );

  checkbox.type = 'checkbox';
  checkbox.name = name;
  checkbox.checked = checked;
  checkbox.disabled = disabled;

  const labelElement = createElement(
    'span',
    'form-check__label',
    label,
  );

  wrapper.append(checkbox, labelElement);

  return wrapper;
}