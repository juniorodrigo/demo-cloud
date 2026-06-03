# Proyecto de la demo — "Mural" (para construir con Claude Code)

> App full-stack mínima para desplegar con **Coolify** + **NeonDB (Prisma)**, optimizada para **no crashear al buildear en una VM de 1 GB de RAM**.
> Al final: **prompt listo para copiar y pegar** en Claude Code.

---

## Qué es

**Mural**: un muro público de mensajes (guestbook). Se escribe nombre + mensaje, se guarda en Postgres (Neon) vía Prisma y se muestra la lista. Tiene un **título visible** ideal para el momento "`git push` → redeploy".

## Stack (Node más reciente + ligero)

- **Node.js 24** (LTS actual).
- **Fastify** como servidor (más liviano y rápido que Express; sirve el frontend estático y la API). _Express sirve igual si lo prefieres._
- **Prisma** + **PostgreSQL** (Neon).
- **Frontend vanilla** (HTML/CSS/JS en `public/`) servido por el mismo Fastify.

### Por qué este stack no crashea el build en 1 GB

El que suele provocar **OOM** al buildear no es el ORM ni el server: son los **bundlers** (Vite/webpack/Next/Astro). Por eso:

- **Sin bundler:** el frontend es estático y lo sirve el server tal cual. No hay paso de empaquetado pesado.
- **Único paso de "build" es `prisma generate`**, que es ligero.
- **Imagen base Alpine** y dependencias mínimas.

> Astro/Next/Vite habrían metido un build con Vite que en 1 GB puede quedarse sin memoria. Mantenerlo sin bundler es la forma más segura.

---

## Cómo no quedarte sin RAM al buildear (elige una)

1. **Añade swap a la VM** (recomendado siempre en 1 GB):
   ```bash
   sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
   sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```
2. **Build en CI, no en la VM (lo más robusto):** que **GitHub Actions** construya la imagen Docker y la suba a **ghcr.io**; en Coolify despliegas la **imagen prebuilt** (la VM solo la ejecuta, no compila). Cero riesgo de OOM en el build.
3. Si compilas en la VM y aún aprieta, limita memoria de Node en el build:
   `NODE_OPTIONS=--max-old-space-size=512`.

---

## Requisitos imprescindibles (para que despliegue bien)

1. Servidor escucha en `process.env.PORT` (default 3000) y **bind a `0.0.0.0`**.
2. Endpoint **`GET /health`** que responde 200 (health check de Coolify).
3. **Prisma + Neon con pooler:** `DATABASE_URL` = conexión **pooled** (`-pooler`) para runtime; `DIRECT_URL` = conexión **directa** (sin pooler) para migraciones. En `schema.prisma`, `datasource` usa `url = env("DATABASE_URL")` y `directUrl = env("DIRECT_URL")`.
4. **Migraciones en runtime, no en build:** el contenedor corre `prisma migrate deploy` al arrancar (usa `DIRECT_URL`). `prisma generate` sí va en el build.
5. Sin secretos en el repo: `.env.example` + `.gitignore` (`.env`, `node_modules`).
6. Imagen multi-arch (sirve para **amd64** de la micro AMD y **arm64** del A1): `node:24-alpine` ya lo es.

---

## Estructura sugerida

```
mural/
├─ prisma/
│  └─ schema.prisma        # datasource (url + directUrl) + model Message
├─ src/
│  ├─ server.js            # Fastify: estáticos + API + /health
│  └─ db.js                # PrismaClient
├─ public/
│  ├─ index.html           # título visible + formulario + lista
│  ├─ styles.css
│  └─ app.js               # fetch a /api/messages
├─ Dockerfile
├─ .env.example
├─ .gitignore
├─ package.json            # "start": "npx prisma migrate deploy && node src/server.js"
└─ README.md
```

## API

| Método | Ruta            | Descripción                                 |
| ------ | --------------- | ------------------------------------------- |
| `GET`  | `/health`       | 200 `{ status: "ok" }`                      |
| `GET`  | `/api/messages` | Últimos 50, orden desc por `createdAt`      |
| `POST` | `/api/messages` | Crea `{ name, body }` (valida 1–50 / 1–280) |

## Modelo Prisma (referencia)

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled (-pooler), runtime
  directUrl = env("DIRECT_URL")     // directa, migraciones
}
generator client { provider = "prisma-client-js" }

model Message {
  id        BigInt   @id @default(autoincrement())
  name      String   @db.VarChar(50)
  body      String   @db.VarChar(280)
  createdAt DateTime @default(now())
}
```

## Archivos de referencia

**.env.example**

```bash
# Neon: pooled para la app, directa para migraciones
DATABASE_URL=postgresql://USER:PASS@ep-xxxx-pooler.REGION.neon.tech/neondb?sslmode=require
DIRECT_URL=postgresql://USER:PASS@ep-xxxx.REGION.neon.tech/neondb?sslmode=require
PORT=3000
NODE_ENV=development
```

**Dockerfile** (ligero, migra en runtime)

```dockerfile
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY package*.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
COPY public ./public
EXPOSE 3000
CMD ["sh","-c","npx prisma migrate deploy && node src/server.js"]
```

_(Incluye `prisma` y `@prisma/client` en `dependencies` para que `generate` y `migrate deploy` funcionen.)_

---

## Criterios de aceptación

- [ ] `npm install && npm start` levanta en `:3000` leyendo `DATABASE_URL`/`DIRECT_URL` del `.env`.
- [ ] `GET /health` → 200.
- [ ] El formulario crea una fila y la lista se refresca.
- [ ] `prisma migrate deploy` aplica la migración al arrancar (no en build).
- [ ] `docker build` no excede ~512 MB de RAM (sin bundler).
- [ ] Sin secretos en el repo; existe `.env.example`.
- [ ] Encabezado fácil de cambiar para la demo del redeploy.

---

## Prompt para Claude Code (copiar y pegar)

> Crea un proyecto full-stack llamado **"mural"**: un muro público de mensajes tipo guestbook. **Prioridad: que el build sea súper ligero y NO use ningún bundler** (se desplegará en una VM con solo 1 GB de RAM y un bundler tipo Vite/webpack provocaría OOM).
>
> **Stack:** **Node.js 24**, **Fastify** como único servidor (sirve un frontend estático desde `public/` y una API JSON), **Prisma** con **PostgreSQL**. Frontend en HTML/CSS/JS vanilla, sin framework ni bundler.
>
> **Base de datos (Neon + pooler):** en `prisma/schema.prisma`, `datasource db` con `provider = "postgresql"`, `url = env("DATABASE_URL")` (conexión pooled, runtime) y `directUrl = env("DIRECT_URL")` (conexión directa, para migraciones). Crea un `model Message { id BigInt @id @default(autoincrement()); name String @db.VarChar(50); body String @db.VarChar(280); createdAt DateTime @default(now()) }`.
>
> **Requisitos obligatorios:**
>
> - El servidor escucha en `process.env.PORT` (default 3000) con bind a `0.0.0.0`.
> - Endpoint `GET /health` que responde 200 `{ "status": "ok" }`.
> - API: `GET /api/messages` (últimos 50, orden desc por `createdAt`) y `POST /api/messages` (body `{ name, body }`, valida name 1–50 y body 1–280, responde 201 con el mensaje creado). Serializa `id` (BigInt) a string en las respuestas JSON.
> - **Las migraciones se aplican en runtime**, no en build: el script `start` debe ser `npx prisma migrate deploy && node src/server.js`. `prisma generate` va en el Dockerfile.
> - Incluye `fastify`, `@fastify/static`, `@prisma/client` y `prisma` en `dependencies`.
> - Manejo de errores que no tumbe el proceso.
>
> **Frontend (`public/`):** un encabezado grande y editable con el título "Mural", un formulario (nombre + mensaje) que hace `POST /api/messages`, y una lista que carga con `GET /api/messages` y se refresca al enviar. Limpio y responsive, sin frameworks ni build.
>
> **Entregables adicionales:** `package.json` (con el `start` indicado y `"engines": { "node": ">=24" }`), un `Dockerfile` basado en `node:24-alpine` que haga `npm ci --omit=dev`, `npx prisma generate`, exponga 3000 y use el `CMD` con `prisma migrate deploy`; un `.env.example` (`DATABASE_URL`, `DIRECT_URL`, `PORT`, `NODE_ENV`); un `.gitignore` (ignora `.env` y `node_modules`); y un `README.md` con cómo correr en local y cómo desplegar en Coolify (build pack Dockerfile, variables de entorno, puerto 3000, health check `/health`). Genera una migración inicial de Prisma en `prisma/migrations/`.
>
> **Restricciones:** sin secretos en el código; imagen multi-arch (amd64 y arm64). Mantén las dependencias al mínimo. Cuando termines, dime cómo probarlo en local con un `.env` apuntando a mi base de Neon, y cómo generar la primera migración.

---

## Después de construirlo

```bash
cp .env.example .env          # pega tus URLs de Neon (pooled y directa)
npm install
npx prisma migrate dev -n init   # primera migración (usa DIRECT_URL)
npm start                     # http://localhost:3000

git init && git add . && git commit -m "init mural"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/mural.git
git push -u origin main
```

En Coolify: build pack **Dockerfile**, variables `DATABASE_URL` + `DIRECT_URL`, puerto **3000**, health check **`/health`**. Si la VM tiene 1 GB, **activa swap** o usa la opción de **build en CI + imagen en ghcr.io**.
