# Gestor de Loterias

Gestão financeira para lotéricas: controle de receitas, despesas, categorias e relatórios.

## Stack

Next.js 15 (App Router) + React 19 + TypeScript + Tailwind + Prisma/SQLite. Veja [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Desenvolvimento

```bash
npm install
cp .env.example .env   # ajuste SESSION_SECRET, SEED_USERNAME, SEED_PASSWORD
npx prisma migrate dev
npm run db:seed         # cria o usuário inicial definido no .env
npm run dev
```

## Estrutura

- `app/` — páginas e rotas de API (Next.js App Router)
- `components/`, `hooks/`, `lib/` — UI e utilitários compartilhados
- `prisma/` — schema e migrations do banco
- `scripts/` — scripts operacionais (ex.: seed de usuário)
- `docs/` — notas de arquitetura
- `deploy/` — arquivos de deploy self-hosted (Fase 7, ainda não implementada)
