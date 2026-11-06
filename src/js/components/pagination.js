const PAGE_SIZE = 10;

export function renderPagination({ page, totalItems, attribute }) {
  const pageCount = Math.ceil(totalItems / PAGE_SIZE);
  if (pageCount < 2) return '';

  const visiblePages = new Set([1, pageCount]);
  for (let candidate = Math.max(1, page - 1); candidate <= Math.min(pageCount, page + 1); candidate += 1) {
    visiblePages.add(candidate);
  }
  const orderedPages = [...visiblePages].sort((a, b) => a - b);
  const pageButtons = orderedPages.map((pageNumber, index) => {
    const previousPage = orderedPages[index - 1];
    const gap = previousPage && pageNumber - previousPage > 1 ? '<span class="pagination__ellipsis" aria-hidden="true">…</span>' : '';
    return `${gap}<button type="button" class="btn btn--outline btn--small pagination__page ${pageNumber === page ? 'is-current' : ''}" data-pagination="${attribute}" data-page="${pageNumber}" ${pageNumber === page ? 'aria-current="page"' : ''}>${pageNumber}</button>`;
  }).join('');

  return `<nav class="pagination" aria-label="목록 페이지 이동"><button type="button" class="btn btn--outline btn--small pagination__step" data-pagination="${attribute}" data-page="${page - 1}" aria-label="이전 페이지" ${page <= 1 ? 'disabled' : ''}><span class="material-symbols-outlined" aria-hidden="true">chevron_left</span><span>이전</span></button><div class="pagination__pages">${pageButtons}</div><button type="button" class="btn btn--outline btn--small pagination__step" data-pagination="${attribute}" data-page="${page + 1}" aria-label="다음 페이지" ${page >= pageCount ? 'disabled' : ''}><span>다음</span><span class="material-symbols-outlined" aria-hidden="true">chevron_right</span></button></nav>`;
}

export const PAGINATION_PAGE_SIZE = PAGE_SIZE;
