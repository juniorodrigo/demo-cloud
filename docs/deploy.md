# Deploy — Mural (Docker + CI/CD + Caddy + Cloudflare)

> **Paso 2 de 2.** Asume que ya tienes el **Caddy** del paso anterior corriendo en `~/caddy` y la red Docker `web` creada (ver [caddy.md](caddy.md)). Aquí se conteneriza la app, se monta el CI/CD y se engancha a ese Caddy.

```
git push → GitHub Actions (build amd64 → ghcr.io) → SSH a la VM → docker compose pull && up -d
Caddy (contenedor aparte, red "web") → reverse_proxy mural:3000
Cloudflare (modo Flexible) pone el HTTPS; la VM solo expone HTTP (:80) vía Caddy.
DB: NeonDB (Postgres gestionado, externo) por DATABASE_URL (pooled) y DIRECT_URL (directa).
```

**Restricciones del entorno:** VM micro Oracle 1 OCPU / 1 GB / amd64. No se compila en la VM (build en CI). Sin PM2 — Docker supervisa con `restart: unless-stopped`. TZ de los contenedores: `America/Lima`.

---

## 1 · Archivos en el repo

Ya creados y versionados:

| Archivo | Rol |
| --- | --- |
| `Dockerfile` | `node:24-alpine` + `tzdata`/`TZ`; `npm ci --omit=dev`; `prisma generate`; `CMD` = `prisma migrate deploy && node src/server.js` (entrypoint real). |
| `.dockerignore` | Excluye `node_modules`, `.env`, `.git`, `Dockerfile`, `docker-compose.yml`, `docs`, etc. |
| `.github/workflows/deploy.yml` | `push` a `main` → **build** (imagen amd64 → `ghcr.io/juniorodrigo/mural:latest`) → **deploy** (SSH a la VM). |
| `docker-compose.yml` | Servicio `mural` para la VM: red `web`, `expose: 3000` (sin publicar puertos), `restart: unless-stopped`, `env_file: .env`, `TZ`. |
| `.env.example` | Plantilla: `DATABASE_URL`, `DIRECT_URL`, `NODE_ENV`, `PORT`. |

**Migraciones en runtime:** el contenedor corre `prisma migrate deploy` al arrancar (usa `DIRECT_URL`); `prisma generate` ocurre en el build. La carpeta `prisma/migrations/` debe estar versionada.

---

## 2 · Secrets de GitHub Actions

Repo → **Settings → Secrets and variables → Actions** → *New repository secret*:

| Secret | Descripción |
| --- | --- |
| `VM_HOST` | IP pública o host de la VM. |
| `VM_USER` | Usuario SSH (`ubuntu`). |
| `VM_SSH_KEY` | **Clave privada** SSH completa (con `-----BEGIN/END-----`). Su pública debe estar en `~/.ssh/authorized_keys` de `VM_USER`. |

`GITHUB_TOKEN` es automático (el workflow ya lo usa con `packages: write` para publicar en ghcr.io). No se crea a mano.

---

## 3 · Preparar la VM (una sola vez)

```bash
ssh ubuntu@TU_IP

# Permisos de Docker SIN sudo (necesario: el workflow corre `docker compose` sin sudo)
sudo usermod -aG docker $USER
exit                       # cierra y reabre la sesión para que aplique el grupo
# al reconectar:
docker ps                  # debe listar sin "permission denied"

# Red compartida con Caddy (si no existe)
docker network create web 2>/dev/null || true

# Carpeta de la app
mkdir -p ~/mural && cd ~/mural
```

En `~/mural` van **dos** archivos:

- **`docker-compose.yml`** — copia el del repo (scp o pégalo).
- **`.env`** — con las URLs reales de Neon (NO se sube a git):
  ```bash
  DATABASE_URL=postgresql://USER:PASS@ep-xxxx-pooler.REGION.neon.tech/neondb?sslmode=require
  DIRECT_URL=postgresql://USER:PASS@ep-xxxx.REGION.neon.tech/neondb?sslmode=require
  NODE_ENV=production
  PORT=3000
  ```

**Acceso a ghcr (paquete privado por defecto):**
```bash
docker pull ghcr.io/juniorodrigo/mural:latest
# si da "denied/unauthorized": o haz el paquete público en GitHub → Packages,
# o autentica la VM:
echo "TU_PAT_con_read:packages" | docker login ghcr.io -u juniorodrigo --password-stdin
```

> **Nota de permisos de carpeta:** si creaste alguna carpeta con `sudo`/como root (p. ej. `/root/caddy`), `ubuntu` no podrá entrar. Muévela y cámbiale el dueño:
> ```bash
> sudo mv /root/caddy /home/ubuntu/caddy
> sudo chown -R ubuntu:ubuntu /home/ubuntu/caddy
> # tras mover una carpeta con bind-mounts, recrea su contenedor desde la nueva ruta:
> cd ~/caddy && docker compose up -d --force-recreate
> ```

---

## 4 · Primer deploy (manual, para validar)

```bash
cd ~/mural
docker compose pull
docker compose up -d
docker compose ps
```

A partir de aquí, **cada `git push` a `main`** redespliega solo (build en CI + `compose pull && up -d` por SSH).

---

## 5 · Verificación (la app NO publica puertos al host)

`curl localhost:3000` **falla a propósito**: el compose usa `expose` (no `ports`), así que la app solo es visible dentro de la red `web`. Se prueba por el camino real:

```bash
# 1) mural y caddy comparten la red "web"
docker network inspect web --format '{{range .Containers}}{{.Name}} {{end}}'
#    -> caddy mural

# 2) probar mural DESDE caddy (mismo camino que el reverse_proxy)
docker exec caddy wget -qO- http://mural:3000/health
#    -> {"status":"ok"}

# 3) arranque correcto: migraciones aplicadas + listening en 0.0.0.0:3000
docker logs mural --tail 30
```

---

## 6 · Enganchar a Caddy

En `~/caddy/Caddyfile`, un bloque por dominio apuntando al **nombre del contenedor**:

```
http://demo.cloudnt.org {
    reverse_proxy mural:3000
}
```

Editar el Caddyfile **no aplica nada hasta recargar**:

```bash
cd ~/caddy
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
# si hay error de parseo:  docker compose restart caddy
docker compose logs --tail 20 caddy
```

---

## 7 · Cloudflare (modo Flexible)

1. **DNS:** registro **A** del subdominio → IP pública de la VM, en **Proxied** (nube **naranja**).
2. **SSL/TLS → Overview → Flexible** (¡no Full!). Caddy solo escucha **HTTP:80**; en Full, Cloudflare intentaría HTTPS:443 contra el origen y daría **522**.

Flujo final: navegador → **HTTPS** (Cloudflare) → **HTTP:80** (Caddy) → `mural:3000`.

---

## 8 · Troubleshooting

| Síntoma | Causa | Solución |
| --- | --- | --- |
| Deploy job: `cd: ~/mural: No such file or directory` | VM sin preparar | Crear `~/mural` con `docker-compose.yml` + `.env` (Parte 3). |
| Deploy job: `permission denied ... docker.sock` | Usuario SSH fuera del grupo `docker` | `sudo usermod -aG docker $USER` y reconectar. |
| `pull` da `denied/unauthorized` | Paquete ghcr privado | `docker login ghcr.io` o hacerlo público. |
| `curl localhost:3000` falla | Por diseño: `expose`, no `ports` | Probar desde la red `web` (Parte 5). |
| `wget http://mural:3000` "bad address" | `mural` no está en la red `web` | Revisar `networks: [web]` + `networks: web: external: true` en el compose. |
| 502 en el dominio | Sin upstream / app no está en `web` | Levantar `mural` y unirlo a `web`. |
| 521/522 en Cloudflare | SSL no es Flexible, o :80 cerrado | SSL/TLS → Flexible; abrir 80 (OCI + iptables). |
| Cambios al Caddyfile no aplican | No se recargó | `caddy reload` o `docker compose restart caddy`. |
| Validar el dominio contra el origen | El `Host` define el bloque de Caddy | `curl -I -H "Host: demo.cloudnt.org" http://TU_IP/`. |

---

## Resumen del ciclo

```
edición local → git push origin main
   → GitHub Actions: build amd64 → ghcr.io/juniorodrigo/mural:latest
   → SSH a la VM: cd ~/mural && docker compose pull && up -d && image prune -f
   → mural (red web) ← Caddy (reverse_proxy mural:3000) ← Cloudflare (Flexible) ← navegador
```
