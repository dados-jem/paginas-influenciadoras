import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {root,json,sha,write} from './project.mjs';
import {validatePublicationPaths} from '../src/lib/page-registry.mjs';
export const receiptsFile='config/publication-receipts.json';
export function publicReceipt(r){
 const deploymentId=r.deploymentId,manifestHash=r.fullManifestHash||r.manifestHash;
 assert(r.ok!==false&&/^[a-f0-9-]{36}$/.test(deploymentId||'')&&/^[a-f0-9]{64}$/.test(manifestHash||''),'A verified canonical deployment receipt is required');
 assert(!r.project||r.project==='jm-lp');
 for(const s of [r.headers,r.redirects])assert(typeof s==='string'&&s.length<200000&&!/(?:Bearer\s+\S+|cfat_[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]+)/.test(s),'Receipt must contain public controls only');
 const ownedFiles=(r.artifact?.files||r.ownedFiles||[]).map(f=>({path:f.path,nativeHash:f.nativeHash,sha256:f.sha256,bytes:f.bytes}));
 assert(ownedFiles.length>0&&ownedFiles.length<=2048,'Retain proof of the previously owned publication');
 const pagePaths=ownedFiles.filter(f=>f.path.endsWith('/index.html')).map(f=>f.path);validatePublicationPaths(pagePaths);
 for(const f of ownedFiles){assert((pagePaths.includes(f.path)||/^\/influenciadoras-assets\/[a-f0-9]{16}\/.+/.test(f.path))&&!f.path.split('/').includes('..'));assert(/^[a-f0-9]{32}$/.test(f.nativeHash)&&/^[a-f0-9]{64}$/.test(f.sha256));}
 return {version:1,project:'jm-lp',deploymentId,manifestHash,sourceCommit:r.sourceCommit||null,artifactSha256:r.artifactSha256||null,previousDeploymentId:r.previousDeploymentId||null,headers:r.headers,headersSha256:sha(r.headers),redirects:r.redirects,redirectsSha256:sha(r.redirects),redirectChecks:r.redirectChecks||[],canaries:r.canaries||[],ownedFiles};
}
export function selectReceipt(registry,snapshot){const receipt=registry.receipts.find(r=>r.deploymentId===snapshot.id&&r.manifestHash===snapshot.manifestHash);assert(receipt,'The current shared deployment needs its verified public control receipt; import it with npm run publication:record');return publicReceipt(receipt);}
async function main(){
 const {values:a}=parseArgs({options:{file:{type:'string'},apply:{type:'boolean'},'plan-hash':{type:'string'}}});
 const source=path.resolve(a.file||path.join(root,'.runtime/lp-verified.json')),receipt=publicReceipt(JSON.parse(await fs.readFile(source,'utf8'))),before=await json(receiptsFile).catch(e=>{if(e.code!=='ENOENT')throw e;return{version:1,receipts:[]}});
 const after={version:1,receipts:[...before.receipts.filter(r=>r.deploymentId!==receipt.deploymentId),receipt].slice(-50)};
 const changed=JSON.stringify(before)!==JSON.stringify(after),plan={version:1,target:receiptsFile,beforeSha256:sha(JSON.stringify(before)),afterSha256:sha(JSON.stringify(after)),deploymentId:receipt.deploymentId,writes:changed?1:0,platformWrites:0},planHash=sha(JSON.stringify(plan));
 await write('.runtime/receipt-preview.json',{planHash,plan});
 if(!a.apply){assert(!a['plan-hash']);console.log(JSON.stringify({ok:true,mode:'dry-run',planHash,plan}));return;}
 assert.equal(a['plan-hash'],planHash);
 const lockPath=path.join(root,'.runtime/receipt.lock'),lock=await fs.open(lockPath,'wx');
 try{assert.equal(sha(JSON.stringify(await json(receiptsFile))),plan.beforeSha256,'Receipts changed; regenerate the preview');if(changed)await write(receiptsFile,after);assert.deepEqual(await json(receiptsFile),after);console.log(JSON.stringify({ok:true,mode:'apply',planHash,filesWritten:changed?1:0,platformWrites:0}));}
 finally{await lock.close();await fs.unlink(lockPath);}
}
if(import.meta.main)main().catch(e=>{console.error(JSON.stringify({ok:false,error:e.message.slice(0,350)}));process.exitCode=1;});
