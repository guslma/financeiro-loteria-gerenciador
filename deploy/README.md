# Deploy

Roda o app em um servidor doméstico (ex.: ZimaOS) via Docker.

```bash
cd deploy
cp .env.example .env   # ajuste SESSION_SECRET, SEED_USERNAME, SEED_PASSWORD
docker compose up --build -d
```

Acesse em `http://<ip-do-servidor>:3000`.

Os dados (banco SQLite e fotos de comprovante) ficam em volumes Docker nomeados (`db` e `uploads`) — sobrevivem a `docker compose down` (sem `-v`) e a rebuilds da imagem. Apagar esses volumes apaga os dados permanentemente.

Acesso de fora de casa (internet) e HTTPS (necessário para o PWA ser instalável fora da rede local) ficam por sua conta — port-forward, Cloudflare Tunnel, Tailscale ou similar. O container só escuta em `0.0.0.0:3000`, sem TLS próprio.
