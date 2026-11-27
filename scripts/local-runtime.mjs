import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {root} from './project.mjs';
const execute=promisify(execFile);
export const runtimeEnv=()=>({...process.env,ASTRO_TELEMETRY_DISABLED:'1',WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false',WRANGLER_LOG_SANITIZE:'true',CI:process.env.CI||undefined});
export async function quiet(command,args,{cwd=root,env=runtimeEnv(),timeout=120000}={}){
 try{return (await execute(command,args,{cwd,env,timeout,maxBuffer:4000000})).stdout.trim();}
 catch{throw Error('Falhou a etapa '+path.basename(command)+' '+(args[0]||'')+'. Nenhuma saida privada foi exibida.');}
}
export async function npmCli(){
 const directory=path.dirname(process.execPath);
 for(const file of [path.join(directory,'node_modules/npm/bin/npm-cli.js'),path.resolve(directory,'../lib/node_modules/npm/bin/npm-cli.js'),path.resolve(directory,'../node_modules/npm/bin/npm-cli.js'),process.env.npm_execpath].filter(Boolean))if(path.basename(file)==='npm-cli.js'&&await fs.stat(file).catch(()=>null))return file;
 throw Error('npm ausente no ambiente portátil. Execute iniciar novamente.');
}
export async function npm(args,options={}){return quiet(process.execPath,[await npmCli(),...args],{...options,timeout:options.timeout??600000});}
export async function interactive(command,args,{env=runtimeEnv()}={}){
 const child=spawn(command,args,{cwd:root,env,stdio:'inherit'});const exit=await new Promise((resolve,reject)=>{child.once('error',()=>reject(Error('Não foi possível iniciar o login nativo.')));child.once('exit',resolve);});assert.equal(exit,0,'Login não concluído; retome o mesmo comando após entrar na conta.');
}
