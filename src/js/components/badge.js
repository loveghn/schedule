// ========================================
// BADGE COMPONENT
// ========================================

const VARIANTS = [
  'success',
  'pending',
  'progress',
  'cancelled',
  'high',
  'normal',
  'low',
  'category',
  'running',
  'cycling',
  'strength',
  'other',
  'achieved',
  'missed',
];

const SIZES = ['small', 'medium', 'large'];

export function createBadge({
  label = '',
  variant = 'pending',
  size = 'medium',
  dot = false,
  fullWidth = false,
  className = '',
} = {}) {
  const badge = document.createElement('span');

  const safeVariant = VARIANTS.includes(variant)
    ? variant
    : 'pending';

  const safeSize = SIZES.includes(size)
    ? size
    : 'medium';

  badge.className = [
    'badge',
    `badge--${safeVariant}`,
    safeSize !== 'medium' ? `badge--${safeSize}` : '',
    fullWidth ? 'badge--full' : '',
    className,
  ].filter(Boolean).join(' ');

  if (dot) {
    const dotElement = document.createElement('span');

    dotElement.className = 'badge__dot';
    dotElement.setAttribute('aria-hidden', 'true');

    badge.append(dotElement);
  }

  const labelElement = document.createElement('span');

  labelElement.className = 'badge__label';
  labelElement.textContent = label;

  badge.append(labelElement);

  return badge;
}