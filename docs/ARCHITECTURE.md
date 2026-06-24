# Arquitetura

Next.js 15 (App Router) full-stack: páginas e rotas de API (`app/api/*`) vivem no mesmo projeto, sem backend separado.

- **UI**: `app/` (páginas) + `components/`
- **API**: `app/api/*` (Next.js Route Handlers), validação de payload com zod
- **Dados**: SQLite via Prisma (`prisma/schema.prisma`), client em `lib/server/prisma.ts`
- **Sem autenticação**: app pensado para uso local/VPN (ver `deploy/README.md` sobre acesso remoto seguro)
- **Import de planilhas**: parser de balanço anual em `lib/server/import-balanco.ts`, exposto via `app/api/import` e `app/importar`
- **Deploy**: `Dockerfile` + `docker-compose.yml` na raiz (build local) e `deploy/` (imagem oficial do Docker Hub, ver `deploy/README.md`)
