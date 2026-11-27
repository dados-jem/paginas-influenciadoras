import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {preparePageCreation} from '../scripts/page-create.mjs';
import {productionPages,validateRegistry} from '../src/lib/page-registry.mjs';
import {renderLanding,validatePage} from '../src/lib/landing.mjs';
import {publicReceipt,selectReceipt,localArtifactFor} from '../scripts/publication-receipts.mjs';
const pages=JSON.parse(await fs.readFile(new URL('../src/content/pages.json',import.meta.url)));
const input={slug:'nova-campanha',title:'Uma nova campanha',description:'Uma descrição própria desta nova campanha.',headline:'Livros para uma nova história',lead:'Um texto original para apresentar esta seleção de livros.',heroImage:'/media/marca/logo-jm.png',sections:[{title:'Uma seleção própria',body:'Conteúdo original sem copiar depoimentos ou outras ofertas.'}]};
const options={imageMetadata:{width:300,height:100}};
test('a new page starts as an isolated local draft without inherited commercial claims',async()=>{
 const result=await preparePageCreation(input,pages,options);
 assert.equal(result.pages.length,pages.length+1);assert.equal(productionPages(result.pages).length,productionPages(pages).length);
 assert.equal(result.page.delivery,'local');assert.equal(result.page.status,'draft');assert.equal(result.page.pricing,null);assert.equal(result.page.productUrl,null);assert.equal(result.page.indexable,false);
 assert.deepEqual(result.pages.slice(0,pages.length),pages);const html=renderLanding(result.body,result.page);assert(html.includes('RASCUNHO'));assert(!/Cássia|Forja|depoimento|data-produto-loja|364,26|292,98/u.test(html.replace(input.sections[0].body,'')));
 assert.throws(()=>validatePage({...result.page,status:'published'}));
});
test('page creation rejects duplicates, shared routes, path traversal, and overwriting content',async()=>{
 for(const slug of [pages[0].slug,'guia-de-leitura','../other','Uppercase','two--hyphens'])await assert.rejects(preparePageCreation({...input,slug},pages,options));
 await assert.rejects(preparePageCreation({...input,heroImage:'/media/../private.png'},pages,options));
 await assert.rejects(preparePageCreation(input,pages,{...options,bodyExists:true}));
 assert.throws(()=>validateRegistry([...pages,{...pages[0]}]));
});
test('untrusted brief text remains text in generated HTML',async()=>{
 const result=await preparePageCreation({...input,headline:'<script>alert(1)</script>'},pages,options);
 assert(!result.body.includes('<script>'));assert(result.body.includes('&lt;script&gt;'));renderLanding(result.body,result.page);
});
test('only a receipt for the exact canonical deployment can be reused by a fresh clone',()=>{
 const receipt=publicReceipt({ok:true,deploymentId:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',fullManifestHash:'a'.repeat(64),headers:'/*\n X-Robots-Tag: noindex\n',redirects:'',artifact:{files:[{path:'/nova-campanha/index.html',nativeHash:'b'.repeat(32),sha256:'c'.repeat(64),bytes:100}]}});
 assert.deepEqual(selectReceipt({receipts:[receipt]},{id:receipt.deploymentId,manifestHash:receipt.manifestHash}),receipt);
 assert.throws(()=>selectReceipt({receipts:[receipt]},{id:'new-concurrent-deployment',manifestHash:receipt.manifestHash}));
 assert.throws(()=>publicReceipt({...receipt,headers:'Bearer this-must-never-be-versioned'}));
 assert.throws(()=>publicReceipt({...receipt,ownedFiles:[{...receipt.ownedFiles[0],path:'/guia-de-leitura/index.html'}]}));
});
test('published verification retains a matching local artifact despite JSON property order',()=>{
 const owned={path:'/nova-campanha/index.html',nativeHash:'a'.repeat(32),sha256:'b'.repeat(64),bytes:100};
 const receipt={ownedFiles:[owned],sourceCommit:'c'.repeat(40),artifactSha256:'d'.repeat(64)};
 const candidate={origin:'https://lp.joaoemariaeditora.com.br',prefix:'/influenciadoras-assets/cccccccccccccccc/',directory:'/local/artifact',files:[{path:owned.path,bytes:owned.bytes,sha256:owned.sha256,nativeHash:owned.nativeHash}]};
 assert.equal(localArtifactFor(receipt,[candidate]),candidate);
 assert(!localArtifactFor(receipt,[{...candidate,files:[{...owned,nativeHash:'e'.repeat(32)}]}]).directory);
 assert.deepEqual(localArtifactFor(receipt).files,[owned]);
});
