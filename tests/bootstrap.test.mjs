import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {root} from '../scripts/project.mjs';
import {sourceFingerprint,dependenciesValid,snapshotMatches} from '../scripts/bootstrap.mjs';
import {parseWranglerCredential,verifyAccess,oauthScopes} from '../scripts/auth.mjs';
import {quiet,runtimeEnv} from '../scripts/local-runtime.mjs';
async function fixture(t){const runtime=path.join(root,'.runtime');await fs.mkdir(runtime,{recursive:true});const directory=await fs.mkdtemp(path.join(runtime,'test-bootstrap-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));return directory;}
test('private runtime files and installed dependencies never invalidate or enter the source fingerprint',async t=>{
 const dir=await fixture(t);await fs.writeFile(path.join(dir,'package.json'),'{}');const initial=await sourceFingerprint(dir);
 for(const name of ['.runtime','.pixi','node_modules']){await fs.mkdir(path.join(dir,name));await fs.writeFile(path.join(dir,name,'private'),'test-only-private-value');}await fs.writeFile(path.join(dir,'.env.local'),'PRIVATE=test-only-value');assert.equal(await sourceFingerprint(dir),initial);
 await fs.writeFile(path.join(dir,'package.json'),'{"changed":true}');assert.notEqual(await sourceFingerprint(dir),initial);
});
test('the setup detects a missing or mismatched pinned dependency instead of reporting success',async t=>{
 const dir=await fixture(t);await fs.writeFile(path.join(dir,'package.json'),JSON.stringify({dependencies:{astro:'7.3.2'}}));assert.equal(await dependenciesValid(dir),false);await fs.mkdir(path.join(dir,'node_modules/astro'),{recursive:true});await fs.writeFile(path.join(dir,'node_modules/astro/package.json'),'{"version":"7.3.1"}');assert.equal(await dependenciesValid(dir),false);await fs.writeFile(path.join(dir,'node_modules/astro/package.json'),'{"version":"7.3.2"}');assert.equal(await dependenciesValid(dir),true);
});
test('ZIP adoption refuses a different GitHub snapshot without overwriting source',()=>{assert.doesNotThrow(()=>snapshotMatches(['a:1'],['a:1']));assert.throws(()=>snapshotMatches(['a:1'],['a:2']),/diverge/);assert.throws(()=>snapshotMatches(['a:1'],[]),/incompleto/);});
test('OAuth and API token credentials remain in memory and global API keys are rejected',()=>{
 const token='synthetic-credential-value-for-local-tests';assert.equal(parseWranglerCredential(JSON.stringify({type:'oauth',token})),token);assert.equal(parseWranglerCredential(JSON.stringify({type:'api_token',token})),token);assert.throws(()=>parseWranglerCredential(JSON.stringify({type:'api_key',key:token,email:'fixture@example.invalid'})));assert.throws(()=>parseWranglerCredential('<html>'+token));assert(!oauthScopes.some(s=>/workers:|zone:|dns:|r2:|d1:/.test(s)));assert.equal(runtimeEnv().WRANGLER_WRITE_LOGS,'false');
});
test('doctor verifies the exact repository and Pages account through bounded read-only calls',async()=>{
 const calls=[],github={id:1473684173,owner:{id:327816671},visibility:'public',permissions:{push:true}},env={CLOUDFLARE_API_TOKEN:'synthetic-credential-value-for-local-tests'};
 const request=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({success:true,result:url.endsWith('/jm-lp')?{name:'jm-lp',domains:['lp.joaoemariaeditora.com.br'],production_branch:'main'}:{name:'Editora João e Maria'}})}};
 const result=await verifyAccess({env,github,request});assert.equal(result.platformWrites,0);assert.equal(calls.length,2);assert(!JSON.stringify(result).includes(env.CLOUDFLARE_API_TOKEN));assert(calls.every(c=>c.options.redirect==='error'&&!c.options.method));
 await assert.rejects(verifyAccess({env,github:{...github,permissions:{push:false}},request}),/convite/);
 await assert.rejects(verifyAccess({env,github,request:async()=>({ok:true,json:async()=>({success:true,result:{name:'Outra conta'}})})}),/João/);
});
test('failed child commands do not disclose raw output or credentials',async()=>{
 const secret='synthetic-private-output-must-stay-hidden';await assert.rejects(quiet(process.execPath,['-e',`console.error(${JSON.stringify(secret)});process.exit(1)`]),e=>!e.message.includes(secret));
});
test('bootstrap manifests lock all supported platforms and agree across shell and PowerShell entry points',async()=>{
 const config=JSON.parse(await fs.readFile(path.join(root,'config/toolchain.json'),'utf8')),tsv=await fs.readFile(path.join(root,'config/toolchain.tsv'),'utf8'),lock=await fs.readFile(path.join(root,'pixi.lock'),'utf8');
 for(const [key,a]of Object.entries(config.artifacts)){assert(tsv.includes([key,a.url,a.sha256].join('\t')));assert(/^[a-f0-9]{64}$/.test(a.sha256));assert(a.url.startsWith('https://github.com/prefix-dev/pixi/releases/download/v'+config.pixiVersion+'/'));}
 for(const platform of ['linux-64','linux-aarch64','osx-64','osx-arm64','win-64'])assert(lock.includes(platform));
});
