import assert from 'node:assert/strict';
export const escapeHtml=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
export function campaignBody(input,{width,height}){
 assert(typeof input.headline==='string'&&input.headline.trim().length>=3&&input.headline.length<=240,'A real headline is required');
 assert(typeof input.lead==='string'&&input.lead.trim().length>=12&&input.lead.length<=2000,'A real introduction is required');
 assert(Array.isArray(input.sections)&&input.sections.length>=1&&input.sections.length<=12,'Provide 1–12 content sections');
 const sections=input.sections.map(s=>{assert(typeof s.title==='string'&&s.title.length>=3&&s.title.length<=160&&typeof s.body==='string'&&s.body.length>=12&&s.body.length<=5000);return `<section class="campaign-section"><h2>${escapeHtml(s.title)}</h2><p>${escapeHtml(s.body).replaceAll('\n','<br>')}</p></section>`;}).join('\n');
 const image=escapeHtml(input.heroImage),cta=escapeHtml(input.ctaLabel||'Conhecer a oferta');
 return `<main data-campaign><section class="campaign-hero"><div><a href="https://www.joaoemariaeditora.com.br/" aria-label="João & Maria Editora">João & Maria</a><h1>${escapeHtml(input.headline)}</h1><p>${escapeHtml(input.lead)}</p><a class="campaign-cta" href="#oferta">${cta}</a></div><img class="hero__img" src="${image}" alt="${escapeHtml(input.imageAlt||input.title)}" width="${width}" height="${height}" fetchpriority="high" decoding="async"></section><div class="campaign-content">${sections}<a class="campaign-cta" href="#oferta">${cta}</a><section id="oferta" class="campaign-offer" aria-labelledby="offer-title"><h2 id="offer-title">${escapeHtml(input.title)}</h2>{{campaign.offer}}<a class="campaign-cta" href="#oferta">${cta}</a></section></div></main>\n`;
}
export function campaignOffer(page){
 if(!page.pricing)return '<p class="bn-aviso">RASCUNHO — oferta e destino de compra em preparação.</p>';
 return `<p>De <s>R$ {{price.full}}</s> por <strong>R$ {{price.retail}}</strong></p><p>Assinantes: <strong>R$ {{price.subscriber}}</strong></p><p>Ou ${page.pricing.installments}x de R$ {{price.retailInstallment}} sem juros.</p><p class="bn-aviso">PREÇO PROVISÓRIO — conferir a oferta e o produto antes de publicar.</p>`;
}
