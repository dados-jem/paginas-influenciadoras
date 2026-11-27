import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { config, run, root, git, sha, write, json, argumentsFor,isExpectedRepositoryOrigin } from './project.mjs';
async function main() {
  const options = argumentsFor(process.argv.slice(2)), c = await config(), name = c.github.owner + '/' + c.github.repository;
  const gh = process.env.GITHUB_CLI_BIN || 'gh';
  assert(!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN && !process.env.GH_CONFIG_DIR, 'Use the authenticated native GitHub CLI');
  const opts = { cwd: root, timeout: 60000, maxBuffer: 2000000, env: { ...process.env, GH_PROMPT_DISABLED: '1', GIT_TERMINAL_PROMPT: '0' } };
  async function api(route) {
    assert(route === 'user' || route === 'repos/' + name || route.startsWith('repos/' + name + '/'));
    try { return JSON.parse((await run(gh, ['api', '--hostname', 'github.com', route], opts)).stdout); }
    catch (e) { if (/HTTP 404/.test(e.stderr || '')) return null; throw Error('GitHub identity/target read failed'); }
  }
  const user = await api('user'); assert(typeof user?.login === 'string' && Number.isSafeInteger(user.id), 'GitHub identity not confirmed');
  assert.equal(await git('status', '--porcelain'), '', 'Commit reviewed source before pushing');
  assert(isExpectedRepositoryOrigin(await git('remote', 'get-url', 'origin')),'GitHub origin mismatch');
  const commit = await git('rev-parse', 'HEAD'), tree = await git('rev-parse', 'HEAD^{tree}');
  for (const file of (await git('ls-files')).split('\n')) assert(!/(?:^|\/)(?:\.env(?:\.|$)|node_modules|\.runtime|\.pixi)|\.(?:zip|pem|key)$/.test(file) || file === '.env.example', 'Credential/private file cannot be versioned');
  let repo = await api('repos/' + name);
  assert(repo?.full_name === name && repo.id===1473684173&&repo.owner.id === c.github.ownerId && repo.visibility===c.github.visibility && repo.permissions?.push && !repo.archived, 'Existing public repository target mismatch');
  const branch = repo ? await api('repos/' + name + '/git/ref/heads/main') : null;
  if (branch && branch.object.sha !== commit) {
    await git('merge-base', '--is-ancestor', branch.object.sha, commit);
  }
  assert(repo,'The existing corporate repository must be present; this workflow does not recreate it');
  const plan = { actor: user.login, actorId: user.id, owner: c.github.owner, ownerId: c.github.ownerId, repository: name, private: c.github.visibility==='private', repositoryId: repo?.id || null, createRepository: false, commit, tree, branch: 'main', previousCommit: branch?.object.sha || null, maxWrites: branch?.object.sha === commit ? 0 : 1 };
  const planHash = sha(JSON.stringify(plan)); await write('.runtime/repository-preview.json', { mode: 'dry-run', plan, planHash });
  if (!options.apply) { console.log(JSON.stringify({ ok: true, mode: 'dry-run', plan, planHash })); return; }
  assert.equal(options.planHash, planHash, 'Repository preview changed');
  const intentPath = '.runtime/repository-intents/' + planHash + '.json';
  let intent; try { intent = await json(intentPath); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  assert(!intent || intent.state === 'verified', 'An uncertain repository write requires reread before another push');
  if (branch?.object.sha !== commit) {
    await write(intentPath, { state: 'pushing', repositoryId: repo.id, plan, planHash });
    const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
    const helper = '!' + quote(gh) + ' auth git-credential';
    try { await run('git', ['-C', root, '-c', 'credential.helper=', '-c', 'credential.https://github.com.helper=' + helper, 'push', 'origin', commit + ':refs/heads/main'], opts); }
    catch { throw Error('Push requires read-only reconciliation; no automatic retry'); }
  }
  const after = await api('repos/' + name + '/git/ref/heads/main'), remoteCommit = await api('repos/' + name + '/git/commits/' + commit);
  assert.equal(after.object.sha, commit); assert.equal(remoteCommit.tree.sha, tree);
  const remote = await api('repos/' + name); assert(remote.visibility===c.github.visibility && remote.owner.id === c.github.ownerId && remote.id === repo.id);
  const report = { ok: true, mode: 'apply', verifiedAt: new Date().toISOString(), planHash, repository: name, repositoryId: repo.id, url: remote.html_url, private: remote.private, branch: 'main', sourceCommit: commit, treeVerified: true, credentialExported: false };
  await write('.runtime/repository-verified.json', report); await write(intentPath, { state: 'verified', ...report }); console.log(JSON.stringify(report));
}
main().catch(error => { console.error(JSON.stringify({ ok: false, error: error.message?.slice(0, 400), rawCommandOutputDisclosed: false })); process.exitCode = 1; });
