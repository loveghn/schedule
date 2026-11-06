import { APP_CONFIG, PAGE_CONFIG } from '../core/app-config.js';

const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

export function renderPageHeader(pageId, { meta = '', metaDateTime = '', eyebrow = '', variant = 'default' } = {}) {
  const page = PAGE_CONFIG[pageId];
  if (!page) throw new Error(`페이지 설정을 찾을 수 없습니다: ${pageId}`);

  const metaMarkup = metaDateTime
    ? `<time datetime="${escapeHTML(metaDateTime)}">${escapeHTML(meta)}</time>`
    : `<span>${escapeHTML(meta)}</span>`;
  const pageClass = variant === 'overview' ? 'overview-header' : 'page-heading';
  const indexClass = variant === 'overview' ? 'overview-header__index' : 'page-index';

  return `<div class="page-kicker"><span>${page.number} / ${escapeHTML(page.kicker)}</span>${metaMarkup}</div>
    <header class="${pageClass}"><div><p class="eyebrow">${escapeHTML(eyebrow || page.eyebrow)}</p><h1>${escapeHTML(page.title)}<span class="title-period">.</span></h1>${page.description ? `<p>${escapeHTML(page.description)}</p>` : ''}</div><span class="${indexClass}" aria-hidden="true">${page.number}</span></header>
    ${variant === 'overview' ? '' : '<div class="page-rule"></div>'}`;
}

export function renderBrand() {
  return `<span>${escapeHTML(APP_CONFIG.name.split(' ')[0])}</span><span>${escapeHTML(APP_CONFIG.name.split(' ').slice(1).join(' '))}</span>`;
}
