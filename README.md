# Gestor de Loterias

Gestão financeira para lotéricas: controle de receitas, despesas, categorias, relatórios, importação de planilhas e leitura de comprovantes por foto.

App local, sem login — pensado para rodar no seu próprio servidor (NAS, ZimaOS, Raspberry Pi, etc.), acessado pela sua rede ou por uma VPN como Tailscale.

## Rodando com Docker (recomendado)

```bash
cp .env.example .env
docker compose up -d
```

Acesse em `http://localhost:3000`. Os dados (Postgres e fotos de comprovante) ficam em volumes Docker nomeados, sobrevivem a `docker compose down` (sem `-v`) e a atualizações de imagem.

Também publicado no Docker Hub como [`guslma/gestor-de-loterias`](https://hub.docker.com/r/guslma/gestor-de-loterias) — veja [docker-compose.prod.yml](docker-compose.prod.yml) para produção genérica ou [deploy/README.md](deploy/README.md) para instalação em servidores ZimaOS/CasaOS.

## Desenvolvimento

```bash
# backend
cd backend && npm install && npm run dev

# frontend (outro terminal)
cd frontend && npm install && npm run dev
```

O backend aplica as migrations do Postgres automaticamente no boot.

## Stack

React + TypeScript + Vite + Tailwind (frontend) · Express + TypeScript (backend) · PostgreSQL via `pg`, sem ORM. Veja [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Estrutura

- `frontend/` — SPA (Vite + React + Tailwind), PWA
- `backend/` — API Express, migrations SQL aplicadas no boot
- `database/migrations/` — schema do Postgres (SQL puro)
- `scripts/` — ferramentas avulsas (ex.: migração de dados de uma instalação SQLite antiga)
- `assets/` — arquivos-fonte de design (ícones)
- `docs/` — notas de arquitetura
- `deploy/` — compose oficial para instalação via imagem do Docker Hub (ZimaOS/CasaOS)
