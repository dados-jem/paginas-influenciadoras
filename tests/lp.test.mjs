import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeLpManifest, namespaceAssets,assertNoRedirectCollisions } from '../scripts/lp-artifact.mjs';
const old = Object.fromEntries(Array.from({ length: 105 }, (_, i) => ['/existing/' + i + '.webp', 'a'.repeat(32)]));
const page = '/combo-da-forja-diaria/index.html';
test('publishing a page preserves every unrelated native asset', () => {
  const result = mergeLpManifest(old, { [page]: 'b'.repeat(32) },[],[page]);
  assert.deepEqual(result.preserved, old);
  for (const [file, hash] of Object.entries(old)) assert.equal(result.full[file], hash);
  assert.equal(result.full[page], 'b'.repeat(32));
});
test('a page update requires proof of the prior target and cannot overwrite another path', () => {
  const before = { ...old, [page]: 'a'.repeat(32) };
  assert.throws(() => mergeLpManifest(before, { [page]: 'b'.repeat(32) },[],[page]));
  assert.throws(() => mergeLpManifest(old, { '/index.html': 'b'.repeat(32) },[],[page]));
  assert.throws(() => mergeLpManifest(old, { '/influenciadoras-assets/0123456789abcdef/../index.html': 'b'.repeat(32) },[],[page]));
  assert.equal(mergeLpManifest(before, { [page]: 'b'.repeat(32) }, [{ path: page, nativeHash: before[page] }],[page]).full[page], 'b'.repeat(32));
});
test('a third page is supported but cannot replace an existing shared route',()=>{
 const next='/nova-campanha/index.html';
 assert.equal(mergeLpManifest(old,{[next]:'b'.repeat(32)},[],[page,next]).full[next],'b'.repeat(32));
 assert.throws(()=>mergeLpManifest({...old,'/nova-campanha/existing.png':'a'.repeat(32)},{[next]:'b'.repeat(32)},[],[next]),/collides/);
 assert.throws(()=>mergeLpManifest({...old,'/nova-campanha.html':'a'.repeat(32)},{[next]:'b'.repeat(32)},[],[next]),/collides/);
 assert.throws(()=>mergeLpManifest(old,{[next]:'b'.repeat(32)},[],[page]));
});
test('new pages cannot silently replace redirects or wildcard routes',()=>{
 const p='/nova-campanha/index.html';
 assert.throws(()=>assertNoRedirectCollisions('/nova-campanha/ https://example.org/ 302',old,[p]),/redirect/);
 assert.throws(()=>assertNoRedirectCollisions('/nova-* /other/ 301',old,[p]),/redirect/);
 assert.throws(()=>assertNoRedirectCollisions('/:slug/ /other/ 301',old,[p]),/redirect/);
 assertNoRedirectCollisions('/other/* /elsewhere/:splat 301',old,[p]);
 assertNoRedirectCollisions('/nova-campanha/ /previous/ 302',{...old,[p]:'a'.repeat(32)},[p]);
});
test('scoped assets preserve canonical, checkout parameters and external media URLs', () => {
  const text = '<img src="/media/capas/lua.webp"><link href="/_astro/style.css"><meta content="https://lp.joaoemariaeditora.com.br/media/image.jpg"><a href="https://lp.joaoemariaeditora.com.br/combo-da-forja-diaria/"><a href="https://www.joaoemariaeditora.com.br/combo/?utm_source=forja"><img src="https://external.example/media/real.jpg">url(/fonts/local.woff2)';
  const output = namespaceAssets(text, '/influenciadoras-assets/0123456789abcdef/');
  assert(output.includes('src="/influenciadoras-assets/0123456789abcdef/media/capas/lua.webp"'));
  assert(output.includes('url(/influenciadoras-assets/0123456789abcdef/fonts/local.woff2)'));
  assert(output.includes('content="https://lp.joaoemariaeditora.com.br/influenciadoras-assets/0123456789abcdef/media/image.jpg"'));
  assert(output.includes('href="https://lp.joaoemariaeditora.com.br/combo-da-forja-diaria/"'));
  assert(output.includes('?utm_source=forja'));
  assert(output.includes('src="https://external.example/media/real.jpg"'));
});
