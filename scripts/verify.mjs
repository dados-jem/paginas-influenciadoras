import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { root, files, sha, json, write, git, config } from './project.mjs';
import { validatePage } from '../src/lib/landing.mjs';
const c = await config(), pages = await json('src/content/pages.json');
assert.equal(pages.length, 2); assert.equal(new Set(pages.map(p => p.slug)).size, pages.length);
const rows = (await files(path.join(root, 'dist'))).filter(f => f.path !== 'release-manifest.json');
const byPath = new Map(rows.map(f => [f.path, f]));
for (const page of pages) {
  validatePage(page);
  const entry = page.slug + '/index.html';
  assert(byPath.has(entry), 'Landing missing from build');
  const html = await fs.readFile(path.join(root, 'dist', entry), 'utf8');
  assert(byPath.get(entry).bytes <= c.budgets.htmlBytesPerPage, 'Page HTML exceeds its budget');
  assert(html.includes(page.title.replaceAll('&', '&amp;')) && html.includes('https://paginas-influenciadoras.pages.dev/' + page.slug + '/'), 'Title/canonical mismatch');
  assert(!html.includes('clube.joaoemariaeditora.com.br'), 'Landing must not depend on Hostinger');
  assert(!/\{\{price\./.test(html), 'Unresolved price');
  assert.equal((html.match(/<main\b/g) || []).length, 1);
  if (page.composition) {
    const list = html.match(/<ol class="lista">([\s\S]*?)<\/ol>/)?.[1];
    assert(list, 'Book list missing');
    assert.deepEqual([...list.matchAll(/<img[^>]+src="([^"]+)"/g)].map(m => m[1]), page.composition.books.map(b => b.cover), 'Page and artwork must show the same ordered book composition');
    assert(html.includes(`Conheça os ${page.composition.books.length} títulos`) && html.includes(`${page.composition.books.length} livros da Editora`), 'Book count changed');
    assert(!/Esopo|Miloca|10 (?:livros|títulos)/i.test(html), 'Excluded books must not remain in the current Forja page');
    const artwork = await json('config/compositions-manifest.json');
    assert(artwork.outputs.some(o => o.path === page.heroImage) && artwork.outputs.some(o => o.path === page.socialImage));
    for (const output of artwork.outputs) {
      assert.equal(byPath.get(output.path.slice(1))?.sha256, output.sha256, 'Artwork in release changed');
    }
  }
  const priceNotice = html.includes('PREÇO PROVISÓRIO');
  if (page.status === 'draft') {
    assert(html.includes('noindex, nofollow') && priceNotice, 'Draft must retain its publication/price state');
    assert(!html.includes('googletagmanager.com') && !html.includes('trackings.nemu.com.br'), 'Draft must not send commercial analytics');
    assert.equal((html.match(/href="#oferta"/g) || []).length, 5, 'Draft CTA changed');
  } else {
    assert(!priceNotice && html.includes('data-produto-loja'));
    assert.equal((html.match(/googletagmanager.com\/gtm.js/g) || []).length, 1);
    assert.equal((html.match(/trackings.nemu.com.br/g) || []).length, 1);
  }
  for (const m of html.matchAll(/(?:src|href)="(\/[^"#?]+)(?:[?#][^"]*)?"/g)) {
    const pathname = m[1];
    if (pathname.endsWith('/')) continue;
    assert(byPath.has(pathname.slice(1)), 'Referenced asset is missing: ' + pathname);
  }
  const images = [...html.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
  assert(images.every(img => /\bwidth=/.test(img) && /\bheight=/.test(img)), 'All images need intrinsic dimensions');
  assert(images.find(img => img.includes('hero__img'))?.includes('fetchpriority="high"'), 'Hero priority missing');
}
assert(rows.reduce((n, f) => n + f.bytes, 0) <= c.budgets.artifactBytes, 'Artifact exceeds budget');
const jsBytes = rows.filter(f => /\.m?js$/.test(f.path)).reduce((n, f) => n + f.bytes, 0);
assert(jsBytes <= c.budgets.runtimeBytes, 'Runtime exceeds budget');
assert(rows.every(f => !/(?:^|\/)(?:\.env|node_modules|\.git)|\.(?:py|zip|pem|key)$/.test(f.path)), 'Private/source files in public release');
let sourceCommit = null; try { sourceCommit = await git('rev-parse', 'HEAD'); } catch {}
const manifest = { version: 1, project: c.cloudflare.projectName, sourceCommit, artifactSha256: sha(JSON.stringify(rows)), files: rows };
await write('dist/release-manifest.json', manifest);
console.log(JSON.stringify({ ok: true, pages: pages.length, files: rows.length, totalBytes: rows.reduce((n, f) => n + f.bytes, 0), runtimeBytes: jsBytes, artifactSha256: manifest.artifactSha256, sourceCommit }));
