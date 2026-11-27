import assert from 'node:assert/strict';

export const reservedSlugs = new Set(['index','404','api','admin','assets','influenciadoras-assets','media','fonts','brand','_astro','robots','sitemap','assinatura-2-anos','assinatura-pitiquinhos','guia-de-leitura','combo-da-camila-abadie','combo-da-icara-barbosa','combo-da-laura-padilha','combo-da-stephany-grande-familia','combo-da-amanda-goulart','combo-da-marcelle-massa']);
export function validateIdentity(value) {
 assert(typeof value==='string'&&value.length<=80&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),'Use a slug with lowercase letters, numbers and single hyphens');
 assert(!reservedSlugs.has(value),'This slug belongs to another route in the shared LP site');
 return value;
}
export function validateRegistry(pages) {
 assert(Array.isArray(pages)&&pages.length>0&&pages.length<=100,'A registry of 1–100 pages is required');
 assert(new Set(pages.map(p=>p.key)).size===pages.length,'Duplicate page key');
 assert(new Set(pages.map(p=>p.slug)).size===pages.length,'Duplicate page slug');
 for(const p of pages){validateIdentity(p.key);validateIdentity(p.slug);assert(p.delivery===undefined||['local','production'].includes(p.delivery),'Unknown page delivery target');}
 return pages;
}
export const productionPages=pages=>validateRegistry(pages).filter(p=>(p.delivery??'production')==='production');
export const expectedCtas=page=>page.template==='campaign'?3:5;
export const pagePath=page=>'/'+validateIdentity(page.slug)+'/index.html';
export function validatePublicationPaths(paths){assert(Array.isArray(paths)&&paths.length>0&&paths.length<=100);for(const p of paths){assert(/^\/[a-z0-9-]+\/index\.html$/.test(p));validateIdentity(p.split('/')[1]);}assert(new Set(paths).size===paths.length);return new Set(paths);}
