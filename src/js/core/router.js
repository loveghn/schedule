const TRANSITION_MS = 360;

export function createRouter({ outlet, pages, onRouteChange }) {
  let currentRoute = null;
  let transitioning = false;

  function normalize(path) {
    const route = path.replace(/^\/+|\/+$/g, '');
    return route || 'overview';
  }

  async function render(route, { push = false } = {}) {
    if (transitioning || route === currentRoute) return;
    transitioning = true;

    const page = pages[route] ? route : 'overview';

    if (push) history.pushState({ route: page }, '', `/${page}`);

    outlet.classList.add('is-leaving');
    await new Promise((resolve) => window.setTimeout(resolve, TRANSITION_MS));

    outlet.innerHTML = pages[page]();
    outlet.scrollTop = 0;
    outlet.classList.remove('is-leaving');
    outlet.classList.add('is-entering');

    requestAnimationFrame(() => {
      outlet.classList.remove('is-entering');
    });

    currentRoute = page;
    onRouteChange?.(page);
    transitioning = false;
  }

  return {
    start() {
      const initialRoute = normalize(location.pathname);
      render(initialRoute);
      window.addEventListener('popstate', () => {
        render(normalize(location.pathname));
      });
    },
    navigate(route) {
      render(normalize(route), { push: true });
    },
  };
}