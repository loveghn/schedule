// ========================================
// MODAL COMPONENT
// ========================================

export function createModal({
  title = '새 항목',
  description = '',
  content = null,
  footer = null,
  closeOnBackdrop = true,
  onOpen = null,
  onClose = null,
} = {}) {
  const dialog = document.createElement('dialog');

  dialog.className = 'modal';

  dialog.setAttribute('aria-labelledby', 'modal-title');

  const container = document.createElement('div');
  container.className = 'modal__container';

  // Header
  const header = document.createElement('header');
  header.className = 'modal__header';

  const heading = document.createElement('div');
  heading.className = 'modal__heading';

  const titleElement = document.createElement('h2');
  titleElement.className = 'modal__title';
  titleElement.id = 'modal-title';
  titleElement.textContent = title;

  heading.append(titleElement);

  if (description) {
    const descriptionElement = document.createElement('p');

    descriptionElement.className = 'modal__description';
    descriptionElement.textContent = description;

    descriptionElement.id = 'modal-description';

    dialog.setAttribute(
      'aria-describedby',
      'modal-description',
    );

    heading.append(descriptionElement);
  }

  const closeButton = document.createElement('button');

  closeButton.type = 'button';
  closeButton.className = 'modal__close';
  closeButton.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">close</span>';
  closeButton.setAttribute('aria-label', '모달 닫기');

  header.append(heading, closeButton);

  // Body
  const body = document.createElement('div');
  body.className = 'modal__body';

  if (content instanceof Node) {
    body.append(content);
  }

  // Footer
  let footerElement = null;

  if (footer instanceof Node) {
    footerElement = document.createElement('footer');
    footerElement.className = 'modal__footer';
    footerElement.append(footer);
  }

  container.append(header, body);

  if (footerElement) {
    container.append(footerElement);
  }

  dialog.append(container);

  // Focus management
  let previousFocus = null;

  function open() {
    if (dialog.open) return;

    previousFocus = document.activeElement;

    dialog.showModal();

    document.body.classList.add('has-open-modal');

    onOpen?.(dialog);
  }

  function close(returnValue = '') {
    if (!dialog.open) return;

    dialog.close(returnValue);
  }

  closeButton.addEventListener('click', () => {
    close('cancel');
  });

  // Backdrop click
  dialog.addEventListener('click', (event) => {
    if (
      closeOnBackdrop &&
      event.target === dialog
    ) {
      close('backdrop');
    }
  });

  // Close event
  dialog.addEventListener('close', () => {
    document.body.classList.remove('has-open-modal');

    if (previousFocus instanceof HTMLElement) {
      previousFocus.focus();
    }

    onClose?.(dialog.returnValue);
  });

  // Content
  document.body.append(dialog);

  return {
    element: dialog,
    body,
    open,
    close,

    setTitle(value) {
      titleElement.textContent = value;
    },

    setDescription(value) {
      let descriptionElement = heading.querySelector(
        '.modal__description',
      );

      if (!value) {
        descriptionElement?.remove();
        dialog.removeAttribute('aria-describedby');
        return;
      }

      if (!descriptionElement) {
        descriptionElement = document.createElement('p');
        descriptionElement.className = 'modal__description';
        descriptionElement.id = 'modal-description';

        heading.append(descriptionElement);
      }

      descriptionElement.textContent = value;

      dialog.setAttribute(
        'aria-describedby',
        'modal-description',
      );
    },

    setContent(element) {
      body.replaceChildren(element);
    },

    destroy() {
      close('destroy');
      dialog.remove();
    },
  };
}
