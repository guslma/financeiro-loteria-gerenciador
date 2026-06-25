# Gestor de Loterias

Gestão financeira para lotéricas: controle de receitas, despesas, categorias, relatórios, importação de planilhas e leitura de comprovantes por foto.

App local, sem login — pensado para rodar no seu próprio servidor (NAS, ZimaOS, Raspberry Pi, etc.), acessado pela sua rede ou por uma VPN como Tailscale.

## Rodando com Docker (recomendado)

```bash
cp .env.example .env
docker compose up -d
```

Acesse em `http://localhost:3000`. Os dados (Postgres e fotos de comprovante) ficam em volumes Docker nomeados, sobrevivem a `docker compose down` (sem `-v`) e a atualizações de imagem.

Por padrão isso baixa a imagem publicada no Docker Hub como [`guslma/gestor-de-loterias`](https://hub.docker.com/r/guslma/gestor-de-loterias). Pra buildar a partir do código local em vez de baixar do Hub, use `docker compose up -d --build`. Veja [deploy/README.md](deploy/README.md) para instalação em servidores ZimaOS/CasaOS.

## Desenvolvimento

```bash
docker compose -f docker-compose.dev.yml up -d
```

- Frontend: http://localhost:5173
- Backend (API): http://localhost:3000/api
- Banco de dados: `localhost:5434` (`gestor` / `gestor` / `gestor`)

Os containers de `frontend` e `backend` ficam com hot-reload ativado via
volume (Vite e `tsx watch`, ambos com polling habilitado para detectar
mudanças no bind mount). O backend aplica as migrations do Postgres
automaticamente no boot.

Depois de mudar dependências (`package.json`), rebuilde as imagens:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

## Stack

React + TypeScript + Vite + Tailwind (frontend) · Express + TypeScript (backend) · PostgreSQL via `pg`, sem ORM. Veja [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Estrutura

- `frontend/` — SPA (Vite + React + Tailwind), PWA
- `backend/` — API Express, migrations SQL aplicadas no boot
- `database/migrations/` — schema do Postgres (SQL puro)
- `assets/` — arquivos-fonte de design (ícones)
- `docs/` — notas de arquitetura
- `deploy/` — compose oficial para instalação via imagem do Docker Hub (ZimaOS/CasaOS)

## Licença

[MIT](LICENSE)
