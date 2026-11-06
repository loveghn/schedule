// ========================================
// TOAST COMPONENT
// ========================================

const DEFAULT_DURATION = 4000;
const TOAST_TYPES = ['success', 'error', 'warning', 'info'];

let container = null;
let toastId = 0;

const activeToasts = new Map();
const duplicateKeys = new Map();

// ========================================
// CONTAINER
// ========================================

function getContainer() {
  if (container?.isConnected) return container;

  container = document.createElement('div');
  container.className = 'toast-container';

  container.setAttribute('aria-label', '알림');
  container.setAttribute('aria-relevant', 'additions');

  document.body.append(container);

  return container;
}

// ========================================
// REMOVE TOAST
// ========================================

function removeToast(id, immediate = false) {
  const toastData = activeToasts.get(id);

  if (!toastData) return;

  const {
    element,
    timer,
    duplicateKey,
  } = toastData;

  window.clearTimeout(timer);

  if (duplicateKey) {
    duplicateKeys.delete(duplicateKey);
  }

  activeToasts.delete(id);

  if (immediate) {
    element.remove();
    return;
  }

  element.classList.add('is-leaving');

  window.setTimeout(() => {
    element.remove();
  }, 150);
}

// ========================================
// CREATE TOAST
// ========================================

function createToast({
  type,
  title,
  message,
  duration,
  duplicateKey,
}) {
  const id = ++toastId;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;

  toast.setAttribute(
    'role',
    type === 'error' ? 'alert' : 'status',
  );

  toast.setAttribute(
    'aria-live',
    type === 'error' ? 'assertive' : 'polite',
  );

  toast.setAttribute('aria-atomic', 'true');

  // Indicator
  const indicator = document.createElement('span');
  indicator.className = 'toast__indicator';
  indicator.setAttribute('aria-hidden', 'true');

  // Content
  const content = document.createElement('div');
  content.className = 'toast__content';

  const titleElement = document.createElement('p');
  titleElement.className = 'toast__title';
  titleElement.textContent = title;

  content.append(titleElement);

  if (message) {
    const messageElement = document.createElement('p');

    messageElement.className = 'toast__message';
    messageElement.textContent = message;

    content.append(messageElement);
  }

  // Close button
  const closeButton = document.createElement('button');

  closeButton.type = 'button';
  closeButton.className = 'toast__close';
  closeButton.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">close</span>';
  closeButton.setAttribute('aria-label', '알림 닫기');

  toast.append(indicator, content, closeButton);

  const toastContainer = getContainer();

  toastContainer.append(toast);

    // Timer
  let remainingTime = duration;
  let timer = null;
  let startedAt = 0;

  let isHovered = false;
  let isFocused = false;

  const toastData = {
    element: toast,
    timer: null,
    duplicateKey,
  };

  activeToasts.set(id, toastData);

  if (duplicateKey) {
    duplicateKeys.set(duplicateKey, id);
  }

  function pauseTimer() {
    if (timer === null) return;

    window.clearTimeout(timer);

    remainingTime -= Date.now() - startedAt;

    timer = null;
    toastData.timer = null;
  }

  function resumeTimer() {
    if (
      timer !== null ||
      remainingTime <= 0 ||
      isHovered ||
      isFocused
    ) {
      return;
    }

    startedAt = Date.now();

    timer = window.setTimeout(() => {
      removeToast(id);
    }, remainingTime);

    toastData.timer = timer;
  }

  // Close event
  closeButton.addEventListener('click', () => {
    removeToast(id);
  });

  // Mouse interaction
  toast.addEventListener('mouseenter', () => {
    isHovered = true;
    pauseTimer();
  });

  toast.addEventListener('mouseleave', () => {
    isHovered = false;
    resumeTimer();
  });

  // Keyboard interaction
  toast.addEventListener('focusin', () => {
    isFocused = true;
    pauseTimer();
  });

  toast.addEventListener('focusout', (event) => {
    if (!toast.contains(event.relatedTarget)) {
      isFocused = false;
      resumeTimer();
    }
  });

  resumeTimer();

  return id;
}

// ========================================
// PUBLIC API
// ========================================

export function showToast({
  type = 'info',
  title = '',
  message = '',
  duration = DEFAULT_DURATION,
  duplicateKey = null,
} = {}) {
  const safeType = TOAST_TYPES.includes(type)
    ? type
    : 'info';

  if (!title && !message) return null;

  if (
    duplicateKey &&
    duplicateKeys.has(duplicateKey)
  ) {
    return duplicateKeys.get(duplicateKey);
  }

  const safeDuration = Math.max(
    0,
    Number(duration) || 0,
  );

  return createToast({
    type: safeType,
    title: String(title || message),
    message: title ? String(message) : '',
    duration: safeDuration,
    duplicateKey,
  });
}

export function dismissToast(id) {
  removeToast(id);
}

export function clearToasts() {
  [...activeToasts.keys()].forEach((id) => {
    removeToast(id, true);
  });
}
