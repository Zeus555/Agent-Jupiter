# Despliegue del agente PRC Jupiter en Docker (Ubuntu Server)

El agente corre en un contenedor **Linux** con Chromium **headful** + la extensión
**Phantom** sobre **Xvfb** (pantalla virtual). En Linux nativo:
- **Docker NO necesita virtualización por hardware (VT-x)** — usa namespaces/cgroups.
  Por eso funciona en CPUs sin VT (p. ej. el Pentium P6100 de sentinel016).
- El navegador **no depende de ninguna sesión interactiva de Windows** → sobrevive
  reinicios y no se cae al cerrar sesión (era la fragilidad del despliegue en Windows).

## 0. Requisitos en el equipo destino
- **Ubuntu Server 22.04 LTS (amd64)** recién instalado, con **OpenSSH server**.
- Acceso de red para que **sentinel009 alcance el puerto 3011** (misma IP/LAN).
- Internet (la primera build descarga la imagen base de Playwright, ~2 GB).

## 1. Llevar el proyecto al servidor
Desde la laptop (sentinel013), con el bundle ya preparado:
```bash
scp prc-agent-jupiter-deploy.tar.gz <user>@<ip-ubuntu>:~/
ssh <user>@<ip-ubuntu>
mkdir -p ~/prc-agent-jupiter && tar -xzf ~/prc-agent-jupiter-deploy.tar.gz -C ~/prc-agent-jupiter
cd ~/prc-agent-jupiter
```

## 2. Configurar secretos
```bash
cp .env.example .env
nano .env          # poner PHANTOM_PASSWORD (obligatorio). El resto tiene defaults.
```

## 3. Instalar Docker y levantar (un comando)
```bash
sudo bash deploy/setup-ubuntu.sh
```
El script instala Docker Engine + compose, valida `.env`/extensión, y hace
`docker compose up -d --build`. El arranque (navegador + warmup) tarda ~30-60s.

Verificar:
```bash
curl http://localhost:3011/health
docker compose logs -f
```

## 4. Crear la wallet NUEVA (una sola vez)
```bash
curl -X POST http://localhost:3011/wallet/create
# Respaldar la frase semilla de inmediato y guardarla en sitio seguro:
docker exec prc-agent-jupiter cat /app/wallet_seed.txt
```
Luego fondear esa wallet y, si aplica, apuntar a su address en los proyectos que la usen.

## 5. Operación
```bash
docker compose ps            # estado
docker compose logs -f       # logs (rotados por Docker)
docker compose restart       # reiniciar
docker compose down          # detener
docker compose up -d --build # actualizar tras cambios de código
```
El contenedor tiene `restart: unless-stopped` → arranca solo al bootear el server y se
reinicia si crashea. Sin pm2, sin tareas programadas, sin dependencia de sesión.

## Qué se persiste / inyecta
- **`.env`** → secretos en runtime (nunca dentro de la imagen).
- **`./user_data`** → volumen `/app/user_data` (perfil del navegador + estado de la
  wallet Phantom; sobrevive reinicios y recreación del contenedor).
- `PHANTOM_EXTENSION_PATH` se fuerza a `/app/extensions/phantom`.
- Puerto **3011** publicado en `0.0.0.0` (alcanzable por la LAN / sentinel009).

## Red / firewall
Ubuntu Server normalmente trae `ufw` inactivo (puerto abierto). Si lo activas:
```bash
sudo ufw allow 3011/tcp
```

## Tuning de precios (opcional, ver .env.example)
`PRICE_WARMER`, `PRICE_SERVE_TTL`, `PRICE_WARM_INTERVAL`, `PRICE_WARM_STALE`,
`PRICE_STALE_MAX`, `PRICE_REQUEST_TTL`, `BALANCE_REFRESH_INTERVAL`. El precio SIEMPRE
se lee de la UI; el warmer mantiene el cache caliente para respuestas en ms. Con un solo
activo monitoreado (WBTC) la pestaña se queda en ese mercado y no navega.

## Código multiplataforma
El código Windows (`visibility.ps1`, `getBrowserPid`, `cleanupEnvironment`) está guardado
tras `process.platform === 'win32'`, así que en Linux es no-op. La misma base de código
sirve para Windows y para el contenedor.
