import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
export const root = path.resolve(import.meta.dirname, '..');
export const run = promisify(execFile);
export const sha = value => crypto.createHash('sha256').update(value).digest('hex');
export const isExpectedRepositoryOrigin=value=>typeof value==='string'&&/^https:\/\/github\.com\/dados-jem\/paginas-influenciadoras(?:\.git)?$/.test(value);
export const json = async file => JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));
export const write = async (file, value) => { const p = path.join(root, file); await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); };
export async function config() {
  const c = await json('config/site.json');
  assert(c.github.owner === 'dados-jem' && c.github.ownerId === 327816671 && c.github.repository === 'paginas-influenciadoras' && c.github.visibility === 'public' && c.github.branch === 'main', 'Exact corporate GitHub target required');
  assert(c.cloudflare.accountName === 'Editora João e Maria' && c.cloudflare.accountId === 'aa5bc6c8ac9f9bc00b32e8fb8d891d59' && c.cloudflare.projectName === 'paginas-influenciadoras' && c.cloudflare.productionBranch === 'main', 'Exact Pages target required');
  assert(c.origin === 'https://lp.joaoemariaeditora.com.br' && c.deliveryOrigin === 'https://paginas-influenciadoras.pages.dev');
  assert(c.publication.project === 'jm-lp' && c.publication.assetPrefix === '/influenciadoras-assets/');
  return c;
}
export async function files(directory, prefix = '') {
  const rows = [];
  for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    assert(!entry.isSymbolicLink(), 'Symlinks are not part of a release');
    const relative = prefix + entry.name;
    if (entry.isDirectory()) rows.push(...await files(path.join(directory, entry.name), relative + '/'));
    else { const bytes = await fs.readFile(path.join(directory, entry.name)); rows.push({ path: relative, bytes: bytes.length, sha256: sha(bytes) }); }
  }
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}
export async function git(...args) { return (await run('git', ['-C', root, ...args], { timeout: 30000, maxBuffer: 2000000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })).stdout.trim(); }
export function argumentsFor(argv) {
  let apply = false, planHash = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--apply' && !apply) apply = true;
    else if (argv[i] === '--plan-hash' && !planHash) planHash = argv[++i];
    else throw Error('Supported flags: --apply --plan-hash <sha256>');
  }
  if (apply) assert(/^[a-f0-9]{64}$/.test(planHash || ''), 'Apply requires the exact preview hash');
  else assert(!planHash, 'Hash is only used with --apply');
  return { apply, planHash };
}
export async function approvedArtifact() {
  const m = await json('dist/release-manifest.json');
  const current = (await files(path.join(root, 'dist'))).filter(f => f.path !== 'release-manifest.json');
  assert.deepEqual(current, m.files, 'Build changed after verification');
  assert.equal(sha(JSON.stringify(current)), m.artifactSha256);
  assert.equal(await git('rev-parse', 'HEAD'), m.sourceCommit, 'Build must match the current Git commit');
  assert.equal(await git('status', '--porcelain'), '', 'Commit reviewed source before publishing');
  return m;
}
