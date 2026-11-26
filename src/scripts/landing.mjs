const FIELDS = ['src', 'sck', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'gclid', 'fbclid'];
export function attributionHref(href, query, nemu) {
  const link = new URL(href);
  const params = new URLSearchParams(query);
  for (const key of FIELDS) {
    const value = (nemu?.get?.(key)) || params.get(key);
    if (value) link.searchParams.set(key, value);
  }
  return link.href;
}
if (typeof document !== 'undefined' && !window.__jmInfluencerLandingReady) {
  window.__jmInfluencerLandingReady = true;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let frame;
  function update() {
    frame = undefined;
    for (const rail of document.querySelectorAll('.depo__trilho')) {
      const nav = rail.parentElement.querySelector('.depo__nav');
      if (!nav) continue;
      const max = rail.scrollWidth - rail.clientWidth - 2;
      nav.hidden = max <= 0;
      nav.querySelector('[data-dir="-1"]').disabled = rail.scrollLeft <= 2;
      nav.querySelector('[data-dir="1"]').disabled = rail.scrollLeft >= max;
    }
  }
  function schedule() { if (frame === undefined) frame = requestAnimationFrame(update); }
  function tag(anchor) {
    if (!anchor?.hasAttribute('data-produto-loja')) return;
    anchor.href = attributionHref(anchor.href, location.search, window.trackingNemu?.nemuUtms);
  }
  function tagAll() { document.querySelectorAll('a[data-produto-loja]').forEach(tag); }
  document.addEventListener('click', event => {
    const button = event.target.closest?.('.depo__seta');
    if (!button) return;
    const rail = button.closest('.depo__carrossel').querySelector('.depo__trilho');
    const cards = rail.querySelectorAll('.depo__card');
    if (cards.length < 2) return;
    const step = cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().left;
    const count = Math.max(1, Math.floor((rail.clientWidth + 2) / step));
    const target = Math.round(rail.scrollLeft / step) + Number(button.dataset.dir) * count;
    rail.scrollTo({ left: Math.max(0, Math.min(cards.length - 1, target)) * step, behavior: reduced ? 'auto' : 'smooth' });
    schedule();
  });
  for (const event of ['click', 'auxclick', 'contextmenu']) document.addEventListener(event, e => tag(e.target.closest?.('a[data-produto-loja]')), true);
  document.addEventListener('scroll', e => { if (e.target.classList?.contains('depo__trilho')) schedule(); }, true);
  addEventListener('resize', schedule, { passive: true });
  tagAll(); schedule();
}
