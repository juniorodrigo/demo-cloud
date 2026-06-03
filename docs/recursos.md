# Recursos — Arquitecturas Cloud sobre Free Tiers

> Enlaces para seguir la charla y reproducir la demo (VM Oracle + Caddy + app en Docker + NeonDB, con Cloudflare delante). Todo gratis.
> _Última revisión: junio 2026 — las páginas y los límites de free tier pueden cambiar._

---

## 1 · Cuentas a crear (registro)

Las cuatro que necesitas para la demo:

- **Oracle Cloud (Always Free)** — la VM gratis 24/7.
  Info: https://www.oracle.com/cloud/free/ · Registro: https://signup.cloud.oracle.com/
  _Pide tarjeta para verificar (hold ~$1). Si la VM ARM sale "out of capacity", reintenta o cambia de región._
- **Neon** — Postgres serverless gestionado. _Sin tarjeta._
  https://neon.tech · Consola: https://console.neon.tech
- **Cloudflare** — DNS, CDN, SSL (y opcionalmente Tunnel).
  Registro: https://dash.cloudflare.com/sign-up
- **GitHub** — repo + CI/CD (Actions) + registro de imágenes (ghcr.io).
  Registro: https://github.com/signup

---

## 2 · Herramientas que usamos en la demo

- **Docker** (instalación con un comando) — https://get.docker.com · Docs: https://docs.docker.com
- **Docker Compose** — https://docs.docker.com/compose/
- **Caddy** (reverse proxy) — https://caddyserver.com · Docs: https://caddyserver.com/docs
  Directiva `reverse_proxy`: https://caddyserver.com/docs/caddyfile/directives/reverse_proxy
- **Prisma** (ORM) — https://www.prisma.io · Docs: https://www.prisma.io/docs
  Guía Prisma + Neon: https://www.prisma.io/docs/orm/overview/databases/neon
- **Node.js** — https://nodejs.org
- **GitHub Actions** (CI/CD) — https://docs.github.com/actions
- **GitHub Container Registry (ghcr.io)** — https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-container-registry
- **appleboy/ssh-action** (deploy por SSH en el workflow) — https://github.com/appleboy/ssh-action

### Cloudflare en detalle

- **Modos SSL/TLS** (Flexible, Full, Full strict) — https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/
- **Cloudflare Tunnel** (exponer sin abrir puertos) — https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
- **Rangos de IP de Cloudflare** (para restringir el puerto 80 al origen) — https://www.cloudflare.com/ips/

---

## 3 · Plataforma Cloudflare (free tier, por si vas serverless)

- **Workers** (cómputo en el edge) — https://developers.cloudflare.com/workers/
- **Pages** (frontend estático) — https://developers.cloudflare.com/pages/
- **R2** (object storage, egreso $0) — https://developers.cloudflare.com/r2/
- **D1** (SQLite en el edge) — https://developers.cloudflare.com/d1/
- **KV** (clave-valor) — https://developers.cloudflare.com/kv/

---

## 4 · Otros free tiers relevantes (para explorar)

- **Google Cloud Run** (serverless) — https://cloud.google.com/run
- **Supabase** (Postgres + Auth + Storage) — https://supabase.com
- **Turso** (SQLite en el edge) — https://turso.tech
- **Vercel** (frontend) — https://vercel.com
- **Netlify** (frontend) — https://www.netlify.com
- **Upstash** (Redis serverless) — https://upstash.com
- **Backblaze B2** (object storage) — https://www.backblaze.com/cloud-storage

---

## 5 · Solo prueba por tiempo (categoría aparte — NO always free)

Útiles para evaluar, no para vivir gratis:

- **AWS** — $200 en créditos / 6 meses (cuentas nuevas) — https://aws.amazon.com/free
- **Azure** — $200 en créditos / 30 días — https://azure.microsoft.com/free
- **Google Cloud** — $300 en créditos / 90 días — https://cloud.google.com/free
- **Fly.io** — solo trial — https://fly.io
- **Railway** — crédito único — https://railway.com

---

## 6 · Alternativas de despliegue open source

- **Coolify** (PaaS self-hosted; ideal en VMs con ≥2 GB) — https://coolify.io · Docs: https://coolify.io/docs
- **Dokku** (mini-PaaS ligero) — https://dokku.com
- **CapRover** — https://caprover.com
- **Kamal** (deploy de contenedores sin panel en el server) — https://kamal-deploy.org
- **OpenTofu** / **Terraform** (infra como código) — https://opentofu.org · https://www.terraform.io

---

## 7 · Catálogos para seguir explorando free tiers

- **free-for.dev** — el listado de referencia de servicios con free tier: https://free-for.dev
- **Cloud Providers Free Tier Overview** (comparativa AWS/Azure/GCP/Oracle) — https://github.com/cloudcommunity/Cloud-Service-Providers-Free-Tier-Overview

---

## 8 · Material de la charla

Documentos que acompañan esta sesión (pídelos al ponente o descárgalos):

- **Guía técnica** — el camino completo de la arquitectura.
- **Guía de Caddy** — instalar y configurar el reverse proxy (paso 1).
- **Guía de la app (deploy)** — Dockerfile + CI/CD + compose (paso 2).
- **CLAUDE.md** — contexto para generar el deploy con Claude Code sobre tu propio repo.

> Recordatorio clave de la charla: _gratis no es infinito_. Antes de lanzar algo serio, revisa **egreso, cold start/pausas, topes y uso comercial** de cada servicio.
