import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { root, json, sha, config, approvedArtifact, write } from './project.mjs';
import {productionPages,validatePublicationPaths,pagePath} from '../src/lib/page-registry.mjs';
const require = createRequire(new URL('../node_modules/wrangler/wrangler-dist/cli.js', import.meta.url));
const blake3 = require('blake3-wasm');
export const nativeHash = (bytes, file) => blake3.hash(bytes.toString('base64') + path.extname(file).slice(1)).toString('hex').slice(0, 32);
export const manifestHash = map => sha(JSON.stringify(Object.entries(map).sort(([a], [b]) => a.localeCompare(b))));
export function assertNoRedirectCollisions(redirects,before,pagePaths){
  for(const file of pagePaths){if(before[file])continue;const url=file.slice(0,-10),variants=[url,url.slice(0,-1)];
    for(const line of redirects.split('\n')){const rule=line.trim();if(!rule||rule.startsWith('#'))continue;let source=rule.split(/\s+/)[0];source=source.replace(/^https:\/\/lp\.joaoemariaeditora\.com\.br/,'');if(!source.startsWith('/'))continue;
      const pattern='^'+source.split('*').map(s=>s.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/:[A-Za-z][\w]*/g,'[^/]+')).join('.*')+'$';
      assert(!variants.some(v=>new RegExp(pattern).test(v)),'New page collides with an existing LP redirect: '+source);
    }
  }
}
export function namespaceAssets(text, prefix) {
  return text.replace(/(["'(\s=]|https:\/\/lp\.joaoemariaeditora\.com\.br)\/(media|fonts|_astro)\//g, (_, lead, directory) => lead + prefix + directory + '/');
}
export function mergeLpManifest(before, added, previousOwned = [], registeredPaths) {
  const pages=validatePublicationPaths(registeredPaths);
  assert(Object.keys(before).length > 100);
  assert(Object.keys(added).length > 0 && Object.keys(added).length <= 2048);
  const allowed = file => pages.has(file) || /^\/influenciadoras-assets\/[a-f0-9]{16}\/.+/.test(file);
  const full = { ...before };
  for (const [file, digest] of Object.entries(added)) {
    assert(allowed(file) && !file.split('/').includes('..') && /^[a-f0-9]{32}$/.test(digest), 'Foreign or invalid publication path');
    if(pages.has(file)&&!before[file]){const directory=file.slice(0,-10);assert(!Object.keys(before).some(p=>p.startsWith(directory)||p===directory.slice(0,-1)+'.html'),'New page collides with an existing LP route');}
    if (before[file]) assert(previousOwned.some(f => f.path === file && f.nativeHash === before[file]), 'Unknown target collision: ' + file);
    full[file] = digest;
  }
  const preserved = Object.fromEntries(Object.entries(before).filter(([file]) => !Object.hasOwn(added, file)));
  for (const [file, digest] of Object.entries(preserved)) assert.equal(full[file], digest);
  return { full, preserved };
}
export async function prepareLpArtifact() {
  const c = await config(), artifact = await approvedArtifact(), pages = productionPages(await json('src/content/pages.json'));
  assert(pages.length>0,'Choose at least one production page explicitly');
  const prefix = c.publication.assetPrefix + artifact.sourceCommit.slice(0, 16) + '/';
  const directory = path.join(root, '.runtime/lp-artifacts', artifact.artifactSha256 + '-' + artifact.sourceCommit.slice(0, 16));
  const selected = artifact.files.filter(f => /^(?:media|fonts|_astro)\//.test(f.path) || pages.some(p => f.path === p.slug + '/index.html'));
  const files = [];
  for (const source of selected) {
    let bytes = await fs.readFile(path.join(root, 'dist', source.path));
    const html = pages.some(p => source.path === p.slug + '/index.html');
    if (/\.(?:html|css|m?js|svg)$/.test(source.path)) bytes = Buffer.from(namespaceAssets(bytes.toString('utf8'), prefix));
    const pathname = html ? '/' + source.path : prefix + source.path;
    const target = path.join(directory, pathname);
    await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, bytes);
    if (html) {
      const page = pages.find(p => source.path === p.slug + '/index.html'), text = bytes.toString();
      assert(text.includes(c.origin + '/' + page.slug + '/'), 'LP canonical missing');
      assert(!text.includes(c.deliveryOrigin), 'Unexpected preview-host reference');
      assert(!/(?:src|href)="\/(?:media|fonts|_astro)\//.test(text), 'Unscoped HTML asset');
    }
    files.push({ path: pathname, bytes: bytes.length, sha256: sha(bytes), nativeHash: nativeHash(bytes, pathname) });
  }
  assert.deepEqual(files.filter(f=>f.path.endsWith('/index.html')).map(f=>f.path).sort(),pages.map(pagePath).sort());
  assert(files.reduce((n, f) => n + f.bytes, 0) <= c.budgets.artifactBytes);
  const manifest = { version: 1, origin: c.origin, project: c.publication.project, sourceCommit: artifact.sourceCommit, sourceArtifactSha256: artifact.artifactSha256, prefix, directory, pages: pages.map(p => '/' + p.slug + '/'), files };
  await write('.runtime/lp-artifact.json', manifest);
  return manifest;
}
