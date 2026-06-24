# Gestor de Loterias

Gestão financeira para lotéricas: controle de receitas, despesas, categorias, relatórios, importação de planilhas e leitura de comprovantes por foto.

App local, sem login — pensado para rodar no seu próprio servidor (NAS, ZimaOS, Raspberry Pi, etc.), acessado pela sua rede ou por uma VPN como Tailscale.

## Rodando com Docker (recomendado)

```bash
docker compose up -d
```

Acesse em `http://localhost:3000`. Os dados (banco SQLite e fotos de comprovante) ficam em volumes Docker nomeados, sobrevivem a `docker compose down` (sem `-v`) e a atualizações de imagem.

Também publicado no Docker Hub como [`seugu/gestor-de-loterias`](https://hub.docker.com/r/seugu/gestor-de-loterias) — veja [deploy/README.md](deploy/README.md) para instalação em servidores ZimaOS/CasaOS.

## Desenvolvimento

```bash
npm install
npx prisma migrate dev
npm run dev
```

## Stack

Next.js 15 (App Router) + React 19 + TypeScript + Tailwind + Prisma/SQLite. Veja [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Estrutura

- `app/` — páginas e rotas de API (Next.js App Router)
- `components/`, `hooks/`, `lib/` — UI e utilitários compartilhados
- `prisma/` — schema e migrations do banco
- `docs/` — notas de arquitetura
- `deploy/` — compose oficial para instalação via imagem do Docker Hub (ZimaOS/CasaOS)
