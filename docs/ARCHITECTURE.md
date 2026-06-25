# Arquitetura

Monorepo com frontend e backend separados, comunicando via HTTP/JSON.

- **Frontend** (`frontend/`): React + TypeScript + Vite + Tailwind, SPA com
  `react-router-dom`. PWA via `vite-plugin-pwa`, com `/api/*` e `/uploads/*`
  explicitamente fora do cache (`NetworkOnly` + `navigateFallbackDenylist`) —
  dados financeiros nunca são servidos do cache do service worker.
- **Backend** (`backend/`): Express + TypeScript, validação de payload com
  zod. Serve a API em `/api/*` e, em produção, também os arquivos estáticos
  buildados do frontend (`frontend/dist`) — um único container/processo, sem
  precisar de nginx.
- **Dados**: PostgreSQL acessado via `pg` (node-postgres), sem ORM. Migrations
  são arquivos `.sql` simples em `database/migrations/`, aplicadas
  automaticamente no boot do backend (`backend/src/migrate.ts`), controladas
  por uma tabela `_migrations`.
- **Sem autenticação**: app pensado para uso local/VPN (ver
  `deploy/README.md` sobre acesso remoto seguro).
- **Import de planilhas**: parser de balanço anual em
  `backend/src/lib/import-balanco.ts`, exposto via `POST /api/import`
  (`?dryRun=true` para pré-visualizar antes de gravar).
- **Migração de dados legados**: `scripts/migrate-sqlite.ts` (rodado do host,
  fora do container) migra uma instalação antiga em SQLite para o Postgres
  atual, preservando IDs e validando contagens/somas no final.
- **Deploy**:
  - `Dockerfile` + `docker-compose.yml` na raiz — build local, 2 containers
    (app + postgres).
  - `docker-compose.prod.yml` — produção genérica, usa a imagem publicada no
    Docker Hub em vez de buildar localmente.
  - `deploy/` — formato específico para instalação oficial no ZimaOS/CasaOS
    (bind mounts em `/DATA/AppData/...`, metadados `x-casaos`). Ver
    `deploy/README.md`.
