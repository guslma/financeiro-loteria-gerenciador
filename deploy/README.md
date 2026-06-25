# Deploy oficial (ZimaOS / CasaOS)

Este `docker-compose.yml` usa a imagem já publicada em
[`guslma/gestor-de-loterias`](https://hub.docker.com/r/guslma/gestor-de-loterias)
(amd64 e arm64) em vez de buildar localmente — é o formato que o CasaOS/ZimaOS
espera para instalar como app oficial (ícone, nome e descrição na interface).

## Antes do primeiro `docker compose up -d` (importante)

Os dados ficam em bind mounts em `/DATA/AppData/gestor-de-loterias/`, seguindo
o mesmo padrão de outros apps do ZimaOS (ex.: `ownfoil`). Crie as pastas e
ajuste a permissão da pasta do Postgres **antes** de subir a stack pela
primeira vez:

```bash
mkdir -p /DATA/AppData/gestor-de-loterias/postgres
mkdir -p /DATA/AppData/gestor-de-loterias/uploads
chown -R 70:70 /DATA/AppData/gestor-de-loterias/postgres
```

O uid/gid 70 é o usuário `postgres` dentro da imagem `postgres:16-alpine`
(confirmado com `docker run --rm postgres:16-alpine id postgres` — não é 999,
como em imagens Debian-based). Sem esse `chown`, o container do Postgres entra
em crash loop por falta de permissão na pasta de dados.

## Instalar no ZimaOS

Via interface: App Store → "Instalar app personalizado" → cole o conteúdo de
`deploy/docker-compose.yml`.

Via terminal (SSH no servidor):

```bash
casaos-cli app-management install -f deploy/docker-compose.yml
```

## Instalar em qualquer Docker (sem CasaOS)

```bash
cd deploy
docker compose up -d
```

Acesse em `http://<ip-do-servidor>:3000`.

## Dados

Banco Postgres e fotos de comprovante ficam em bind mounts em
`/DATA/AppData/gestor-de-loterias/{postgres,uploads}` — sobrevivem a
`docker compose down` e a atualizações de imagem, e ficam visíveis/gerenciáveis
direto pelo gerenciador de arquivos do ZimaOS. Apagar essas pastas apaga os
dados permanentemente.

## Ícone no painel do CasaOS

O label `icon:` hoje aponta para `http://localhost:3000/...`, que só resolve
para quem está navegando a partir do próprio ZimaOS — em outro dispositivo da
rede o ícone não aparece. Isso é uma pendência conhecida: a correção definitiva
é hospedar os ícones num repositório GitHub público e apontar para uma URL
jsdelivr fixada por tag (ex.:
`https://cdn.jsdelivr.net/gh/<usuario>/<repo>@v1.0.0/frontend/public/icon-512x512.png`),
ainda não configurada.

## Acesso remoto (fora da rede local)

O container só escuta em `0.0.0.0:3000`, sem TLS próprio e sem login — não
exponha a porta diretamente para a internet. Para acesso remoto seguro, use
uma VPN como [Tailscale](https://tailscale.com) (ex.: `tailscale serve 3000`
no host, que dá HTTPS automático dentro da sua rede privada) ou um reverse
proxy com TLS (Nginx/Caddy + Let's Encrypt) se preferir um domínio público.

## Atualizando para uma nova versão da imagem

```bash
docker compose pull
docker compose up -d
```
