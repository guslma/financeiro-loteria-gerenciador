# Gestor de Loterias

Gestão financeira para lotéricas: controle de receitas, despesas, categorias, relatórios, importação de planilhas e leitura de comprovantes por foto.

Pensado para rodar no seu próprio servidor (NAS, ZimaOS, Raspberry Pi, etc.), com login simples por usuário/senha — dá pra acessar pela rede local, por VPN (Tailscale) ou exposto direto na internet.

## Rodando com Docker (recomendado)

```bash
cp .env.example .env
docker compose up -d
```

Acesse em `http://localhost:3000`. Os dados (Postgres e fotos de comprovante) ficam em volumes Docker nomeados, sobrevivem a `docker compose down` (sem `-v`) e a atualizações de imagem.

Por padrão isso baixa a imagem publicada no GitHub como [`ghcr.io/guslma/gestor-de-loterias`](https://github.com/guslma/gestor-de-loterias/pkgs/container/gestor-de-loterias), que funciona em computadores comuns (amd64) e em ARM de 64 bits, como o Raspberry Pi. A imagem é gerada sozinha a cada atualização do `main`. Pra buildar a partir do código local em vez de baixar, use `docker compose up -d --build`. Veja [deploy/README.md](deploy/README.md) para instalação em servidores ZimaOS/CasaOS.

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
- `deploy/` — compose oficial para instalação via imagem do GitHub (ZimaOS/CasaOS), com atualização automática

## Licença

[MIT](LICENSE)
