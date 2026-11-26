# Páginas das influenciadoras — João & Maria

Astro estático e código no GitHub corporativo `dados-jem/paginas-influenciadoras`. As URLs finais são `https://lp.joaoemariaeditora.com.br/combo-da-cassia-kawamura/` e `https://lp.joaoemariaeditora.com.br/combo-da-forja-diaria/`. A publicação acrescenta essas rotas ao projeto Cloudflare Pages compartilhado `jm-lp`, preservando o mapa nativo dos demais arquivos. O projeto `paginas-influenciadoras` continua disponível para previews separados. A hospedagem destas páginas não depende da Hostinger.

## Editar e conferir

Requisitos: Node.js 24, npm e Git. Clone este repositório pela própria conta autorizada no GitHub.

```sh
npm ci
npm run dev
```

- `src/content/cassia-kawamura.html` e `src/content/forja-diaria.html`: textos e seções de cada página, sem scripts. O HTML é renderizado pelo layout Astro compartilhado.
- `src/content/pages.json`: títulos, descrição, imagens, preço cheio, descontos, parcelas, estado de publicação e URL oficial do produto.
- `public/media/`: imagens. `public/fonts/`: fontes locais.
- A composição inicial da Forja tem oito livros, sem Miloca e Esopo. `composition.books` em `pages.json` conserva as capas originais e os preços cheios dos oito componentes. O build exige que a lista, a soma e as quatro artes correspondam à mesma composição. Uma ampliação futura precisa atualizar esses dados, a copy e o cadastro da loja.
- `src/styles/landing.css`: visual compartilhado. `src/scripts/landing.mjs`: carrossel e repasse de UTMs.

As duas páginas começam em `draft`: preços provisórios, CTAs para a oferta, analytics comerciais desativados e `noindex`. Para liberar a venda, conferir o cadastro real na loja, preencher `productUrl`, atualizar os valores, marcar `pricing.verified: true` e só então mudar `status` para `published`. Não inventar preços ou estoque. A regra de descontos herdada do material é40% para o público e60% para assinantes; qualquer revisão comercial deve ser aprovada. Não há troca automática de campanha nem vencimento inventado neste projeto.

Antes de uma publicação comercial, revisar também `public/robots.txt` e `public/_headers`, que preservam a proteção de rascunho em todo o projeto. GTM `GTM-W8HJBC4R` e NEMU `ZCGhdVP3U2` estão no layout e ativam somente nas páginas comerciais. Não duplicar tags.

Para recompor hero, mockup, oferta e compartilhamento da Forja, use `scripts/compositions.mjs`. O executor desenha uma composição nativa com as capas originais, sem gerar ou alterar capas. `npm run assets` prepara a prévia em dry-run, sem alterar os arquivos públicos; `npm run assets -- --apply --plan-hash HASH_DA_PREVIA` grava os quatro arquivos exatos e verifica seus hashes. `npm run assets -- --check` é read-only e confere fontes, composição e saídas. O build também executa essa conferência. Assets anteriores são preservados, e as novas imagens recebem o sufixo da revisão.

## Publicar pela CLI

```sh
npm test
npm run build
git add src public config scripts tests README.md package.json package-lock.json astro.config.mjs .github .gitignore .env.example
git commit -m "Atualizar páginas das influenciadoras"
npm run build
```

A segunda compilação vincula o artefato ao commit exato. O diretório de trabalho deve estar limpo. O CI do GitHub valida testes e build; um push sozinho não publica no Pages.

Autentique a própria conta no GitHub CLI (`gh auth login`) e configure no ambiente privado `CLOUDFLARE_ACCOUNT_ID` e `CLOUDFLARE_API_TOKEN`. Colaboradores usam suas próprias contas com permissão de escrita neste repositório; a verificação exige que o dono do recurso continue sendo `dados-jem`, sem exigir compartilhamento do login corporativo. Somente a criação inicial de um repositório ainda ausente exige o proprietário corporativo. Reutilize uma credencial identificável da João & Maria com os acessos necessários a leitura da conta e edição de Pages. Não copie a chave de outra pessoa, não cole segredos no chat e não grave em Git. O GitHub do projeto deve permanecer privado. A concessão de acessos às pessoas é feita pelo responsável da J&M.

```sh
npm run repository
npm run repository -- --apply --plan-hash HASH_DA_PREVIA
npm run deploy
npm run deploy -- --apply --plan-hash HASH_DA_PREVIA
```

Cada executor é `dry-run` por padrão, valida a conta e os alvos exatos, congela o hash do plano, limita as mutações e faz releitura. `GITHUB_CLI_BIN` permite apontar para a instalação do `gh` quando ele não está no PATH. Upload com resultado incerto não é reenviado: confira o projeto e os recibos em `.runtime/` primeiro.

O publicador de produção é `scripts/lp.mjs`, com preparação em `scripts/lp-artifact.mjs`. Os assets usam `/influenciadoras-assets/<commit>/`; home, robots, CSS e scripts das outras páginas não são substituídos. A API oficial entrega o mapa nativo completo do deployment atual; o executor preserva todos os arquivos fora do próprio escopo e acrescenta somente os seus arquivos. Cabeçalhos e redirects existentes precisam de recibo verificado do deployment exato (`JM_LP_BASELINE_FILE`), com hashes, textos `headers`/`redirects` e checks conhecidos. Não use um build antigo do site inteiro como base.

`npm run deploy` faz dry-run; apply exige o hash. Uma trava (`JM_LP_PUBLICATION_LOCK_FILE`, ou a trava local por padrão) protege a operação e o projeto é relido depois do upload dos assets, imediatamente antes da única criação de deployment. Alteração concorrente interrompe o apply e exige uma nova mesclagem. Depois da criação, relê o mapa completo e os bytes publicados, confere páginas anteriores e redirects, e conserva o ID anterior. Uma resposta incerta exige `npm run verify:lp`, read-only, sem repetir upload ou criação. Para eventual rollback, só restaure o deployment anterior se a versão canônica ainda for exatamente esta publicação; preserve uma publicação concorrente posterior.

No workspace de operações, `npm run influenciadoras:publish:lp` resolve o recibo atual dos controles, reutiliza a credencial Pages do cliente em memória e usa a trava compartilhada `.agents/runtime/jm-lp-shared-publication.lock`. Apply usa `-- --apply --plan-hash HASH`; releitura usa `-- --verify`. Uma versão desconhecida dos controles interrompe a execução. Outros publicadores do `jm-lp` também devem preservar o mapa canônico e respeitar a trava; um full upload sem mesclagem pode apagar rotas concorrentes.

Para um preview independente, `npm run deploy:preview` usa `scripts/deploy.mjs` e o projeto próprio `paginas-influenciadoras`, com dry-run/apply por hash. Esse upload não publica as rotas finais no `lp`.

Para o preview independente, `npm run verify:published` relê o deployment e seus hashes usando `.runtime/current-deployment.json`. Para as URLs finais, use `npm run verify:lp` e o recibo `.runtime/lp-current.json`. Ambos são read-only e não criam outra versão.

## Validação no celular

Conferir primeiro320/390/412px, depois768/1440px: fontes, imagens, ausência de rolagem horizontal, botões de oferta, foco, navegação por teclado e swipe/setas do carrossel. Em QA, bloquear destinos externos para não emitir analytics nem abrir a loja. `npm run build` valida referências locais, preços, estado comercial, canonical e budgets de HTML/JS/artefato. O arquivo público `release-manifest.json` identifica hashes e commit, sem credenciais.

## Origem

Material fornecido pela J&M em26/11/2026: `entrega-TI_combos-cassia-e-forja_2026-11-26.zip`. O hash e as revisões estão em `config/source-manifest.json`. A versão inicial preservou copy, artes e seções; a revisão autorizada da Forja retirou dois livros indisponíveis, recalculou os valores e recompôs as artes com oito capas. CSS e runtime são compartilhados, fontes/imagens são locais e as imagens têm dimensões intrínsecas. A fonte incremental legada do ZIP não é executada pelo projeto Astro.

Documentação oficial: [Astro](https://docs.astro.build/en/guides/deploy/cloudflare/), [Cloudflare Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/).
