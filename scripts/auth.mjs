import path from 'node:path';
import assert from 'node:assert/strict';
import {root,config} from './project.mjs';
import {quiet,interactive,runtimeEnv} from './local-runtime.mjs';
export const authProfile='jm-influenciadoras';
export const oauthScopes=['account:read','user:read','pages:write'];
const wrangler=path.join(root,'node_modules/wrangler/bin/wrangler.js');
export function parseWranglerCredential(raw){let value;try{value=JSON.parse(raw);}catch{throw Error('Não foi possível ler a autenticação do Cloudflare. Execute ./jm login.');}assert(['api_token','oauth'].includes(value.type)&&typeof value.token==='string'&&value.token.length>=20,'Use login pessoal ou token Pages; chave global não é aceita.');return value.token;}
export async function cloudflareEnvironment(){
 const c=await config(),env=runtimeEnv();assert(!env.CLOUDFLARE_ACCOUNT_ID||env.CLOUDFLARE_ACCOUNT_ID===c.cloudflare.accountId,'Conta Cloudflare divergente');env.CLOUDFLARE_ACCOUNT_ID=c.cloudflare.accountId;
 if(!env.CLOUDFLARE_API_TOKEN){let raw;try{raw=await quiet(process.execPath,[wrangler,'auth','token','--json','--profile',authProfile],{env});}catch{throw Error('Cloudflare não está autenticado neste projeto. Execute ./jm login.');}env.CLOUDFLARE_API_TOKEN=parseWranglerCredential(raw);}
 return env;
}
export async function verifyAccess({env=process.env,request=fetch,github=undefined}={}){
 const c=await config(),gh=github??JSON.parse(await quiet(env.GITHUB_CLI_BIN||'gh',['api','repos/'+c.github.owner+'/'+c.github.repository],{env}));
 assert(gh.id===1473684173&&gh.owner?.id===c.github.ownerId&&gh.visibility==='public'&&gh.permissions?.push,'Aceite o convite de escrita no repositório correto e entre na sua conta GitHub.');
 const headers={authorization:'Bearer '+env.CLOUDFLARE_API_TOKEN};let project;
 for(const [route,check]of [['',v=>v.name===c.cloudflare.accountName],['/pages/projects/jm-lp',v=>{project=v;return v.name==='jm-lp'&&v.domains?.includes('lp.joaoemariaeditora.com.br')&&v.production_branch==='main'&&!v.source}]]){const r=await request('https://api.cloudflare.com/client/v4/accounts/'+c.cloudflare.accountId+route,{headers,redirect:'error',signal:AbortSignal.timeout(20000)});let d;try{d=await r.json();}catch{throw Error('Resposta de acesso inválida; nenhum segredo foi exibido.');}assert(r.ok&&d.success&&check(d.result),'Aceite o convite Pages da João & Maria e confira o login/escopo da sua credencial.');}
 return {ok:true,mode:'read-only',repository:gh.full_name||'dados-jem/paginas-influenciadoras',githubWrite:true,cloudflareAccount:c.cloudflare.accountName,project:project.name,domain:c.origin,platformWrites:0};
}
export async function login(){
 const gh=process.env.GITHUB_CLI_BIN||'gh';let githubReady=false;try{await quiet(gh,['auth','status','--hostname','github.com']);githubReady=true;}catch{}
 if(!githubReady)await interactive(gh,['auth','login','--hostname','github.com','--web','--git-protocol','https','--skip-ssh-key']);
 let cfReady=false;try{await cloudflareEnvironment();cfReady=true;}catch{}
 if(!cfReady)await interactive(process.execPath,[wrangler,'auth','create',authProfile,'--browser=false','--scopes',...oauthScopes]);
 const env=await cloudflareEnvironment(),access=await verifyAccess({env});
 for(const field of ['user.name','user.email']){let current='';try{current=await quiet('git',['config','--get',field]);}catch{}if(current)continue;const actor=JSON.parse(await quiet(gh,['api','user']));assert(Number.isSafeInteger(actor.id)&&/^[a-zA-Z0-9-]+$/.test(actor.login));const value=field==='user.name'?(actor.name||actor.login):actor.id+'+'+actor.login+'@users.noreply.github.com';await quiet('git',['config','--local',field,value]);assert.equal(await quiet('git',['config','--local','--get',field]),value);}
 console.log(JSON.stringify({...access,authentication:'individual',secretsDisclosed:false}));return access;
}
