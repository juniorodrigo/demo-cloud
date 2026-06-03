# Caddy (reverse proxy) — instalación y configuración

> **Paso 1 de 2:** dejamos **Caddy funcionando solo**, como reverse proxy compartido. La app (mural) se configura aparte, en el **siguiente** documento, y se "engancha" a este Caddy por una red Docker común.
> Entorno: VM **micro AMD de Oracle (1 OCPU / 1 GB)**, Ubuntu + SSH. **SSL lo pone Cloudflare** (modo _Flexible_), así que Caddy trabaja en **HTTP plano (puerto 80)**.

```
 Usuario → Cloudflare (HTTPS) → VM :80 (Caddy) → [ app1 | app2 | host | IP externa ]
                                                  red Docker compartida "web"
```

Idea clave: **un solo Caddy** al frente; cada app vive en su propio `docker-compose.yml` y se une a la red `web`. Caddy las alcanza por su nombre de contenedor.

---

## 1 · Preparar el servidor (base común)

```bash
ssh ubuntu@TU_IP
sudo apt update && sudo apt upgrade -y

# Zona horaria de la VM
sudo timedatectl set-timezone America/Lima
timedatectl            # verifica que diga America/Lima
```

**Swap (recomendado en 1 GB):**

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**Docker + Compose:**

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
docker --version && docker compose version
```

**Abrir solo el puerto 80** (el SSL lo pone Cloudflare, no hace falta el 443):

- **Consola OCI** → Security List / NSG → _Ingress_ TCP **80** (origen `0.0.0.0/0`). SSH (22) ya suele estar.
- **En la VM** (iptables restrictivo de Oracle):

```bash
sudo iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT
sudo netfilter-persistent save
```

**Red Docker compartida** (la usarán Caddy y cada app):

```bash
docker network create web
```

---

## 2 · Caddy en su propia carpeta

```bash
mkdir -p ~/caddy && cd ~/caddy
```

### `~/caddy/docker-compose.yml`

```yaml
services:
 caddy:
  image: caddy:2-alpine
  container_name: caddy
  restart: unless-stopped
  ports:
   - "80:80" # solo HTTP; el TLS lo pone Cloudflare
  environment:
   - TZ=America/Lima # sin .env: Caddy no tiene secretos
  volumes:
   - ./Caddyfile:/etc/caddy/Caddyfile:ro
   - caddy_data:/data
   - caddy_config:/config
  networks:
   - web

networks:
 web:
  external: true # la red creada en el paso 1

volumes:
 caddy_data:
 caddy_config:
```

> **Nota sobre el `.env`:** Caddy **no usa ninguno**. Le pasamos `TZ` directo en `environment`. (Recuerda: un archivo `.env` junto al compose solo sirve para sustituir `${VARS}` _dentro_ del YAML; `env_file:` es lo que mete variables _dentro_ de un contenedor. Eso lo usará la **app**, no Caddy.)

### `~/caddy/Caddyfile`

```
# Cada bloque = un dominio que enruta a un servicio.
# 'mural' es el nombre del contenedor de la app (se conectará a la red "web").
http://app.midominio.com {
    reverse_proxy mural:3000
}
```

> Si todavía no levantas la app, Caddy responderá **502** en ese dominio (proxy arriba, sin upstream aún). Es lo esperado hasta el paso 2.

---

## 3 · Levantar y verificar

```bash
cd ~/caddy
docker compose up -d
docker compose ps                 # caddy "running"
docker compose logs -f caddy      # sin errores de parseo del Caddyfile

curl -I http://localhost          # Caddy responde (502 si no hay app aún = OK)
```

**Recargar tras editar el `Caddyfile`** (sin downtime):

```bash
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
# o, más simple:  docker compose restart caddy
```

---

## 4 · Cloudflare (modo Flexible)

1. **DNS:** registro **A** `app` → IP pública de la VM, en **Proxied (nube naranja)**.
2. **SSL/TLS → Overview → Flexible.**

Flujo final: navegador → **HTTPS** → Cloudflare → **HTTP:80** → Caddy → tu servicio.

---

## 5 · Conectar apps a este Caddy (referencia para el siguiente paso)

Cada app va en **su propio** `docker-compose.yml` y se une a la red `web`. Ejemplo del servicio de la app:

```yaml
services:
 mural:
  image: ghcr.io/TU_USUARIO/mural:latest
  container_name: mural # ← este nombre es el que usa Caddy
  restart: unless-stopped
  env_file: .env # aquí SÍ va el .env con DATABASE_URL, etc.
  expose: ["3000"] # interno; NO publica puertos al host
  networks: [web]

networks:
 web:
  external: true
```

Luego, en el `Caddyfile`, añades un bloque por cada app y recargas Caddy:

```
http://app.midominio.com   { reverse_proxy mural:3000 }
http://otra.midominio.com  { reverse_proxy otra-app:8080 }
```

Así un solo Caddy sirve **varias apps**, cada una aislada en su compose.

---

## 6 · ¿Caddy puede hablar con servicios FUERA de la red Docker?

Sí. El `reverse_proxy` de Caddy apunta a cualquier destino alcanzable; el nombre de contenedor solo funciona dentro de la red compartida.

**a) Un servicio en el HOST (fuera de Docker)** — usa `host.docker.internal` con `extra_hosts`:

```yaml
# en el servicio caddy del compose:
extra_hosts:
 - "host.docker.internal:host-gateway"
```

```
http://api.midominio.com {
    reverse_proxy host.docker.internal:8080
}
```

_(También sirve la IP del bridge de Docker, normalmente `172.17.0.1`.)_

**b) Cualquier IP o máquina en la red** — directo por IP\:puerto:

```
http://interno.midominio.com {
    reverse_proxy 10.0.0.5:8080
}
```

**c) Un servicio HTTPS externo** — pon el esquema y, si hace falta, ajusta el Host:

```
http://proxy.midominio.com {
    reverse_proxy https://api.ejemplo.com {
        header_up Host api.ejemplo.com
    }
}
```

**Alternativa: `network_mode: host`** en Caddy — comparte la red del host y llega a `localhost:PUERTO` directo, pero pierdes el DNS por nombre de Docker y el mapeo `ports:` deja de aplicar (Caddy toma los puertos del host tal cual). Útil si la mayoría de tus servicios corren fuera de Docker.

---

## Troubleshooting

| Síntoma                           | Causa                                  | Solución                                        |
| --------------------------------- | -------------------------------------- | ----------------------------------------------- |
| `network web not found`           | Falta crear la red                     | `docker network create web` (Parte 1)           |
| 502 en el dominio                 | No hay upstream / app no está en `web` | Levanta la app y únela a la red `web`           |
| 521/522 en Cloudflare             | Caddy caído o puerto 80 cerrado        | `docker compose ps` + abrir 80 (OCI + iptables) |
| Cambios al `Caddyfile` no aplican | No recargaste                          | `caddy reload` o `docker compose restart caddy` |
| Caddy no arranca                  | Error de sintaxis                      | Revisa `docker compose logs caddy`              |

---

**Siguiente paso:** configurar el servicio de la app (mural) en su propia carpeta, levantándolo con **PM2 (`pm2-runtime`)** dentro del contenedor y conectándolo a la red `web` para que este Caddy lo sirva.
