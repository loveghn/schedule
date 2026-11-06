// ========================================
// BUTTON COMPONENT
// ========================================

const VARIANTS = [
  'primary',
  'secondary',
  'outline',
  'pink',
  'danger',
];

const SIZES = [
  'small',
  'medium',
  'large',
];

export function createButton({
  label = '버튼',
  variant = 'primary',
  size = 'medium',
  type = 'button',
  disabled = false,
  fullWidth = false,
  icon = null,
  onClick = null,
  className = '',
} = {}) {
  const button = document.createElement('button');

  const safeVariant = VARIANTS.includes(variant)
    ? variant
    : 'primary';

  const safeSize = SIZES.includes(size)
    ? size
    : 'medium';

  button.type = type;
  button.className = [
    'btn',
    `btn--${safeVariant}`,
    `btn--${safeSize}`,
    fullWidth ? 'btn--full' : '',
    className,
  ].filter(Boolean).join(' ');

  button.disabled = disabled;

  if (icon instanceof Node) {
    button.append(icon);
  }

  const labelElement = document.createElement('span');

  labelElement.className = 'btn__label';
  labelElement.textContent = label;

  button.append(labelElement);

  if (typeof onClick === 'function') {
    button.addEventListener('click', onClick);
  }

  return button;
}

// ========================================
// BUTTON LOADING
// ========================================

export function setButtonLoading(button, loading = true) {
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  if (loading) {
    button.dataset.previousDisabled = String(button.disabled);
    button.disabled = true;
    button.classList.add('is-loading');
    button.setAttribute('aria-busy', 'true');
  } else {
    button.disabled = button.dataset.previousDisabled === 'true';
    button.classList.remove('is-loading');
    button.removeAttribute('aria-busy');
    delete button.dataset.previousDisabled;
  }
}