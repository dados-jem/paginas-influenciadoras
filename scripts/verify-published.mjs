import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root,config,json,files,sha,write} from './project.mjs';
import {verifyDelivery} from './delivery.mjs';
const c=await config(),artifact=await json('dist/release-manifest.json'),current=await json('.runtime/current-deployment.json');
assert.equal(current.sourceCommit,artifact.sourceCommit);assert.equal(current.artifactSha256,artifact.artifactSha256);
assert.equal(sha(JSON.stringify((await files(path.join(root,'dist'))).filter(f=>f.path!=='release-manifest.json'))),artifact.artifactSha256);
assert(process.env.CLOUDFLARE_ACCOUNT_ID===c.cloudflare.accountId&&process.env.CLOUDFLARE_API_TOKEN,'Own J&M Pages credential required');
const apiRoot='https://api.cloudflare.com/client/v4/accounts/'+c.cloudflare.accountId;
async function read(route){const r=await fetch(apiRoot+route,{headers:{authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN},redirect:'error',signal:AbortSignal.timeout(20000)});const j=await r.json();assert(r.ok&&j.success);return j.result;}
assert.equal((await read('')).name,c.cloudflare.accountName);
const project=await read('/pages/projects/'+c.cloudflare.projectName),deployment=project.canonical_deployment;
assert.equal(deployment.id,current.deploymentId);assert.equal(deployment.deployment_trigger.metadata.commit_hash,artifact.sourceCommit);assert.equal(deployment.latest_stage.status,'success');
const delivery=await verifyDelivery(c.origin,current.url,artifact);
const report={ok:true,mode:'read-only',verifiedAt:new Date().toISOString(),projectName:project.name,deploymentId:deployment.id,url:c.origin,immutableUrl:current.url,sourceCommit:artifact.sourceCommit,artifactSha256:artifact.artifactSha256,delivery,reconciledWithoutUpload:true,platformWrites:0};
await write('.runtime/deploy-verified.json',report);
const intentDir=path.join(root,'.runtime/deploy-intents');for(const f of await fs.readdir(intentDir).catch(()=>[])){if(!f.endsWith('.json'))continue;const key='.runtime/deploy-intents/'+f,p=await json(key);if(p.deploymentId===deployment.id&&p.plan?.sourceCommit===artifact.sourceCommit)await write(key,{...p,state:'verified',reconciledAt:report.verifiedAt,delivery});}
console.log(JSON.stringify(report));
