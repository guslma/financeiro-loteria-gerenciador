# Instalação no ZimaOS / CasaOS

Guia passo a passo para instalar o **Gestor de Loterias** no ZimaOS (ou CasaOS)
e depois atualizar sem perder nenhum dado.

---

## Primeira instalação

### 1. Escolha como instalar

**Pela interface (mais fácil):**
Abra o painel do ZimaOS → **App Store** → **Instalar app personalizado**.

**Pelo terminal (SSH):**
```bash
casaos-cli app-management install -f deploy/docker-compose.yml
```

### 2. Antes de clicar em "Instalar", edite as variáveis

No momento de instalar, o ZimaOS mostra o conteúdo do `docker-compose.yml`.
Você **precisa** trocar estes valores:

| Variável | O que colocar |
|---|---|
| `APP_USERNAME` | Seu usuário de login (ex: `admin`) |
| `APP_PASSWORD` | **Sua senha** — use uma senha forte! |
| `APP_JWT_SECRET` | Uma chave secreta aleatória. Gere uma com: `openssl rand -base64 32` |
| `SESSION_VERSION` | Deixe como `1`. Se algum dia quiser invalidar todas as sessões, incremente para `2` |
| `STORAGE_ENCRYPTION_KEY` | Chave para criptografar fotos de comprovante em disco. Gere com: `openssl rand -base64 32` |
| `SENHA_FORTE_AQUI` (na `DATABASE_URL` e no `POSTGRES_PASSWORD`) | A senha do banco de dados (pode ser qualquer senha forte) |

> ⚠️ **Importante:** Se não trocar essas senhas, qualquer pessoa que acessar
> seu servidor poderá ver seus dados financeiros.

### 3. Permissão da pasta do Postgres (obrigatório na primeira vez)

O ZimaOS precisa de uma permissão especial na pasta onde o banco de dados
guarda as informações. Conecte-se via **SSH** no servidor e rode:

```bash
mkdir -p /DATA/AppData/gestor-de-loterias/postgres
mkdir -p /DATA/AppData/gestor-de-loterias/uploads
mkdir -p /DATA/AppData/gestor-de-loterias/ocr-models
chown -R 70:70 /DATA/AppData/gestor-de-loterias/postgres
```

> Sem esse `chown`, o banco de dados não consegue iniciar e o app fica
> reiniciando sem parar. O número `70` é o ID do usuário `postgres` dentro
> do container — é assim que o Postgres espera encontrar a pasta.

### 4. Instale o app

Depois de editar as variáveis e rodar o comando acima, conclua a instalação
pela interface ou terminal. O app estará disponível em:

```
http://<ip-do-seu-zimaos>:3000
```

> Se você instalou pela interface do ZimaOS, ele já abre sozinho quando
> você clica no ícone do app.

### 5. Faça login

Use o `APP_USERNAME` e `APP_PASSWORD` que você definiu no passo 2.

---

## Atualizar para uma versão nova (sem perder nada)

Seus dados (transações, categorias, comprovantes salvos) ficam em pastas
especiais fora do container — elas **não são apagadas** quando você atualiza.

### Pela interface do ZimaOS

1. Vá no painel do ZimaOS → Apps → **Gestor de Loterias**
2. Clique em **Atualizar** (ícone de seta circular)
3. O ZimaOS baixa a imagem nova e recria o container mantendo seus dados

### Pelo terminal

```bash
# Dentro da pasta onde está o docker-compose.yml
docker compose pull
docker compose up -d
```

> ⚠️ **Atenção:** Se você instalou antes de existir o sistema de login
> (versões muito antigas), seu app pode não ter as variáveis
> `APP_USERNAME`, `APP_PASSWORD` e `APP_JWT_SECRET`. Antes de atualizar,
> entre no app pelo ZimaOS, vá em **Configurações do app** → variáveis de
> ambiente, e adicione essas três. Senão o container não sobe depois da
> atualização.

> ⚠️ **Sessões serão resetadas:** Esta versão inclui um sistema de versão
> de token (`SESSION_VERSION`). Ao atualizar, **todas as sessões existentes
> expiram** — você e qualquer outro usuário precisarão fazer login novamente.
> É de propósito (e acontece só uma vez).

---

## Migração de fotos antigas (criptografia)

A partir da versão com criptografia, toda foto nova de comprovante é
comprimida para WebP, vira uma thumbnail e é criptografada com AES-256-GCM
antes de salvar no disco.

### Fotos já existentes

**Não precisa fazer nada.** Na primeira vez que o container subir com a
nova versão, ele automaticamente:

1. Varre a pasta `uploads/` procurando fotos antigas (`.jpg/.png`)
2. Comprime, gera thumbnail e criptografa cada uma
3. Só loga se encontrou algo — se não tiver fotos antigas, passa reto
4. É seguro rodar várias vezes (arquivos já migrados são ignorados)

Isso tudo acontece em segundo plano, antes do app começar a responder.
Dependendo da quantidade de fotos, pode levar alguns segundos na primeira
inicialização — depois disso é instantâneo.

### E se eu trocar a chave de criptografia?

Se você alterar `STORAGE_ENCRYPTION_KEY` (ou `APP_JWT_SECRET`, que é usado
como fallback), as fotos criptografadas com a chave antiga ficam
**inacessíveis** — o app não consegue mais descriptografá-las.

Para evitar isso, mantenha a `STORAGE_ENCRYPTION_KEY` fixa. Se precisar
trocá-la, as fotos antigas precisarão ser migradas manualmente (pelo script
`migrate-uploads.ts`) com a chave anterior.

---

## Onde ficam os dados

Tudo fica em `/DATA/AppData/gestor-de-loterias/`:

| Pasta | O que tem |
|---|---|
| `postgres/` | Banco de dados completo (transações, categorias, etc.) |
| `uploads/` | Fotos de comprovantes que você tirou |
| `ocr-models/` | Modelos de reconhecimento de texto (baixados na primeira vez) |

> **Apagar essas pastas = perder tudo permanentemente.** Faça backup
> copiando a pasta `postgres/` de vez em quando.

---

## Acesso remoto (fora de casa)

O app tem login com senha, mas **não tem HTTPS** próprio — sua senha viaja
em texto puro pela internet se você expor a porta 3000 diretamente.

Opções seguras para acessar de fora:

1. **VPN** (recomendado) — Instale [Tailscale](https://tailscale.com) no
   ZimaOS e rode `tailscale serve 3000` — ele já dá HTTPS automático.
2. **Reverse proxy** — Use Nginx ou Caddy com Let's Encrypt na frente do app.

---

## Ícone no painel do ZimaOS

O ícone do app é carregado automaticamente da internet — você não precisa
fazer nada. Se quiser usar um ícone personalizado, edite a linha `icon:` no
`docker-compose.yml`.

---

## Solução de problemas

| Problema | Causa mais comum | O que fazer |
|---|---|---|
| App reinicia sem parar | Permissão da pasta do Postgres | Rode o `chown -R 70:70` do passo 3 |
| Tela de login não aparece | Variáveis de ambiente não configuradas | Edite o app no ZimaOS e adicione `APP_USERNAME`, `APP_PASSWORD`, `APP_JWT_SECRET` |
| OCR não funciona | Servidor Ollama desligado ou IP errado | Verifique se o Ollama está rodando e ajuste `OLLAMA_URL` |
| "Muitas tentativas de login" | Errou a senha 5 vezes em 1 minuto | Espere 1 minuto e tente novamente |
| Fotos de comprovante não carregam | Chave de criptografia foi alterada | Se trocou `STORAGE_ENCRYPTION_KEY` ou `APP_JWT_SECRET`, as fotos antigas não podem ser descriptografadas. Restaure a chave anterior |
| Erro ao fazer upload de foto | Imagem muito grande ou formato não suportado | O app aceita JPEG, PNG e WebP até 10MB. Tire a foto numa resolução normal do celular |

---

> Dúvidas? Abra uma issue em
> [github.com/guslma/financeiro-loteria-gerenciador](https://github.com/guslma/financeiro-loteria-gerenciador)
