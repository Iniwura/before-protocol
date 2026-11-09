// An optional, accessible three-step tour of the real BEFORE Support workflow.
// It never calls a wallet, mutates an offer, starts a transfer or fabricates proof.
export const TOUR_STEPS = Object.freeze([
  Object.freeze({
    target: '#create-support-card',
    title: 'Create a signed support link',
    description: 'Choose the WIF amount and sign. Signing the link moves no tokens.'
  }),
  Object.freeze({
    target: '#open-support-card',
    title: 'A supporter checks the request',
    description: 'Open the link to see exact terms. Payment always needs a separate wallet confirmation.'
  }),
  Object.freeze({
    target: '#public-history-card',
    title: 'Verify what happened',
    description: 'Search a recipient’s incoming WIF transfers and open genuine public receipts. No wallet needed.'
  })
]);

export function mountSupportTour(root = document) {
  const start = root.getElementById('support-tour-start');
  const panel = root.getElementById('support-tour-panel');
  const next = root.getElementById('support-tour-next');
  const close = root.getElementById('support-tour-close');
  const heading = root.getElementById('support-tour-title');
  const copy = root.getElementById('support-tour-copy');
  const counter = root.getElementById('support-tour-counter');
  if (![start, panel, next, close, heading, copy, counter].every(Boolean)) return null;
  const url = new URL(root.defaultView.location.href);
  const signedPage = url.searchParams.has('offer');
  // A received payment link is already a task. Never interrupt that flow.
  if (signedPage) { start.hidden = true; return {start: () => false, close: () => {}}; }
  let step = -1;
  let highlighted = null;
  const clearTarget = () => {
    highlighted?.classList.remove('support-tour-focus');
    highlighted = null;
  };
  const exit = (restoreFocus = false) => {
    const wasOpen = !panel.hidden;
    panel.hidden = true;
    start.setAttribute('aria-expanded', 'false');
    clearTarget();
    step = -1;
    if (restoreFocus && wasOpen && start.isConnected) start.focus({preventScroll: true});
  };
  const show = index => {
    const data = TOUR_STEPS[index];
    const target = root.querySelector(data.target);
    if (!target || target.hidden) { exit(); return false; }
    clearTarget();
    step = index;
    highlighted = target;
    target.classList.add('support-tour-focus');
    counter.textContent = (index + 1) + ' / ' + TOUR_STEPS.length;
    heading.textContent = data.title;
    copy.textContent = data.description;
    next.textContent = index === TOUR_STEPS.length - 1 ? 'Create a support link' : 'Next step';
    panel.hidden = false;
    start.setAttribute('aria-expanded', 'true');
    target.scrollIntoView({
      behavior: root.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'center'
    });
    panel.focus({preventScroll: true});
    return true;
  };
  const begin = () => show(0);
  start.addEventListener('click', begin);
  next.addEventListener('click', () => {
    if (step < 0) return;
    if (step < TOUR_STEPS.length - 1) { show(step + 1); return; }
    exit();
    const create = root.querySelector('#create-support-card');
    create?.scrollIntoView({behavior: 'smooth', block: 'start'});
    root.getElementById('support-amount')?.focus({preventScroll: true});
  });
  close.addEventListener('click', () => exit(true));
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) exit(true); });
  // The URL allows reviewers to deliberately open a tour; no forced first-load modal.
  if (url.searchParams.get('tour') === '1') begin();
  return {start: begin, close: () => exit(), get step() {return step;}};
}
if (typeof document !== 'undefined') mountSupportTour();
