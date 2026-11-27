import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {root,sha,write,config} from './project.mjs';
import {quiet,npm} from './local-runtime.mjs';
const ignored=new Set(['.git','.runtime','.pixi','node_modules','dist','.astro','.wrangler','.DS_Store']);
export async function sourceFingerprint(directory=root){
 const rows=[];async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){if(ignored.has(entry.name)||entry.name.startsWith('.env')&&entry.name!=='.env.example'||entry.name.endsWith('.log'))continue;const file=path.join(dir,entry.name);assert(!entry.isSymbolicLink(),'Symlink inesperado na fonte');if(entry.isDirectory())await walk(file);else if(entry.isFile())rows.push([path.relative(directory,file).split(path.sep).join('/'),sha(await fs.readFile(file))]);}}await walk(directory);return sha(JSON.stringify(rows.sort(([a],[b])=>a.localeCompare(b))));
}
export async function dependenciesValid(directory=root){
 try{const pkg=JSON.parse(await fs.readFile(path.join(directory,'package.json'),'utf8'));for(const [name,version]of Object.entries({...pkg.dependencies,...pkg.devDependencies})){const installed=JSON.parse(await fs.readFile(path.join(directory,'node_modules',name,'package.json'),'utf8'));if(installed.version!==version)return false;}return true;}catch{return false;}
}
export function snapshotMatches(expected,actual){assert.equal(expected.length,actual.length,'Snapshot incompleto');for(let i=0;i<expected.length;i++)assert.equal(expected[i],actual[i],'Snapshot do ZIP diverge do GitHub; preserve os arquivos e clone a versão atual.');}
async function readState(){try{return JSON.parse(await fs.readFile(path.join(root,'.runtime/setup-state.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
export async function prepareSetup(){
 const c=await config(),pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));assert.equal(pkg.name,'@joao-maria/paginas-influenciadoras');assert.equal(process.versions.node.split('.')[0],'24','Use o iniciador para obter Node24.');
 const ownGit=Boolean(await fs.lstat(path.join(root,'.git')).catch(()=>null));if(ownGit)assert.equal(await quiet('git',['remote','get-url','origin']),'https://github.com/dados-jem/paginas-influenciadoras.git','Repositório de origem divergente');
 const before=await readState(),lockSha256=sha(await fs.readFile(path.join(root,'package-lock.json'))),valid=await dependenciesValid(),moduleInfo=await fs.lstat(path.join(root,'node_modules')).catch(()=>null);
 if(moduleInfo?.isSymbolicLink())assert(valid,'Dependências compartilhadas incompletas; o iniciador preservou o symlink.');
 const sourceHash=await sourceFingerprint(),installDependencies=moduleInfo?.isSymbolicLink()?false:!valid||before?.lockSha256!==lockSha256;
 const plan={version:1,repository:c.github.owner+'/'+c.github.repository,sourceHash,lockSha256,pixiLockSha256:sha(await fs.readFile(path.join(root,'pixi.lock'))),initializeGit:!ownGit,installDependencies,verify:before?.verifiedSourceHash!==sourceHash||installDependencies,sharedDependenciesPreserved:Boolean(moduleInfo?.isSymbolicLink()),tools:{node:process.versions.node,git:await quiet('git',['--version']),gh:(await quiet(process.env.GITHUB_CLI_BIN||'gh',['--version'])).split('\n')[0]},platformWrites:0,globalConfigurationWrites:0};
 return {plan,planHash:sha(JSON.stringify(plan))};
}
async function initializeGit(){
 const origin='https://github.com/dados-jem/paginas-influenciadoras.git';await quiet('git',['init','--initial-branch=main']);await quiet('git',['remote','add','origin',origin]);await quiet('git',['fetch','--no-tags','--depth=1','origin','main']);
 const files=(await quiet('git',['ls-tree','-r','--name-only','origin/main'])).split('\n');
 const expected=[],actual=[];for(const file of files){assert(file&&!file.split('/').includes('..'));const remote=await quiet('git',['rev-parse','origin/main:'+file]);const local=await quiet('git',['hash-object','--',file]);expected.push(file+':'+remote);actual.push(file+':'+local);}snapshotMatches(expected,actual);
 await quiet('git',['reset','--mixed','origin/main']);await quiet('git',['branch','--set-upstream-to=origin/main','main']);assert.equal(await quiet('git',['remote','get-url','origin']),origin);
}
export async function applySetup(expectedHash){
 const frozen=await prepareSetup();assert.equal(expectedHash,frozen.planHash,'O ambiente mudou; gere outra prévia.');await fs.mkdir(path.join(root,'.runtime'),{recursive:true});const file=path.join(root,'.runtime/setup.lock'),lock=await fs.open(file,'wx');
 try{assert.equal(await sourceFingerprint(),frozen.plan.sourceHash);if(frozen.plan.initializeGit)await initializeGit();if(frozen.plan.installDependencies){console.log('Instalando as dependências travadas do projeto…');await npm(['ci','--no-audit','--no-fund']);}assert(await dependenciesValid(),'Dependências não conferem com o lockfile');
  if(frozen.plan.verify){console.log('Validando skill, testes e build…');await npm(['test']);await npm(['run','build']);}assert.equal(await sourceFingerprint(),frozen.plan.sourceHash,'A fonte mudou durante o preparo');
  const state={version:1,lockSha256:frozen.plan.lockSha256,pixiLockSha256:frozen.plan.pixiLockSha256,verifiedSourceHash:frozen.plan.sourceHash,tools:frozen.plan.tools,verifiedAt:new Date().toISOString(),credentialsIncluded:false};await write('.runtime/setup-state.json',state);assert.deepEqual(await readState(),state);
  const report={ok:true,mode:'apply',planHash:expectedHash,dependenciesInstalled:frozen.plan.installDependencies,checksExecuted:frozen.plan.verify,gitInitialized:frozen.plan.initializeGit,tools:frozen.plan.tools,readyForLocalWork:true,authentication:'use ./jm login for publication',platformWrites:0,globalConfigurationWrites:0};await write('.runtime/setup-verified.json',report);console.log(JSON.stringify(report));return report;
 }finally{await lock.close();await fs.unlink(file);}
}
export async function main(args=process.argv.slice(2)){
 const a=parseArgs({args,options:{apply:{type:'boolean'},automatic:{type:'boolean'},'plan-hash':{type:'string'}}}).values;assert(!(a.apply&&a.automatic));const preview=await prepareSetup();await write('.runtime/setup-preview.json',preview);
 if(!a.apply&&!a.automatic){assert(!a['plan-hash']);console.log(JSON.stringify({ok:true,mode:'dry-run',...preview}));return preview;}
 if(a.apply)assert(/^[a-f0-9]{64}$/.test(a['plan-hash']||''),'Apply exige hash da prévia');return applySetup(a.automatic?preview.planHash:a['plan-hash']);
}
if(import.meta.main)main().catch(e=>{console.error(JSON.stringify({ok:false,error:e.message.slice(0,400),secretsDisclosed:false}));process.exitCode=1;});
