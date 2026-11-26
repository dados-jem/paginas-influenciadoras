import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderLanding, validatePage, priceValues } from '../src/lib/landing.mjs';
import { attributionHref } from '../src/scripts/landing.mjs';
import { argumentsFor } from '../scripts/project.mjs';
import { publicArtifactPath } from '../scripts/delivery.mjs';
const pages = JSON.parse(fs.readFileSync(new URL('../src/content/pages.json', import.meta.url)));
test('a draft cannot become a sale without a real product and approved pricing', () => {
  for (const p of pages) {
    assert.throws(() => validatePage({ ...p, status: 'published' }));
    assert.throws(() => validatePage({ ...p, status: 'published', productUrl: 'https://www.joaoemariaeditora.com.br/combo/' }));
    assert.throws(() => validatePage({ ...p, productUrl: 'https://unrelated.example/product' }));
  }
});
test('verified pricing updates all offer positions and native checkout links', () => {
  const p = { ...pages[0], status: 'published', productUrl: 'https://www.joaoemariaeditora.com.br/combo-da-cassia-kawamura/?cupom=EXISTENTE', pricing: { ...pages[0].pricing, full: 100, verified: true } };
  const rendered = renderLanding('<a href="#oferta">{{price.full}} {{price.retail}} {{price.subscriber}} {{price.retailInstallment}}</a><p class="bn-aviso">provisório</p>', p);
  assert(rendered.includes('100,00 60,00 40,00 5,00'));
  assert(rendered.includes('data-produto-loja') && rendered.includes('cupom=EXISTENTE'));
  assert(!rendered.includes('bn-aviso'));
  assert.equal(priceValues(p).subscriberInstallment, '3,33');
});
test('URL attribution preserves offer parameters and uses the established NEMU visit', () => {
  const n = new URLSearchParams('utm_content=visita%7C%7Cnemu_123');
  const result = new URL(attributionHref('https://www.joaoemariaeditora.com.br/combo/?cupom=ATUAL', '?utm_source=influencer&utm_medium=cassia&utm_content=url&fbclid=original', n));
  assert.equal(result.searchParams.get('cupom'), 'ATUAL');
  assert.equal(result.searchParams.get('utm_source'), 'influencer');
  assert.equal(result.searchParams.get('utm_content'), 'visita||nemu_123');
  assert.equal(result.searchParams.get('fbclid'), 'original');
});
test('deployment is dry-run by default and requires a frozen hash for apply', () => {
  assert.deepEqual(argumentsFor([]), { apply: false, planHash: null });
  assert.throws(() => argumentsFor(['--apply']));
  assert.throws(() => argumentsFor(['--force']));
  assert.throws(() => argumentsFor(['--plan-hash', 'a'.repeat(64)]));
  assert(argumentsFor(['--apply', '--plan-hash', 'a'.repeat(64)]).apply);
});
test('Pages control files and normalized HTML are verified through their real public routes',()=>{
  assert.equal(publicArtifactPath('_headers'),null);
  assert.equal(publicArtifactPath('combo/index.html'),'/combo/');
  assert.equal(publicArtifactPath('index.html'),'/');
  assert.equal(publicArtifactPath('404.html'),'/404');
  assert.equal(publicArtifactPath('_astro/landing.mjs'),'/_astro/landing.mjs');
});
