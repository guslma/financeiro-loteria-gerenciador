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
mkdir -p /DATA/AppData/gestor-de-loterias/ocr-models
chown -R 70:70 /DATA/AppData/gestor-de-loterias/postgres
```

O uid/gid 70 é o usuário `postgres` dentro da imagem `postgres:16-alpine`
(confirmado com `docker run --rm postgres:16-alpine id postgres` — não é 999,
como em imagens Debian-based). Sem esse `chown`, o container do Postgres entra
em crash loop por falta de permissão na pasta de dados.

## Login

O app exige usuário/senha (`APP_USERNAME`/`APP_PASSWORD` no compose) e uma
chave de sessão (`APP_JWT_SECRET`). Sem essas três variáveis definidas o
container não sobe — ele falha rápido no boot em vez de subir sem proteção.
Troque os valores de exemplo do `docker-compose.yml` antes de instalar.

Se você já gerou um `deploy/docker-compose.local.yml` (cópia local com os
segredos reais, fora do git/Docker Hub), use o conteúdo dele em vez do
`docker-compose.yml` nos passos abaixo.

## Instalar no ZimaOS

Via interface: App Store → "Instalar app personalizado" → cole o conteúdo de
`deploy/docker-compose.yml` (com `APP_USERNAME`/`APP_PASSWORD`/`APP_JWT_SECRET`
já trocados pelos seus valores).

**Atenção (serviço `ocr`):** esse serviço builda a imagem a partir de
`../services/ocr`, então só funciona quando o compose roda a partir de um
clone do repositório (ex.: o método "Instalar em qualquer Docker" abaixo).
Colar o YAML direto no App Store do CasaOS **não** dá acesso a esse código
fonte, então o serviço `ocr` vai falhar nesse fluxo até existir uma imagem
publicada (`guslma/gestor-de-loterias-ocr` ou similar) pra referenciar em vez
de `build:`.

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

O label `icon:` aponta para o ícone hospedado via jsDelivr direto do
repositório público, fixado na tag `v1.0.0`:
`https://cdn.jsdelivr.net/gh/guslma/financeiro-loteria-gerenciador@v1.0.0/frontend/public/icon-512x512.png`.
Resolve de qualquer dispositivo da rede, não só do próprio ZimaOS.

Ao lançar uma nova versão com ícone diferente, crie uma tag nova (`git tag
vX.Y.Z && git push origin vX.Y.Z`) e atualize a versão na URL — tags antigas
continuam servindo o ícone antigo, então o link não quebra para quem ainda não
atualizou.

## Acesso remoto (fora da rede local)

O app tem login por usuário/senha, mas o container ainda escuta em
`0.0.0.0:3000` sem TLS próprio — sem HTTPS, a senha viaja em texto claro pela
rede até chegar no servidor. Pra expor na internet, coloque na frente um
reverse proxy com TLS (Nginx/Caddy + Let's Encrypt) ou use uma VPN como
[Tailscale](https://tailscale.com) (ex.: `tailscale serve 3000` no host, que
dá HTTPS automático).

## Atualizando para uma nova versão da imagem (sem perder dados)

Os dados (Postgres e uploads) ficam em bind mounts em `/DATA/AppData/...`,
fora dos containers — atualizar a imagem não toca nesses arquivos. Só não
apague essas pastas.

1. Garanta que o compose instalado no ZimaOS já tem `APP_USERNAME`,
   `APP_PASSWORD` e `APP_JWT_SECRET` definidos (apps instalados antes do login
   existir não têm essas variáveis — adicione-as editando o app pela interface
   do CasaOS, em "Configurações do app" → variáveis de ambiente, **antes** de
   atualizar a imagem, senão o container entra em crash loop por faltar
   variável).
2. Atualize a imagem:

```bash
docker compose pull
docker compose up -d
```

Pela interface do CasaOS isso equivale ao botão "Atualizar" do app — ele
recria o container preservando os bind mounts.
