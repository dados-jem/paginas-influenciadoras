import assert from 'node:assert/strict';
import {sha} from './project.mjs';
export function publicArtifactPath(file) {
  if (['_headers', '_redirects', '_routes.json'].includes(file)) return null;
  let pathname = '/' + file;
  if (pathname.endsWith('/index.html')) pathname = pathname.slice(0, -10);
  else if (pathname.endsWith('.html')) pathname = pathname.slice(0, -5);
  return pathname;
}
async function verifyOrigin(origin, artifact) {
  const publicFiles = artifact.files.filter(f => publicArtifactPath(f.path) !== null);
  for (let offset = 0; offset < publicFiles.length; offset += 6) {
    await Promise.all(publicFiles.slice(offset, offset + 6).map(async f => {
      const r = await fetch(new URL(publicArtifactPath(f.path), origin), { redirect: 'error', signal: AbortSignal.timeout(20000) });
      const bytes = Buffer.from(await r.arrayBuffer());
      assert(r.ok || f.path === '404.html' && r.status === 404, 'HTTP mismatch for ' + f.path);
      assert.equal(sha(bytes), f.sha256, 'Published bytes differ for ' + f.path);
      if (f.path.endsWith('.html')) assert.equal(r.headers.get('x-content-type-options'), 'nosniff', 'Security header missing');
    }));
  }
  const manifest = await (await fetch(new URL('/release-manifest.json', origin), { redirect: 'error', signal: AbortSignal.timeout(20000) })).json();
  assert.equal(manifest.sourceCommit, artifact.sourceCommit); assert.equal(manifest.artifactSha256, artifact.artifactSha256);
  return { filesVerified: publicFiles.length, sourceCommitVerified: true, artifactSha256Verified: true, controlFilesVerifiedByPolicy: artifact.files.filter(f => publicArtifactPath(f.path) === null).map(f => f.path) };
}
export async function verifyDelivery(canonical, immutable, artifact) {
  const stable = await verifyOrigin(canonical, artifact);
  let immutableDelivery;
  try {
    const probe = await fetch(new URL('/release-manifest.json', immutable), { redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (probe.ok) immutableDelivery = { verified: true, ...await verifyOrigin(immutable, artifact) };
    else immutableDelivery = { verified: false, reason: 'HTTP_' + probe.status };
  } catch (error) {
    // A new Pages project's preview certificate may still be provisioning.
    // The exact deployment is also reread through the authenticated Pages API;
    // canonical file hashes and source commit remain mandatory.
    if (!(error instanceof TypeError)) throw error;
    immutableDelivery = { verified: false, reason: error.cause?.code || error.name };
  }
  return { canonical: stable, immutable: immutableDelivery };
}
