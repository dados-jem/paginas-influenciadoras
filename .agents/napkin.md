# Runbook do repositório

## Publicação e colaboração

1. **[2026-11-26] O LP é compartilhado e o domínio é fixo**
   Do instead: usar `npm run deploy` com o manifesto canônico e recibo atual;
   preservar outros arquivos/redirects. Novas páginas mudam somente a slug.
2. **[2026-11-26] Skill acompanha o clone**
   Do instead: ler `AGENTS.md` e `.agents/skills/jm-influencer-pages/SKILL.md`.
   Não prometer instalação remota ou transferência de credenciais pelo link.
3. **[2026-11-26] Novas páginas começam locais e sem oferta inventada**
   Do instead: `npm run page:create -- --file BRIEF`, preview/hash, depois
   validar a oferta real e marcar explicitamente a entrega em produção.
4. **[2026-11-26] O próximo colaborador precisa do recibo publicado**
   Do instead: registrar e versionar `npm run publication:record` após o
   sucesso. Uma versão canônica desconhecida é conciliada, sem full upload.
