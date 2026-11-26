export const amount = value => Number(value).toFixed(2).replace('.', ',');
export function priceValues(page) {
  const p = page.pricing;
  const retail = Math.round(p.full * (100 - p.retailDiscount)) / 100;
  const subscriber = Math.round(p.full * (100 - p.subscriberDiscount)) / 100;
  return { full: amount(p.full), retail: amount(retail), subscriber: amount(subscriber), retailInstallment: amount(retail / p.installments), subscriberInstallment: amount(subscriber / p.installments) };
}
export function validatePage(page) {
  if (!/^[a-z0-9-]+$/.test(page.slug) || !/^[a-z0-9-]+$/.test(page.key)) throw Error('Invalid page identity');
  if (!['draft', 'published'].includes(page.status)) throw Error('Invalid publication status');
  const p = page.pricing;
  if (!Number.isFinite(p.full) || p.full <= 0 || !Number.isInteger(p.installments) || p.installments < 1) throw Error('Invalid pricing');
  for (const k of ['retailDiscount', 'subscriberDiscount']) if (!Number.isFinite(p[k]) || p[k] < 0 || p[k] >= 100) throw Error('Invalid discount');
  if (page.productUrl) {
    const u = new URL(page.productUrl);
    if (u.protocol !== 'https:' || u.hostname !== 'www.joaoemariaeditora.com.br' || u.username || u.password || u.hash) throw Error('Product URL must belong to the J&M store');
  }
  if (page.status === 'published' && (!page.productUrl || p.verified !== true)) throw Error('Final product URL and verified pricing are required before publishing commercially');
  return page;
}
export function renderLanding(raw, page) {
  validatePage(page);
  if (/<script\b|\son[a-z]+\s*=|javascript:/i.test(raw)) throw Error('Body content must not contain executable scripts');
  let result = raw;
  for (const [key, value] of Object.entries(priceValues(page))) result = result.replaceAll('{{price.' + key + '}}', value);
  if (/\{\{price\./.test(result)) throw Error('Unresolved price placeholder');
  if (page.status === 'published') {
    const href = page.productUrl.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
    result = result.replaceAll('href="#oferta"', 'href="' + href + '" data-produto-loja');
    result = result.replace(/<p class="bn-aviso">[\s\S]*?<\/p>/g, '');
  }
  return result;
}
