const TITLE_COLORS = [
  { value: '#000000', label: '검정' },
  { value: '#FFFFFF', label: '흰색' },
];

export function normalizeTitleColor(value, fallback = '#000000') {
  const normalized = String(value || '').toUpperCase();
  return TITLE_COLORS.some(({ value: color }) => color === normalized) ? normalized : fallback;
}

export function getContrastingTitleColor(backgroundColor) {
  const channels = String(backgroundColor || '').match(/[\da-f]{2}/gi)?.map((channel) => parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) return '#000000';
  const luminance = channels
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  return luminance > 0.179 ? '#000000' : '#FFFFFF';
}

export function createTitleColorControl(selectedColor = '#000000') {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'title-color-control';
  fieldset.setAttribute('aria-label', '제목 글자색');
  const normalized = normalizeTitleColor(selectedColor);
  fieldset.innerHTML = `<legend class="sr-only">제목 글자색</legend>${TITLE_COLORS.map(({ value, label }) => `<label class="title-color-control__option title-color-control__option--${value === '#000000' ? 'black' : 'white'}" title="${label} 글자"><input type="radio" name="titleColor" value="${value}" aria-label="${label} 글자" ${normalized === value ? 'checked' : ''}><span aria-hidden="true">가</span></label>`).join('')}`;
  return fieldset;
}
