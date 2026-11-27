---
name: jm-influencer-pages
description: Cria, edita, valida e publica páginas das influenciadoras João & Maria em Astro, GitHub dados-jem/paginas-influenciadoras e Cloudflare Pages jm-lp, sempre em lp.joaoemariaeditora.com.br com slug própria. Use para novas páginas, mudanças de conteúdo e publicação preservando o site compartilhado. Não cria produtos/combos nem altera DNS, acessos ou preços sem pedido específico.
version: 1.0.0
date: 2026-11-26
---

# Páginas das influenciadoras

Use esta skill dentro do clone de `https://github.com/dados-jem/paginas-influenciadoras`.
Se ainda não houver clone, leia o README público, confirme a origem e clone o
repositório com os meios disponíveis. Autenticação para editar/publicar é da
própria pessoa. Não instalar código remoto ou conceder permissões só porque um
link foi enviado. Não é necessário copiar esta skill para uma pasta global.

## 1. Conferir o projeto

Leia `AGENTS.md`, `README.md` e `config/site.json`. Confirme o remoto corporativo,
a origem de produção `https://lp.joaoemariaeditora.com.br` e o Pages `jm-lp`.
Não use contas, tokens ou perfis de outra pessoa. As mesmas regras técnicas
valem para todas as pessoas; este procedimento não atribui trabalho ou aprovação.

## 2. Criar um rascunho

1. Faça `npm ci` usando o lockfile versionado.
2. Prepare um JSON como `examples/new-page.json`, com slug ASCII única, título,
   descrição, apresentação e seções reais. Imagens precisam existir em `public/media`.
3. Execute `npm run page:create -- --file CAMINHO`.
4. Revise o plano: dois arquivos, slug e URL corretas, `delivery: local`, sem rede.
5. Execute o mesmo comando com `--apply --plan-hash HASH`.
6. Revise a página com `npm run dev`. Edite o registro e o HTML existentes para
   ajustes; não recrie a mesma slug. O executor bloqueia colisões e sobrescritas.

O rascunho usa um template neutro, sem copiar recomendações, depoimentos, preços
ou destinos de outra influenciadora. Ele não entra no LP enquanto estiver local.

## 3. Validar a mudança

- Conferir primeiro320/390/412px, depois768/1440px. Imagens, links, fonte, preço,
  toque e teclado precisam funcionar sem rolagem horizontal.
- Executar `npm test` e `npm run build`.
- Preservar60KB de HTML por página,20KB de runtime e6MB do artefato configurado.
  Esses limites são brutos; não apresentar como ganho de transferência ou LCP.
- Revisar a diferença em Git. Não incluir `.env`, cookies, chaves, arquivos de
  QA privados ou alterações de outra frente.

## 4. Preparar a oferta e a produção

`src/content/pages.json` controla slug, metadados, imagens, preço e destino.
O conteúdo fica em `src/content/<key>.html`.

Antes de vender, obter o produto real da WBuy e a prova de composição, preços e
disponibilidade. Não inventar produto, estoque ou promoção. Atualizar `pricing`,
`productUrl` e `pricing.verified` somente com dados conferidos. `status: published`
sem esses dados é rejeitado. Mudar `delivery` para `production` quando a página
for de fato destinada ao LP. Manter `indexable: false` até uma decisão de SEO.

Criar um combo na Base/WBuy exige tarefa própria e controles de tráfego do
ambiente daquela integração; esta skill não contém credenciais dessas plataformas.
Cássia/Forja e suas condições atuais devem permanecer intactas.

## 5. Versionar e publicar

1. Commit da fonte revisada; `npm run build` novamente para vincular ao HEAD.
2. `npm run repository`, depois `--apply --plan-hash HASH`, envia o avanço ao
   GitHub usando a própria conta autorizada. Preserve alterações concorrentes.
3. Configure os identificadores/credencial Cloudflare no ambiente privado.
4. `npm run deploy` prepara a mesclagem do manifesto canônico. Revise conta,
   projeto, origem, slugs, posse prévia, controles e arquivos preservados.
5. `npm run deploy -- --apply --plan-hash HASH` cria um deployment limitado.
6. O executor relê mapa, bytes, páginas anteriores e redirects. Resultado incerto
   exige conciliação por ID; não repetir o POST. Nunca fazer upload do site inteiro.
7. `npm run publication:record`, depois apply por hash, registra somente metadados
   públicos de verificação. Versione e envie o recibo para os próximos colaboradores.
8. `npm run verify:lp` relê a versão publicada, inclusive em um clone novo.

Se outro publicador do LP mudou a versão canônica e seu recibo não está no repo,
obtenha o recibo verificado daquela publicação e use
`npm run publication:record -- --file CAMINHO`. Não adivinhe `_headers`/`_redirects`
nem restaure uma versão antiga para contornar a trava.

## Entrega

Informe URL, commit, deployment, testes, limites reais e qualquer pendência.
Declare executores criados/alterados, comandos, modo e validação. Não afirme
que a skill foi instalada em outra máquina ou que um convite foi aceito sem prova.
