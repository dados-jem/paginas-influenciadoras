# Páginas das influenciadoras — João & Maria

Páginas estáticas em **Astro**, versionadas neste repositório público e publicadas no **Cloudflare Pages**. O domínio é sempre `https://lp.joaoemariaeditora.com.br/`: cada campanha recebe sua própria slug. Produção usa o projeto compartilhado `jm-lp`; o projeto `paginas-influenciadoras` serve apenas para previews independentes.

## Começar com um agente

Compartilhe [o link deste repositório](https://github.com/dados-jem/paginas-influenciadoras) e peça:

> Leia AGENTS.md e a skill do projeto. Execute o preparo automático para este computador, conduza os logins individuais necessários e valide o ambiente. Depois crie ou edite a página solicitada, preservando as outras rotas do LP.

A [skill versionada](.agents/skills/jm-influencer-pages/SKILL.md) acompanha o clone. Codex pode descobri-la em `.agents/skills/`; outros agentes podem ler o arquivo diretamente. O link permite ler o material público. Para enviar alterações e publicar, cada pessoa autentica a própria conta no GitHub e Cloudflare. O link não instala ferramentas nem concede acesso à conta.

As instruções tratam do processo técnico e valem igualmente para qualquer colaborador. Não há funções pessoais ou aprovação obrigatória de outra pessoa no fluxo do repositório.

## Preparo automático

O iniciador instala ferramentas portáteis **dentro do projeto**, usa as versões do lockfile e executa dependências, testes e build. Ele traz Node.js24, Git e GitHub CLI; Astro, Wrangler e demais dependências vêm do lockfile npm. Não precisa de Node/Git/gh instalados globalmente, privilégios de administrador ou alteração permanente do PATH.

No macOS/Linux, o agente executa:

```sh
sh iniciar.sh --apply --login
```

No Windows64bits, com PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\iniciar.ps1 -Apply -Login
```

Sem apply, os iniciadores mostram uma prévia sem downloads. A flag de PowerShell vale somente para esse processo; não muda a política permanente da máquina. Windows ARM pode usar o pacote x64 pela compatibilidade do sistema; as dependências estão travadas para win-64. macOS Intel/Apple Silicon e Linux x64/ARM64 têm ambientes próprios.

O agente pode clonar o repositório ou baixar seu ZIP completo. Se ainda não houver Git, o iniciador o prepara e confere todos os arquivos do ZIP com o GitHub antes de inicializar o histórico, sem sobrescrever conteúdo. Uma versão divergente é interrompida para conciliação.

**Na primeira vez, cada pessoa conclui os logins do GitHub e Cloudflare e aceita os convites.** O resto do preparo é automatizado. O Cloudflare usa OAuth com perfil próprio deste projeto e permissões Pages, sem pedir para copiar token manualmente. A credencial fica no armazenamento privado do Wrangler e é renovada pelo próprio CLI; nunca entra no repositório, no relatório ou em logs. Quem já fornece um token Pages privado pode continuar usando-o.

Depois, todos os comandos podem ser usados pelo lançador local, que ativa o ambiente correto e entrega a autenticação ao publicador apenas em memória:

```sh
./jm doctor --online
./jm dev
./jm test
./jm build
./jm page:create --file examples/new-page.json
./jm repository
./jm deploy
./jm publication:record
./jm verify:lp
```

No Windows, troque `./jm` por `.\jm.ps1`. Publicações e escritas mantêm dry-run/apply por hash. `doctor --online` verifica os acessos sem criar deployment; `login` retoma autenticação quando necessária. Rodar o preparo de novo conserva o ambiente que já foi conferido e repete os checks somente quando a fonte ou dependências mudaram.

Os comandos npm abaixo continuam equivalentes para ambientes já preparados. O agente deve usar o lançador para obter as ferramentas e os acessos automaticamente.

## Criar uma página

Copie `examples/new-page.json` para um brief próprio e informe slug, título, descrição, headline, introdução, imagem local e seções. Não copie preços, estoque, produtos ou depoimentos de outra campanha.

```sh
npm run page:create -- --file examples/new-page.json
npm run page:create -- --file examples/new-page.json --apply --plan-hash HASH_DA_PREVIA
```

O primeiro comando é **dry-run, offline**. O segundo cria somente o HTML da nova página e sua entrada em `src/content/pages.json`, com backup e releitura. Duplicatas, slugs reservadas e sobrescrita são recusadas. O rascunho nasce com `delivery: "local"`, `status: "draft"`, `pricing: null`, `productUrl: null` e `indexable: false`. Pode ser visto no servidor local, mas não entra na produção enquanto `delivery` continuar `local`.

Edite o conteúdo, valide a campanha real e escolha explicitamente `delivery: "production"` para incluir sua rota no próximo deployment. Para vender, cadastre ou confira o produto real, preencha `productUrl` e `pricing`, marque `pricing.verified: true` e `status: "published"`. O build impede uma venda sem destino oficial e preços conferidos. `status` controla compra/analytics; `delivery` controla publicação; `indexable` controla SEO. Não são o mesmo campo.

O template neutro tem três botões de oferta. As páginas originais preservam seus cinco botões e o layout existente. Não é necessário editar rotas Astro nem o publicador para acrescentar uma campanha ao registro.

## Editar e validar

- `src/content/pages.json`: metadados, publicação, preços e destino comercial.
- `src/content/<key>.html`: conteúdo de cada página, sem JavaScript ou handlers inline.
- `public/media/` e `public/fonts/`: imagens e fontes locais.
- `src/layouts/InfluencerLanding.astro`: layout, metadados e rastreamento compartilhados.
- `src/styles/campaign.css`: template neutro; `landing.css`: páginas originais.
- `src/scripts/landing.mjs`: carrossel e preservação de UTMs.

```sh
npm run skill:check
npm test
npm run build
```

Valide primeiro320/390/412px, depois768/1440px: sem rolagem horizontal, imagens legíveis com dimensões, CTA acessível ao toque, foco/teclado, links e carrossel quando existir. Em QA local, bloqueie analytics e destinos externos. O build confere referências, canonical, estado comercial e budgets de HTML, JavaScript e artefato. GTM e NEMU já pertencem ao layout e só ativam em páginas comerciais; não duplique tags. `noindex` permanece até uma decisão específica de SEO.

## Versionar e publicar

O repositório é **público por decisão do proprietário**. Nunca versionar `.env`, cookies, tokens, e-mails de acesso, relatórios privados ou dados de clientes. Contas colaboradoras precisam de permissão de escrita no repositório. No Cloudflare, use a conta J&M e o papel específico `Cloudflare Pages Admin`, sem compartilhar o login corporativo. Esse papel cobre os projetos Pages da conta; o executor limita a publicação deste fluxo ao `jm-lp`.

Autentique `gh auth login` na própria máquina. O fluxo automático usa `./jm login` e um perfil OAuth individual do Wrangler com leitura da conta e edição de Pages. Como alternativa, configure `CLOUDFLARE_ACCOUNT_ID` e `CLOUDFLARE_API_TOKEN` em ambiente privado. `.env.example` documenta os nomes; os comandos não importam segredos de outro computador. `GITHUB_CLI_BIN` permite selecionar o executável `gh` instalado.

```sh
git pull --ff-only origin main
# revise e adicione apenas os arquivos da alteração
git add CAMINHOS_REVISADOS
git commit -m "Adicionar página da campanha"
npm test
npm run build
npm run repository
npm run repository -- --apply --plan-hash HASH_DA_PREVIA
npm run deploy
npm run deploy -- --apply --plan-hash HASH_DA_PREVIA
npm run publication:record
npm run publication:record -- --apply --plan-hash HASH_DA_PREVIA
git add config/publication-receipts.json
git commit -m "Registrar publicação verificada"
npm run repository
npm run repository -- --apply --plan-hash HASH_DA_PREVIA
npm run verify:lp
```

Cada `apply` usa o hash do **comando de prévia imediatamente correspondente**. O build deve corresponder ao commit, com diretório limpo. O CI valida testes/build; um push sozinho não publica o LP. O commit final do recibo não exige outra publicação do site.

O publicador lê o manifesto nativo do deployment canônico, conserva arquivos/headers/redirects alheios e acrescenta as páginas registradas para produção. Assets são imutáveis em `/influenciadoras-assets/<commit>/`. Slug que colide com outro conteúdo é recusada. Não faça upload do site inteiro nem altere DNS ou domínio.

`config/publication-receipts.json` distribui somente hashes, caminhos e controles públicos verificados. Assim outro clone reconhece a versão publicada. Quando outro projeto alterar o `jm-lp`, importe o **recibo verificado daquele deployment exato** com `publication:record -- --file RECIBO`. Não invente os controles nem reutilize um recibo antigo. `JM_LP_BASELINE_FILE` aceita uma referência privada local equivalente; `JM_LP_PUBLICATION_LOCK_FILE` permite coordenar uma trava compartilhada na mesma máquina. Uma publicação concorrente interrompe a operação antes da criação e exige nova prévia.

Resultado incerto nunca autoriza repetir upload ou criação. Relacione o ID retornado com os recibos em `.runtime/` e faça releitura por `npm run verify:lp` (**read-only**, inclusive em um clone sem build). Uma versão desconhecida exige conciliação do recibo. Rollback só pode restaurar a versão anterior se o deployment canônico ainda for o deployment que se pretende reverter; preserve mudanças posteriores.

`npm run deploy:preview` usa o projeto independente `paginas-influenciadoras` com dry-run/apply por hash; não publica no domínio final. `npm run verify:published` relê esse preview. O workspace de operações também oferece `influenciadoras:publish:lp` e `influenciadoras:mirror` para integrar os recibos e conservar a fonte local compartilhada.

## Campanhas existentes

[Cássia Kawamura](https://lp.joaoemariaeditora.com.br/combo-da-cassia-kawamura/) tem dez livros. [Forja Diária](https://lp.joaoemariaeditora.com.br/combo-da-forja-diaria/) começa com oito, sem A Loja da Dona Miloca e Fábulas de Esopo para os Pitiquinhos. Não reintroduza os dois livros nem artes da composição antiga. A ampliação futura precisa atualizar cadastro comercial, composição, preços e imagens juntos.

`npm run assets` prepara a recomposição das quatro artes da Forja; `-- --apply --plan-hash HASH` grava os arquivos exatos e `-- --check` apenas confere fontes, composição e hashes. Não recria capas. As regras comerciais40% público/60% assinantes e os produtos existentes pertencem a essas campanhas; uma nova página começa sem herdá-los.

Origem: material J&M de26/11/2026 (`entrega-TI_combos-cassia-e-forja_2026-11-26.zip`), com manifesto em `config/source-manifest.json`. As seis páginas antigas em outra hospedagem permanecem fora desta entrega.

Referências: [Astro](https://docs.astro.build/en/guides/deploy/cloudflare/), [Cloudflare Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/).
