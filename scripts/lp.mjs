import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { config, json, sha, write, root, argumentsFor } from './project.mjs';
import { prepareLpArtifact, nativeHash, manifestHash, mergeLpManifest,assertNoRedirectCollisions } from './lp-artifact.mjs';
import {receiptsFile,selectReceipt,publicReceipt,localArtifactFor} from './publication-receipts.mjs';

const canonicalPath = file => file.endsWith('/index.html') ? file.slice(0, -10) : file;
const exists = async p => Boolean(await fs.stat(p).catch(() => null));
const sorted = object => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
const c = await config(), verifyOnly = process.argv.slice(2).join(' ') === '--verify';
const options = verifyOnly ? { apply: false } : argumentsFor(process.argv.slice(2));
let artifact = verifyOnly?null:await prepareLpArtifact();
const pagePaths=artifact?.pages.map(p=>p+'index.html')||[];
const owned=file=>pagePaths.includes(file)||file.startsWith(artifact.prefix);
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID, token = process.env.CLOUDFLARE_API_TOKEN;
assert.equal(accountId, c.cloudflare.accountId); assert(token);
const projectPath = '/pages/projects/jm-lp', apiRoot = 'https://api.cloudflare.com/client/v4/accounts/' + accountId;
let writes = 0;
async function api(method, route, body) {
  assert(route === '' || route.startsWith(projectPath + '/') || route === projectPath);
  if (method !== 'GET') {
    assert(options.apply && method === 'POST' && route === projectPath + '/deployments' && ++writes <= 1, 'Only one bounded deployment may be created');
  }
  const form = body instanceof FormData;
  const r = await fetch(apiRoot + route, { method, redirect: 'error', headers: { authorization: 'Bearer ' + token, ...(body && !form ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: form ? body : JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000) });
  const data = await r.json(); assert(r.ok && data.success !== false, 'Cloudflare ' + method + ' HTTP ' + r.status); return data.result;
}
async function project() {
  const p = await api('GET', projectPath);
  assert(p.name === 'jm-lp' && p.production_branch === 'main' && !p.source);
  assert(p.domains.includes('lp.joaoemariaeditora.com.br'));
  return p;
}
async function snapshot() {
  const p = await project(), d = await api('GET', projectPath + '/deployments/' + p.canonical_deployment.id);
  assert(d.latest_stage.status === 'success' && d.uses_functions === false && Object.keys(d.files).length > 100);
  return d;
}
async function publicBytes(file, origin = c.origin) {
  const r = await fetch(new URL(canonicalPath(file), origin), { redirect: 'manual', signal: AbortSignal.timeout(20000) });
  assert(r.ok, 'Public route HTTP ' + r.status + ': ' + file); return { response: r, bytes: Buffer.from(await r.arrayBuffer()) };
}
async function verify(current, plan) {
  const d = await snapshot(); assert.equal(d.id, current.deploymentId, 'Another deployment became canonical; prepare a merge from its exact manifest');
  assert.equal(manifestHash(d.files), plan.fullManifestHash);
  for (const [file, hash] of Object.entries(current.preserved||{})) assert.equal(d.files[file], hash, 'Unrelated file changed: ' + file);
  for (let i = 0; i < artifact.files.length; i += 6) await Promise.all(artifact.files.slice(i, i + 6).map(async f => {
    const { response, bytes } = await publicBytes(f.path);
    assert.equal(sha(bytes), f.sha256, 'Published content mismatch: ' + f.path);
    assert.equal(nativeHash(bytes, f.path), f.nativeHash);
    if (f.path.endsWith('.html')) assert(response.headers.get('x-robots-tag')?.includes('noindex'));
  }));
  for (const canary of current.canaries||[]) {
    const { bytes } = await publicBytes(canary.path); assert.equal(sha(bytes), canary.sha256, 'Shared page changed: ' + canary.path);
  }
  for (const check of current.redirectChecks||[]) {
    const r = await fetch(new URL(check.path, c.origin), { redirect: 'manual', signal: AbortSignal.timeout(20000) });
    assert.equal(r.status, check.status); assert.equal(r.headers.get('location'), check.location);
  }
  assert.equal((await project()).canonical_deployment.id, current.deploymentId);
  const report = { ok: true, mode: verifyOnly ? 'read-only' : 'apply', verifiedAt: new Date().toISOString(), deploymentId: d.id, previousDeploymentId: plan.previousDeploymentId, project: 'jm-lp', urls: artifact.pages.map(p => c.origin + p), sourceCommit: artifact.sourceCommit, artifactSha256: artifact.sourceArtifactSha256, fullManifestHash: plan.fullManifestHash, preservedFiles: Object.keys(current.preserved||{}).length, publishedFilesVerified: artifact.files.length, canariesVerified: (current.canaries||[]).length, redirectsVerified: (current.redirectChecks||[]).length, dnsWrites: 0, platformWrites: writes };
  await write('.runtime/lp-verified.json', { ...report, headers: current.headers, redirects: current.redirects, redirectChecks: current.redirectChecks, canaries:current.canaries||[],preserved: current.preserved||{}, plan, artifact });
  console.log(JSON.stringify(report)); return report;
}
async function uploadAssets(added) {
  const jwt = (await api('GET', projectPath + '/upload-token')).jwt; assert(typeof jwt === 'string');
  async function cache(route, body) {
    assert(['check-missing', 'upload', 'upsert-hashes'].includes(route));
    const r = await fetch('https://api.cloudflare.com/client/v4/pages/assets/' + route, { method: 'POST', redirect: 'error', headers: { authorization: 'Bearer ' + jwt, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
    const d = await r.json(); assert(r.ok && d.success !== false, 'Asset cache HTTP ' + r.status); return d.result;
  }
  const hashes = [...new Set(Object.values(added))], missing = await cache('check-missing', { hashes });
  assert(Array.isArray(missing) && missing.every(h => hashes.includes(h)));
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
  for (let i = 0; i < missing.length; i += 30) {
    const rows = [];
    for (const hash of missing.slice(i, i + 30)) {
      const file = Object.keys(added).find(f => added[f] === hash), bytes = await fs.readFile(path.join(artifact.directory, file));
      assert.equal(nativeHash(bytes, file), hash);
      rows.push({ key: hash, value: bytes.toString('base64'), metadata: { contentType: types[path.extname(file)] || 'application/octet-stream' }, base64: true });
    }
    await cache('upload', rows);
  }
  await cache('upsert-hashes', { hashes }); assert.equal((await cache('check-missing', { hashes })).length, 0);
  return { uploaded: missing.length, reused: hashes.length - missing.length };
}

let lock;
try {
  assert.equal((await api('GET', '')).name, c.cloudflare.accountName);
  assert.equal((await api('GET', projectPath + '/domains/lp.joaoemariaeditora.com.br')).status, 'active');
  if (verifyOnly) {
    const remote=await snapshot(),remoteHash=manifestHash(remote.files),prior=await json('.runtime/lp-verified.json').catch(e=>{if(e.code!=='ENOENT')throw e;return null;}),currentIntent=await json('.runtime/lp-current.json').catch(e=>{if(e.code!=='ENOENT')throw e;return null;});
    let receipt;
    if(prior?.deploymentId===remote.id&&prior.fullManifestHash===remoteHash)receipt=publicReceipt(prior);
    else if(currentIntent?.deploymentId===remote.id&&currentIntent.plan.fullManifestHash===remoteHash){const staged=await json('.runtime/lp-artifact.json');assert.equal(staged.sourceCommit,currentIntent.plan.sourceCommit);assert.equal(manifestHash(Object.fromEntries(staged.files.map(f=>[f.path,f.nativeHash]))),currentIntent.plan.addedManifestHash);artifact=staged;receipt=publicReceipt({...currentIntent,fullManifestHash:remoteHash,artifact:staged});}
    else receipt=selectReceipt(await json(receiptsFile),{id:remote.id,manifestHash:remoteHash});
    if(!artifact)artifact=localArtifactFor(receipt,[prior?.artifact,await json('.runtime/lp-artifact.json').catch(e=>{if(e.code!=='ENOENT')throw e;return null;})]);
    const preserved=prior?.deploymentId===remote.id&&Object.keys(prior.preserved||{}).length?prior.preserved:currentIntent?.deploymentId===remote.id&&currentIntent.plan.fullManifestHash===remoteHash?currentIntent.preserved||{}:{};
    const current={...receipt,headers:receipt.headers,redirects:receipt.redirects,preserved,canaries:receipt.canaries,redirectChecks:receipt.redirectChecks};
    await verify(current,{fullManifestHash:receipt.manifestHash,previousDeploymentId:receipt.previousDeploymentId});
  } else {
    const lockFile = process.env.JM_LP_PUBLICATION_LOCK_FILE || path.join(root, '.runtime/lp-publication.lock');
    await fs.mkdir(path.dirname(lockFile), { recursive: true }); lock = { handle: await fs.open(lockFile, 'wx'), file: lockFile };
    const before = await snapshot();
    const controlsFile = process.env.JM_LP_BASELINE_FILE;
    const baseline = controlsFile?JSON.parse(await fs.readFile(controlsFile, 'utf8')):selectReceipt(await json(receiptsFile),{id:before.id,manifestHash:manifestHash(before.files)});
    assert.equal(baseline.deploymentId, before.id, 'Shared controls receipt is stale');
    assert.equal(baseline.manifestHash, manifestHash(before.files), 'Shared baseline file map changed');
    assert.equal(sha(baseline.headers), baseline.headersSha256); assert.equal(sha(baseline.redirects), baseline.redirectsSha256);
    const added = Object.fromEntries(artifact.files.map(f => [f.path, f.nativeHash]));
    assert(Object.keys(added).every(owned));
    const previousOwn = await json('.runtime/lp-verified.json').catch(e => { if (e.code !== 'ENOENT') throw e; return null; });
    const knownOwned=baseline.ownedFiles||previousOwn?.artifact?.files||[];
    assertNoRedirectCollisions(baseline.redirects,before.files,pagePaths);
    const { full, preserved } = mergeLpManifest(before.files, added, knownOwned,pagePaths);
    const oldHeaders = baseline.headers.replace(/\n# BEGIN JM INFLUENCER PAGES[\s\S]*?# END JM INFLUENCER PAGES\n?/g, '');
    const headers = oldHeaders + '\n# BEGIN JM INFLUENCER PAGES\n' + artifact.pages.map(p => p + '*\n  X-Robots-Tag: noindex, nofollow\n').join('') + c.publication.assetPrefix + '*\n  Cache-Control: public, max-age=31536000, immutable\n# END JM INFLUENCER PAGES\n';
    const redirects = baseline.redirects;
    const canaries = [];
    for (const pathname of ['/index.html', '/assinatura-2-anos/index.html', '/assinatura-2-anos/obrigado/index.html', '/guia-de-leitura/index.html']) {
      if (!before.files[pathname]) continue;
      const { bytes } = await publicBytes(pathname); assert.equal(nativeHash(bytes, pathname), before.files[pathname]); canaries.push({ path: pathname, sha256: sha(bytes) });
    }
    const redirectChecks = baseline.redirectChecks || [];
    const plan = { version: 1, project: 'jm-lp', domain: c.origin, previousDeploymentId: before.id, previousManifestHash: manifestHash(before.files), fullManifestHash: manifestHash(full), sourceCommit: artifact.sourceCommit, sourceArtifactSha256: artifact.sourceArtifactSha256, addedManifestHash: manifestHash(added), headersSha256: sha(headers), redirectsSha256: sha(redirects), preservedFiles: Object.keys(preserved).length, addedFiles: Object.keys(added).length, maxDeploymentWrites: 1 };
    const planHash = sha(JSON.stringify(plan));
    await write('.runtime/lp-preview.json', { mode: 'dry-run', planHash, plan, added, full, headers, redirects, canaries });
    if (!options.apply) console.log(JSON.stringify({ ok: true, mode: 'dry-run', planHash, plan }));
    else {
      assert.equal(options.planHash, planHash, 'Shared site or source changed since preview');
      const intentFile = '.runtime/lp-intents/' + planHash + '.json';
      assert(!await exists(path.join(root, intentFile)), 'Existing publication intent requires read-only reconciliation');
      await write(intentFile, { state: 'asset-intent', plan, planHash });
      const upload = await uploadAssets(added);
      const fresh = await snapshot(); assert.equal(fresh.id, before.id, 'Concurrent shared deployment detected; prepare a fresh merge');
      assert.equal(manifestHash(fresh.files), plan.previousManifestHash);
      await write(intentFile, { state: 'deployment-intent', plan, planHash, upload });
      const form = new FormData(); form.append('manifest', JSON.stringify(sorted(full))); form.append('branch', 'main');
      form.append('commit_hash', artifact.sourceCommit); form.append('commit_message', 'Influenciadoras ' + plan.fullManifestHash.slice(0, 16)); form.append('commit_dirty', 'false');
      form.append('_headers', new File([headers], '_headers')); form.append('_redirects', new File([redirects], '_redirects'));
      const created = await api('POST', projectPath + '/deployments', form); assert(created.id);
      const current = { deploymentId: created.id, sourceCommit: artifact.sourceCommit, plan, planHash, headers, redirects, preserved, canaries, redirectChecks, upload };
      await write('.runtime/lp-current.json', current); await write(intentFile, { state: 'created', deploymentId: created.id, plan, planHash });
      let ready;
      for (let i = 0; i < 25; i++) {
        ready = await api('GET', projectPath + '/deployments/' + created.id);
        if (ready.latest_stage.status === 'success') break;
        assert(!['failure', 'canceled'].includes(ready.latest_stage.status), 'Deployment failed');
        await new Promise(r => setTimeout(r, 2000));
      }
      assert.equal(ready.latest_stage.status, 'success'); assert.equal(ready.uses_functions, false);
      assert.equal(manifestHash(ready.files), plan.fullManifestHash, 'Remote native file map differs');
      let propagated = false;
      for (let i = 0; i < 20; i++) {
        const r = await fetch(c.origin + artifact.pages[0], { redirect: 'manual' });
        if (r.ok && sha(Buffer.from(await r.arrayBuffer())) === artifact.files.find(f => f.path === artifact.pages[0] + 'index.html').sha256) { propagated = true; break; }
        await new Promise(r => setTimeout(r, 2000));
      }
      assert(propagated, 'Created deployment needs read-only propagation verification; do not upload again');
      const report = await verify(current, plan);
      await write(intentFile, { state: 'verified', ...report, planHash });
    }
  }
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: String(error.message).slice(0, 450), uncertainDeploymentMustNotBeRepeated: true, rawResponsesDisclosed: false })); process.exitCode = 1;
} finally {
  if (lock) { await lock.handle.close(); await fs.unlink(lock.file); }
}
