FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

FROM node:22-alpine AS runner
RUN apk add --no-cache su-exec
WORKDIR /app/backend
ENV NODE_ENV=production
ENV PORT=3000
ENV UPLOADS_DIR=/app/uploads

COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/package.json ./package.json
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
COPY database /app/database
COPY --chmod=755 gestor-entrypoint.sh /usr/local/bin/gestor-entrypoint.sh

EXPOSE 3000
# O entrypoint começa como root só para ajustar a pasta de uploads e então
# roda o app como o usuário "node" (sem privilégios).
ENTRYPOINT ["gestor-entrypoint.sh"]
CMD ["node", "dist/index.js"]
