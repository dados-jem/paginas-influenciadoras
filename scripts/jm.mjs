import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {root} from './project.mjs';
import {runtimeEnv,npmCli} from './local-runtime.mjs';
import {cloudflareEnvironment,verifyAccess,login} from './auth.mjs';
import {main as setup,dependenciesValid,sourceFingerprint} from './bootstrap.mjs';
const direct={repository:'repository.mjs',deploy:'lp.mjs','verify:lp':'lp.mjs','publication:record':'publication-receipts.mjs','page:create':'page-create.mjs',assets:'compositions.mjs','deploy:preview':'deploy.mjs','verify:published':'verify-published.mjs'};
const npmTasks=new Set(['dev','preview','build','test','skill:check','verify']);
async function doctor(online){
 const state=JSON.parse(await fs.readFile(path.join(root,'.runtime/setup-state.json'),'utf8').catch(()=>'{"verifiedSourceHash":null}'));
 const report={ok:await dependenciesValid(),mode:'read-only',localDependencies:await dependenciesValid(),verifiedSource:state.verifiedSourceHash===await sourceFingerprint(),tools:state.tools||{},platformWrites:0};
 if(online)report.access=await verifyAccess({env:await cloudflareEnvironment()});console.log(JSON.stringify(report));assert(report.ok,'Execute o iniciador para preparar as dependências');return report;
}
async function main(){
 const [command,...args]=process.argv.slice(2);if(!command||command==='help'){console.log('jm setup | login | doctor [--online] | dev | test | build | page:create | repository | deploy | publication:record | verify:lp\nAs publicações continuam dry-run por padrão; apply exige hash.');return;}
 if(command==='setup')return setup(args);if(command==='login'){assert(!args.length);return login();}if(command==='doctor'){assert(args.length===0||args.length===1&&args[0]==='--online');return doctor(args[0]==='--online');}
 assert(direct[command]||npmTasks.has(command),'Comando não reconhecido');assert(await dependenciesValid(),'Execute iniciar antes de trabalhar');
 const env=['deploy','verify:lp','deploy:preview','verify:published'].includes(command)?await cloudflareEnvironment():runtimeEnv();
 const childArgs=direct[command]?[path.join(root,'scripts',direct[command]),...(command==='verify:lp'?['--verify']:[]),...args]:[await npmCli(),...(command==='test'?['test']:['run',command]),...(args.length?['--',...args]:[])];
 const child=spawn(process.execPath,childArgs,{cwd:root,env,stdio:'inherit'});const code=await new Promise((resolve,reject)=>{child.once('error',()=>reject(Error('Não foi possível iniciar o comando do projeto.')));child.once('exit',resolve);});process.exitCode=code??1;
}
main().catch(e=>{console.error(JSON.stringify({ok:false,error:e.message.slice(0,400),secretsDisclosed:false}));process.exitCode=1;});
