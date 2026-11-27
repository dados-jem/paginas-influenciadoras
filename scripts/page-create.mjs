import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import sharp from 'sharp';
import {root,json,sha,write} from './project.mjs';
import {validateIdentity,validateRegistry} from '../src/lib/page-registry.mjs';
import {campaignBody} from '../src/lib/campaign-template.mjs';

export async function preparePageCreation(input,pages,{imageMetadata,bodyExists=false}={}){
 assert(input&&typeof input==='object'&&!Array.isArray(input));
 const slug=validateIdentity(input.slug),key=validateIdentity(input.key||slug);validateRegistry(pages);
 assert(!pages.some(p=>p.slug===slug||p.key===key),'Page already exists; edit its existing files');assert(!bodyExists,'Existing content must not be overwritten');
 assert(typeof input.title==='string'&&input.title.length>=3&&input.title.length<=200&&typeof input.description==='string'&&input.description.length>=12&&input.description.length<=500,'Title and description are required');
 const heroImage=input.heroImage||'/media/marca/logo-jm.png',socialImage=input.socialImage||heroImage;
 for(const asset of [heroImage,socialImage])assert(/^\/media\/[a-zA-Z0-9_./-]+\.(?:webp|png|jpe?g|svg)$/.test(asset)&&!asset.split('/').includes('..'),'Use an existing local media asset');
 assert(imageMetadata?.width>0&&imageMetadata?.height>0,'Image intrinsic dimensions are required');
 const page={key,slug,title:input.title,description:input.description,heroImage,socialImage,template:'campaign',delivery:'local',status:'draft',productUrl:null,pricing:null,indexable:false};
 const body=campaignBody({...input,heroImage},imageMetadata);validateRegistry([...pages,page]);
 return {page,body,pages:[...pages,page]};
}
async function main(){
 const {values:a}=parseArgs({options:{file:{type:'string'},apply:{type:'boolean'},'plan-hash':{type:'string'},help:{type:'boolean'}}});
 if(a.help){console.log('npm run page:create -- --file examples/new-page.json [--apply --plan-hash HASH]\nDefault: offline dry-run. Creates a local draft; never publishes or alters commerce.');return;}
 assert(a.file,'Provide --file with the page brief');const input=JSON.parse(await fs.readFile(path.resolve(a.file),'utf8')),pages=await json('src/content/pages.json');
 const hero=input.heroImage||'/media/marca/logo-jm.png';assert(hero.startsWith('/media/')&&!hero.split('/').includes('..'));const image=await fs.readFile(path.join(root,'public',hero));const imageMetadata=await sharp(image).metadata();
 const key=validateIdentity(input.key||input.slug),bodyFile='src/content/'+key+'.html',bodyExists=Boolean(await fs.stat(path.join(root,bodyFile)).catch(()=>null));
 const result=await preparePageCreation(input,pages,{imageMetadata,bodyExists});await fs.access(path.join(root,'public',result.page.socialImage));
 const plan={version:1,slug:result.page.slug,beforeSha256:sha(JSON.stringify(pages)),imageSha256:sha(image),writes:[{path:'src/content/pages.json',sha256:sha(JSON.stringify(result.pages,null,2)+'\n')},{path:bodyFile,sha256:sha(result.body)}],publicUrl:'https://lp.joaoemariaeditora.com.br/'+result.page.slug+'/',delivery:'local',platformWrites:0};
 const planHash=sha(JSON.stringify(plan));await write('.runtime/page-create-preview.json',{planHash,plan});
 if(!a.apply){assert(!a['plan-hash']);console.log(JSON.stringify({ok:true,mode:'dry-run',planHash,plan,networkRequests:0}));return;}
 assert.equal(a['plan-hash'],planHash,'The brief or source changed; regenerate the preview');
 const lock=await fs.open(path.join(root,'.runtime/page-create.lock'),'wx');
 try{assert.equal(sha(JSON.stringify(await json('src/content/pages.json'))),plan.beforeSha256);assert(!await fs.stat(path.join(root,bodyFile)).catch(()=>null));
  await write('.runtime/page-create-backups/'+planHash+'.json',{pages,plan});await fs.writeFile(path.join(root,bodyFile),result.body,{flag:'wx'});
  try{await fs.writeFile(path.join(root,'src/content/pages.json'),JSON.stringify(result.pages,null,2)+'\n');}catch(e){await fs.unlink(path.join(root,bodyFile));throw e;}
  assert.equal(sha(await fs.readFile(path.join(root,bodyFile))),plan.writes[1].sha256);assert.equal(sha(await fs.readFile(path.join(root,'src/content/pages.json'))),plan.writes[0].sha256);
  console.log(JSON.stringify({ok:true,mode:'apply',planHash,slug:result.page.slug,filesWritten:2,delivery:'local',platformWrites:0}));
 }finally{await lock.close();await fs.unlink(path.join(root,'.runtime/page-create.lock'));}
}
if(import.meta.main)main().catch(e=>{console.error(JSON.stringify({ok:false,error:String(e.message).slice(0,350)}));process.exitCode=1;});
