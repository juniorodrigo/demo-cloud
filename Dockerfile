# Imagen ligera, multi-arch (amd64 + arm64). Sin bundler => sin OOM al buildear.
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production PORT=3000

# Instala solo dependencias de producción (incluye prisma y @prisma/client).
COPY package*.json ./
RUN npm ci --omit=dev

# Genera el cliente de Prisma (paso de "build" ligero).
COPY prisma ./prisma
RUN npx prisma generate

# Código de la app.
COPY src ./src
COPY public ./public

EXPOSE 3000

# Las migraciones se aplican EN RUNTIME (no en build), usando DIRECT_URL.
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
