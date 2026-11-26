import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { root, run, config, sha, write, json, approvedArtifact, argumentsFor } from './project.mjs';
import {verifyDelivery} from './delivery.mjs';

async function main() {
  const options = argumentsFor(process.argv.slice(2)), c = await config(), artifact = await approvedArtifact();
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID, token = process.env.CLOUDFLARE_API_TOKEN;
  assert(accountId === c.cloudflare.accountId && token, 'Configure your own Cloudflare credential for the exact J&M account');
  const apiRoot = 'https://api.cloudflare.com/client/v4/accounts/' + accountId;
  const projectPath = '/pages/projects/' + c.cloudflare.projectName;
  async function api(route, method = 'GET', body) {
    const r = await fetch(apiRoot + route, { method, redirect: 'error', headers: { authorization: 'Bearer ' + token, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
    if (r.status === 404 && method === 'GET') return null;
    const data = await r.json();
    if (!r.ok || data.success !== true) throw Error('Cloudflare ' + method + ' refused with HTTP ' + r.status);
    return data.result;
  }
  const account = await api(''); assert.equal(account.name, c.cloudflare.accountName, 'Cloudflare account mismatch');
  let project = await api(projectPath);
  if (project) {
    assert.equal(project.name, c.cloudflare.projectName);
    assert(!project.source, 'An existing Git-integrated project requires a separate review');
    assert.equal(project.production_branch, c.cloudflare.productionBranch);
  }
  const plan = { accountId, accountName: account.name, projectName: c.cloudflare.projectName, branch: c.cloudflare.productionBranch, sourceCommit: artifact.sourceCommit, artifactSha256: artifact.artifactSha256, createProject: !project, previousDeploymentId: project?.canonical_deployment?.id || null, files: artifact.files.length, maxWrites: project ? 1 : 2 };
  const planHash = sha(JSON.stringify(plan));
  await write('.runtime/deploy-preview.json', { mode: 'dry-run', plan, planHash });
  if (!options.apply) { console.log(JSON.stringify({ ok: true, mode: 'dry-run', plan, planHash, applyCommand: 'npm run deploy -- --apply --plan-hash ' + planHash })); return; }
  assert.equal(options.planHash, planHash, 'Remote state or reviewed source changed; prepare a new preview');
  const intentPath = '.runtime/deploy-intents/' + planHash + '.json';
  let intent; try { intent = await json(intentPath); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  assert(!intent || intent.state === 'verified', 'An uncertain deployment must be reconciled by reading the exact project; do not upload it again');
  assert(!intent, 'This exact deployment has already been verified');
  const prior = project?.canonical_deployment?.id || null;
  const known = new Set((project ? await api(projectPath + '/deployments') : []).map(d => d.id));
  await write(intentPath, { state: 'intent', plan, planHash });
  let deployment;
  try {
    if (!project) {
      await api('/pages/projects', 'POST', { name: c.cloudflare.projectName, production_branch: c.cloudflare.productionBranch });
      project = await api(projectPath);
      assert(project && project.name === c.cloudflare.projectName && project.subdomain === c.cloudflare.projectName + '.pages.dev', 'Created project readback mismatch');
      await write(intentPath, { state: 'project-created', plan, planHash });
    }
    const wrangler = path.join(root, 'node_modules/wrangler/bin/wrangler.js');
    const started = Date.now();
    await run(process.execPath, [wrangler, 'pages', 'deploy', path.join(root, 'dist'), '--project-name', c.cloudflare.projectName, '--branch', c.cloudflare.productionBranch, '--commit-hash', artifact.sourceCommit, '--commit-dirty=false'], { cwd: root, timeout: 240000, maxBuffer: 1000000, env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' } });
    const deadline = Date.now() + 55000;
    while (Date.now() < deadline) {
      const rows = await api(projectPath + '/deployments');
      const matches = rows.filter(d => !known.has(d.id) && Date.parse(d.created_on) >= started - 5000 && d.deployment_trigger?.metadata?.commit_hash === artifact.sourceCommit && d.environment === 'production');
      assert(matches.length <= 1, 'Multiple deployments match the upload; inspect before proceeding');
      if (matches.length === 1) {
        deployment = matches[0];
        if (deployment.latest_stage?.status === 'success') break;
        if (['failure', 'canceled'].includes(deployment.latest_stage?.status)) throw Error('Pages deployment did not succeed');
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    assert(deployment?.latest_stage?.status === 'success', 'Upload requires read-only reconciliation');
    project = await api(projectPath);
    assert.equal(project.canonical_deployment?.id, deployment.id, 'Canonical deployment differs');
    assert(deployment.uses_functions !== true, 'Unexpected server Functions');
    const expectedUrl = new URL(deployment.url);
    assert(expectedUrl.protocol === 'https:' && expectedUrl.hostname.endsWith('.' + c.cloudflare.projectName + '.pages.dev'), 'Deployment URL mismatch');
    await write('.runtime/current-deployment.json', { deploymentId: deployment.id, url: deployment.url, projectName: project.name, sourceCommit: artifact.sourceCommit, artifactSha256: artifact.artifactSha256, previousDeploymentId: prior });
    const delivery = await verifyDelivery(c.origin, deployment.url, artifact);
    const report = { ok: true, mode: 'apply', verifiedAt: new Date().toISOString(), planHash, projectName: project.name, deploymentId: deployment.id, url: c.origin, immutableUrl: deployment.url, sourceCommit: artifact.sourceCommit, artifactSha256: artifact.artifactSha256, previousDeploymentId: prior, delivery, canonicalVerified: true, rollback: 'not-needed' };
    await write('.runtime/deploy-verified.json', report);
    await write(intentPath, { state: 'verified', ...report });
    console.log(JSON.stringify(report));
  } catch (error) {
    await write(intentPath, { state: 'uncertain', plan, planHash, deploymentId: deployment?.id || null, previousDeploymentId: prior });
    // A failed upload is never repeated automatically. Native rollback is limited
    // to the known previous deployment, and only when the failed release became canonical.
    if (prior && deployment?.id) {
      const now = await api(projectPath).catch(() => null);
      if (now?.canonical_deployment?.id === deployment.id) {
        await api(projectPath + '/deployments/' + prior + '/rollback', 'POST', {});
        const restored = await api(projectPath); assert.equal(restored.canonical_deployment?.id, prior);
        await write('.runtime/rollback-verified.json', { restoredDeploymentId: prior, failedDeploymentId: deployment.id });
      }
    }
    throw error;
  }
}
main().catch(error => { console.error(JSON.stringify({ ok: false, error: String(error.message).replace(/Bearer\s+\S+|(?:cfat_|ghp_|github_pat_)[A-Za-z0-9_-]+/g, '[redacted]').slice(0, 500), rawCommandOutputDisclosed: false })); process.exitCode = 1; });
