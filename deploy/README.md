# Deploy oficial (ZimaOS / CasaOS)

Este `docker-compose.yml` usa a imagem já publicada em
[`seugu/gestor-de-loterias`](https://hub.docker.com/r/seugu/gestor-de-loterias)
(amd64 e arm64) em vez de buildar localmente — é o formato que o CasaOS/ZimaOS
espera para instalar como app oficial (ícone, nome e descrição na interface).

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

Banco SQLite e fotos de comprovante ficam em volumes Docker nomeados (`db` e
`uploads`) — sobrevivem a `docker compose down` (sem `-v`) e a atualizações de
imagem. Apagar esses volumes apaga os dados permanentemente.

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
