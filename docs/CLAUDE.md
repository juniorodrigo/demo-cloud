# CLAUDE.md — Contexto de despliegue

Este repo contiene una app web ya construida. Tu tarea (Claude Code) es **contenerizarla y montar su CI/CD** para desplegarla en una VM pequeña detrás de Caddy y Cloudflare. Adáptate al código real de este repo (detecta el entrypoint, el puerto, el gestor de paquetes y si usa Prisma u otro ORM).

## Arquitectura objetivo

```
git push → GitHub Actions (build amd64 → ghcr.io) → SSH a la VM → docker compose pull && up -d
Caddy (contenedor aparte, red "web") → reverse_proxy mural:3000
Cloudflare (modo Flexible) pone el HTTPS; la VM solo expone HTTP en el puerto 80 vía Caddy.
Base de datos: NeonDB (Postgres gestionado, externo).
```

## Restricciones (importan)

- **VM micro de Oracle: 1 OCPU / 1 GB RAM, arquitectura amd64.** No se compila en la VM: el build ocurre en GitHub Actions y la VM solo ejecuta la imagen.
- **Sin PM2.** Docker supervisa el proceso (`restart: unless-stopped`). El contenedor arranca el server con `node` directamente.
- La app debe escuchar en `process.env.PORT` (default **3000**) y hacer **bind a `0.0.0.0`** (no `localhost`).
- Debe existir un endpoint de salud `GET /health` que responda 200 (si no existe, créalo).
- **Base de datos (si usa Prisma):** conexión por `DATABASE_URL` (pooled, host `-pooler` de Neon) y `directUrl` = `DIRECT_URL` (directa) para migraciones. `prisma` y `@prisma/client` deben estar en `dependencies` (no en devDependencies). Migraciones con `prisma migrate deploy` al arrancar el contenedor.
- **Sin secretos en el repo.** Usa variables de entorno; genera `.env.example`.
- Zona horaria de los contenedores: `TZ=America/Lima`.

## Archivos a crear

1. **`Dockerfile`** (en la raíz):
   - Base `node:24-alpine`; `apk add --no-cache tzdata`; `ENV NODE_ENV=production PORT=3000 TZ=America/Lima`.
   - `npm ci --omit=dev`; si usa Prisma: `npx prisma generate`.
   - `EXPOSE 3000`.
   - `CMD` que (si usa Prisma) corra `npx prisma migrate deploy && node <entrypoint>`; si no, solo `node <entrypoint>`.
   - Usa el **entrypoint real** detectado en el repo (no asumas `src/server.js`).

2. **`.dockerignore`**: `node_modules`, `.env`, `.git`, `*.log`, `Dockerfile`, `docker-compose.yml`.

3. **`.github/workflows/deploy.yml`**:
   - Trigger `push` a `main`.
   - Job `build`: login a `ghcr.io` con `GITHUB_TOKEN` (permiso `packages: write`), `docker/build-push-action` con `platforms: linux/amd64`, tag `ghcr.io/${{ github.repository_owner }}/mural:latest`.
   - Job `deploy` (needs build): `appleboy/ssh-action` que entra a la VM y corre `cd ~/mural && docker compose pull && docker compose up -d && docker image prune -f`.
   - Secrets usados: `VM_HOST`, `VM_USER`, `VM_SSH_KEY`.

4. **`docker-compose.yml`** (para la VM, en `~/mural`):
   - Servicio `mural` con `container_name: mural`, `image: ghcr.io/<owner>/mural:latest`, `restart: unless-stopped`, `env_file: .env`, `environment: [TZ=America/Lima]`, `expose: ["3000"]` (sin publicar puertos), `networks: [web]`.
   - `networks: { web: { external: true } }`.

5. **`.env.example`**: `DATABASE_URL`, `DIRECT_URL`, `NODE_ENV`, `PORT` (y cualquier otra var que el código requiera).

6. Sección en el **`README.md`** con: build local, cómo probar, y el flujo de deploy.

## Cómo proceder

1. Inspecciona el repo: framework, gestor de paquetes, script de arranque, puerto, ORM.
2. Si el entrypoint o el puerto difieren de los supuestos, **úsalos** y dímelo.
3. Verifica que las dependencias necesarias en runtime estén en `dependencies` (sobre todo `prisma`/`@prisma/client`).
4. Genera los archivos. Al terminar, lista qué cambiaste y cómo probar en local y desplegar.
