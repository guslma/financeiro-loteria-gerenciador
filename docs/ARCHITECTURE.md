# Arquitetura

Next.js 15 (App Router) full-stack: páginas e rotas de API (`app/api/*`) vivem no mesmo projeto, sem backend separado.

- **UI**: `app/` (páginas) + `components/`
- **API**: `app/api/*` (Next.js Route Handlers), validação de payload com zod
- **Dados**: SQLite via Prisma (`prisma/schema.prisma`), client em `lib/prisma.ts`
- **Auth**: sessão por cookie JWT assinado (`lib/auth.ts` + `middleware.ts`), sem dependência de banco no middleware
- **Scripts operacionais**: `scripts/`
- **Deploy**: `deploy/` (Dockerfile/compose, ver `deploy/README.md`)
