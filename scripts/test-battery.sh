#!/bin/bash
# ============================================================================
# Bateria de pruebas del PRC Agent Jupiter
# ============================================================================
# Se ejecuta EN sentinel016 (necesita curl, jq y docker en el host).
#
#   export BASE=http://localhost:3011          # obligatorio
#   ./test-battery.sh                          # pasada por defecto: SOLO solo-lectura
#   ./test-battery.sh --flap                   # + anti-flapping de /health (100s, 3 assets)
#   ./test-battery.sh --restart                # + ventana UNICA de reinicio consolidada
#   ./test-battery.sh --debug-window           # + ventana AGENT_DEBUG=true (2 recreaciones)
#
# POLITICA DE RIESGO (del plan, Docs/PLAN-PRUEBAS.md):
#   - La pasada por defecto ejecuta unicamente pruebas de riesgo "solo-lectura".
#     El filtro es el RIESGO, nunca el campo "automatizable": hay pruebas
#     automatizables que reinician produccion y jamas deben correr por defecto.
#   - --restart agrupa TODAS las aserciones post-reinicio en un unico corte de
#     servicio (antes eran 6 reinicios independientes).
#   - Las pruebas de trading NUNCA se automatizan: mueven fondos reales.
#     Protocolos manuales en Docs/PLAN-PRUEBAS.md seccion "trade".
#   - La bateria abre con un snapshot (battery-00) y cierra con un gate
#     (battery-99) que garantiza que produccion quedo EXACTAMENTE como estaba:
#     mismas posiciones, misma address, mismo .env, debug cerrado, 6080 cerrado.
# ============================================================================
set -u

# ---------------------------------------------------------------- parametros
: "${BASE:?export BASE=http://localhost:3011 antes de ejecutar}"
COMPOSE_DIR="${COMPOSE_DIR:-$HOME/prc-agent-jupiter}"
CONTAINER="${CONTAINER:-prc-agent-jupiter}"
FLAP=false; RESTART=false; DEBUGWIN=false
for a in "$@"; do case "$a" in
  --flap) FLAP=true ;; --restart) RESTART=true ;; --debug-window) DEBUGWIN=true ;;
  *) echo "flag desconocida: $a (validas: --flap --restart --debug-window)"; exit 2 ;;
esac; done
command -v jq >/dev/null || { echo "FALTA jq"; exit 2; }
command -v docker >/dev/null || { echo "FALTA docker"; exit 2; }

PASS=0; FAIL=0; SKIP=0; FAILED_IDS=""
ok()   { PASS=$((PASS+1)); printf 'PASS  %-42s %s\n' "$1" "${2:-}"; }
bad()  { FAIL=$((FAIL+1)); FAILED_IDS="$FAILED_IDS $1"; printf 'FAIL  %-42s %s\n' "$1" "${2:-}"; }
skip() { SKIP=$((SKIP+1)); printf 'SKIP  %-42s %s\n' "$1" "${2:-}"; }
halt() { echo "ABORTADO: $*"; echo "Fallidos:$FAILED_IDS"; exit 3; }

# get URL [timeout] -> CODE, BODY, TIME (segundos con decimales)
get() {
  local out; out=$(curl -s -m "${2:-30}" -w $'\n%{http_code} %{time_total}' "$1" 2>/dev/null)
  local tail="${out##*$'\n'}"; BODY="${out%$'\n'*}"
  CODE="${tail%% *}"; TIME="${tail#* }"
}
post() { # post URL JSON [timeout]
  local out; out=$(curl -s -m "${3:-30}" -X POST -H 'Content-Type: application/json' -d "$2" -w $'\n%{http_code} %{time_total}' "$1" 2>/dev/null)
  local tail="${out##*$'\n'}"; BODY="${out%$'\n'*}"
  CODE="${tail%% *}"; TIME="${tail#* }"
}
jqv() { echo "$BODY" | jq -r "$1" 2>/dev/null; }
# tlt A B -> true si A < B (floats)
tlt() { awk -v a="$1" -v b="$2" 'BEGIN{exit !(a<b)}'; }

# ============================================================ battery-00: snapshot
# Si /health no es 200 aqui, produccion ya esta mal: no tiene sentido (ni es
# seguro) ejecutar el resto. El snapshot es la referencia del gate final.
get "$BASE/health" 20
[ "$CODE" = "200" ] || halt "battery-00: /health=$CODE — produccion no esta sana, no se ejecuta la bateria"
SNAP_ADDR=$(curl -s -m 30 "$BASE/wallet/status" | jq -r .address)
SNAP_COUNT=$(curl -s -m 90 "$BASE/trade/info" | jq -r .count)
SNAP_ENV=$(sha256sum "$COMPOSE_DIR/.env" | cut -d' ' -f1)
SNAP_RENDERERS=$(docker exec "$CONTAINER" pgrep -fc 'type=renderer' 2>/dev/null || echo -1)
case "$SNAP_COUNT" in (''|null|*[!0-9]*) halt "battery-00: /trade/info no devolvio count numerico ($SNAP_COUNT)";; esac
ok battery-00-snapshot "posiciones=$SNAP_COUNT addr=${SNAP_ADDR:0:6}.. renderers=$SNAP_RENDERERS"

# ============================================================ PRICE (solo lectura)
# price-01: cache caliente. La 1a puede ser fria (hasta 25s); la 2a debe salir
# de memoria. Umbral 100ms: sobrado para un hit de cache (medido 0-5ms) e
# imposible para una lectura fria (10-25s).
get "$BASE/price?asset=SOL" 30
get "$BASE/price?asset=SOL" 10
D=$(jqv .durationMs)
if [ "$CODE" = "200" ] && [ "$(jqv .asset)" = "SOL" ] && [ "${D:-999}" -le 100 ] 2>/dev/null; then
  ok price-01-warm-cache-hit "durationMs=$D"
else bad price-01-warm-cache-hit "code=$CODE durationMs=$D"; fi

# price-10: formato y rango del valor servido (SOL 5-10000).
V=$(jqv .price | tr -d '$,')
if echo "$V" | grep -Eq '^[0-9]+(\.[0-9]+)?$' && tlt 5 "$V" && tlt "$V" 10000; then
  ok price-10-value-format-and-range "SOL=$V"
else bad price-10-value-format-and-range "price='$(jqv .price)'"; fi

# price-02: flag stale coherente con ageMs, con banda muerta 14-16s en el borde
# (una muestra justo en el umbral puede evaluarse ms despues de calculado el flag).
A=$(jqv .ageMs); S=$(jqv .stale)
if [ "${A:-0}" -ge 14000 ] && [ "${A:-0}" -le 16000 ] 2>/dev/null; then
  skip price-02-stale-flag-coherence "ageMs=$A en banda muerta"
elif { [ "${A:-0}" -lt 14000 ] && [ "$S" = "false" ]; } || { [ "${A:-0}" -gt 16000 ] && [ "$S" = "true" ]; }; then
  ok price-02-stale-flag-coherence "ageMs=$A stale=$S"
else bad price-02-stale-flag-coherence "ageMs=$A stale=$S"; fi

# price-04/05: assets desconocidos rechazados con 400 rapido (nunca el precio
# de otro activo bajo el nombre equivocado; el 400 llega antes del navegador).
get "$BASE/price?asset=DOGE" 10
if [ "$CODE" = "400" ] && [ "$(jqv .code)" = "UNSUPPORTED_ASSET" ] && tlt "$TIME" 2; then
  ok price-04-reject-unknown-doge "400 en ${TIME}s"
else bad price-04-reject-unknown-doge "code=$CODE body=$(echo "$BODY" | head -c 80)"; fi
get "$BASE/price?asset=SOLX" 10
if [ "$CODE" = "400" ] && [ "$(jqv .code)" = "UNSUPPORTED_ASSET" ]; then
  ok price-05-reject-lookalike-solx ""
else bad price-05-reject-lookalike-solx "code=$CODE"; fi

# price-06: parametro no reconocido sin alias -> 400 UNKNOWN_PARAM (nunca SOL por defecto).
get "$BASE/price?pair=WBTC" 10
if [ "$CODE" = "400" ] && [ "$(jqv .code)" = "UNKNOWN_PARAM" ]; then
  ok price-06-unknown-param-rejected ""
else bad price-06-unknown-param-rejected "code=$CODE body=$(echo "$BODY" | head -c 80)"; fi

# price-07: minusculas y espacios normalizados.
get "$BASE/price?asset=sol" 10
if [ "$CODE" = "200" ] && [ "$(jqv .asset)" = "SOL" ]; then
  ok price-07-case-insensitive ""
else bad price-07-case-insensitive "code=$CODE asset=$(jqv .asset)"; fi

# price-08: alias presente pero vacio -> 400 (bug del cliente, no default).
get "$BASE/price?asset=" 10
if [ "$CODE" = "400" ]; then ok price-08-empty-asset-param ""
else bad price-08-empty-asset-param "code=$CODE"; fi

# price-09: sin parametros -> SOL por defecto documentado.
get "$BASE/price" 30
if [ "$CODE" = "200" ] && [ "$(jqv .asset)" = "SOL" ]; then
  ok price-09-default-sol ""
else bad price-09-default-sol "code=$CODE asset=$(jqv .asset)"; fi

# price-11: pedir un asset lo registra en health.price.tracked (version rebajada
# a lo que se puede medir sin esperar TTLs: presencia inmediata).
curl -s -m 40 "$BASE/price?asset=ETH" > /dev/null
sleep 1
get "$BASE/health" 20
if echo "$BODY" | jq -e '.price.tracked | index("ETH")' > /dev/null; then
  ok price-11-demand-registered "ETH en tracked"
else bad price-11-demand-registered "tracked=$(jqv '.price.tracked | join(",")')"; fi

# ============================================================ HEALTH (solo lectura)
# health-01: payload completo y umbral leido del entorno real del contenedor,
# no un 60000 asumido (si .env afina PRICE_STALE_MAX, el contrato es el override).
WANT_THR=$(docker exec "$CONTAINER" printenv PRICE_STALE_MAX 2>/dev/null); WANT_THR=${WANT_THR:-60000}
get "$BASE/health" 20
if [ "$CODE" = "200" ] \
   && echo "$BODY" | jq -e '.status=="ok" and (.price|has("staleThresholdMs") and has("freshestAgeMs") and has("staleTracked") and has("hasFreshPrice")) and (.balance|has("hasData")) and (.pageLock|has("waiting"))' > /dev/null \
   && [ "$(jqv .price.staleThresholdMs)" = "$WANT_THR" ]; then
  ok health-01-payload-contract "staleThresholdMs=$WANT_THR"
else bad health-01-payload-contract "code=$CODE thr=$(jqv .price.staleThresholdMs) esperado=$WANT_THR"; fi

# health-02: maquinaria viva = freshestAgeMs cerca de 0.
F=$(jqv .price.freshestAgeMs)
if [ "${F:-99999}" -lt 15000 ] 2>/dev/null; then ok health-02-freshest-age-alive "freshestAgeMs=$F"
else bad health-02-freshest-age-alive "freshestAgeMs=$F"; fi

# health-05: el health superficial no toca el navegador: rapido siempre.
if [ "${BODY:+x}" = "x" ] && tlt "$TIME" 1 && [ "$(jqv .durationMs)" -le 50 ] 2>/dev/null; then
  ok health-05-shallow-fast "durationMs=$(jqv .durationMs) total=${TIME}s"
else bad health-05-shallow-fast "durationMs=$(jqv .durationMs) total=${TIME}s"; fi

# health-06: coherencia mecanica de staleTracked con las edades reportadas
# (mismo instante, banda muerta de 2s alrededor del umbral).
if echo "$BODY" | jq -e --argjson t "$WANT_THR" '
    [.price.tracked[] as $s
     | (.price.prices[$s].ageMs // 1e15) as $a
     | select(($a < ($t-2000) and (.price.staleTracked|index($s)))
           or ($a > ($t+2000) and (.price.staleTracked|index($s)|not)))] | length == 0' > /dev/null; then
  ok health-06-staletracked-coherence ""
else bad health-06-staletracked-coherence "$(jqv '.price | {tracked, staleTracked}' )"; fi

# health-08: deep solo actua con el literal "true"; cualquier otro valor no
# debe tocar el navegador (pageReady queda null).
get "$BASE/health?deep=1" 20
P=$(jqv .pageReady)
if [ "$P" = "null" ]; then ok health-08-deep-strict-literal ""
else bad health-08-deep-strict-literal "deep=1 -> pageReady=$P"; fi

# health-09: sin contencion PERSISTENTE. Una foto unica puede pillar una cola
# legitima (cold reads de la propia bateria); tres muestras separadas 2s solo
# fallan si la cola no drena nunca.
WMIN=9
for i in 1 2 3; do
  get "$BASE/health" 10
  W=$(jqv .pageLock.waiting)
  [ "${W:-9}" -lt "$WMIN" ] 2>/dev/null && WMIN=$W
  sleep 2
done
if [ "$WMIN" -le 1 ] 2>/dev/null; then ok health-09-pagelock-no-queue "min(waiting)=$WMIN"
else bad health-09-pagelock-no-queue "min(waiting)=$WMIN en 3 muestras"; fi

# health-10: uptime crece entre dos muestras; version = package.json.
U1=$(jqv .uptimeSec); VER=$(jqv .version)
sleep 3; get "$BASE/health" 20; U2=$(jqv .uptimeSec)
if [ "${U2:-0}" -gt "${U1:-0}" ] 2>/dev/null && [ "$VER" = "$(jqv .version)" ] && [ -n "$VER" ] && [ "$VER" != "unknown" ]; then
  ok health-10-uptime-version "v$VER uptime $U1->$U2"
else bad health-10-uptime-version "u1=$U1 u2=$U2 v=$VER"; fi

# wallet-tabs-10 (reformulado 2 veces): vitalidad del tab frontal. La firma
# robusta no es un umbral de frescura (bajo rotacion multi-activo la serie puede
# flotar en 10-35s sin que nada este roto): es la DIRECCION. freshestAgeMs solo
# DECRECE cuando una lectura real actualiza el cache; con jup.ag throttleado o la
# pagina muerta la serie crece monotona sin excepcion. 25 muestras a 1s: exigimos
# al menos un decremento (hubo refresco real) y ninguna muestra en el umbral del
# health gate. La ventana son 75s (25 muestras a 3s): tiene que abarcar el peor
# hueco legitimo del contrato (el warmer puede pasar ~40s sin lectura buena bajo
# rotacion con hidrataciones lentas y aun cumplir el gate de 60s; medido).
PREV=-1; DEC=0; MAXF=0
for i in $(seq 1 25); do
  get "$BASE/health" 10
  F=$(jqv .price.freshestAgeMs)
  case "$F" in (''|null|*[!0-9]*) F=999999;; esac
  [ "$PREV" -ge 0 ] && [ "$F" -lt "$PREV" ] && DEC=$((DEC+1))
  [ "$F" -gt "$MAXF" ] && MAXF=$F
  PREV=$F
  sleep 3
done
# Si la ventana base no vio refrescos, extender hasta 3 min mas: los baches
# largos del SPA (medidos de 40-80s) terminan en un refresco; el throttling de
# un tab en background no termina nunca. El comportamiento del gate lo vigila
# health-03; aqui solo importa la DIRECCION de la serie.
EXTRA=0
while [ "$DEC" -eq 0 ] && [ "$EXTRA" -lt 60 ]; do
  get "$BASE/health" 10
  F=$(jqv .price.freshestAgeMs)
  case "$F" in (''|null|*[!0-9]*) F=999999;; esac
  [ "$F" -lt "$PREV" ] && DEC=$((DEC+1))
  [ "$F" -gt "$MAXF" ] && MAXF=$F
  PREV=$F
  EXTRA=$((EXTRA+1))
  sleep 3
done
if [ "$DEC" -ge 1 ]; then
  ok wallet-tabs-10-front-tab-liveness "refrescos=$DEC huecoMax=${MAXF}ms extra=$((EXTRA*3))s"
else bad wallet-tabs-10-front-tab-liveness "sin UN SOLO refresco en $((75+EXTRA*3))s: tab throttleado o pagina muerta (huecoMax=${MAXF}ms)"; fi

# ============================================================ BALANCE (solo lectura)
# balance-01: poblado, fresco y servido de cache (rapido). Umbral 250ms: sobrado
# para un hit de cache incluso con el event loop cargado por el warmer (medido
# 1ms en reposo, >100ms puntual bajo la carga de la propia bateria), e imposible
# para un scrapeo de UI (5-30s).
get "$BASE/wallet/balance" 30
DUR=$(jqv .durationMs)
# La PRIMERA llamada tras recrear el contenedor resuelve el nombre de la wallet via
# navegador (10-15s) y lo persiste; todas las siguientes son de cache. Si pillamos esa
# primera, reintentamos UNA vez: lo que este test garantiza es que el regimen es de
# cache, no que el fallback legitimo no exista.
if [ "${DUR:-999}" -gt 250 ] 2>/dev/null; then sleep 1; get "$BASE/wallet/balance" 30; DUR=$(jqv .durationMs); fi
NOW=$(date +%s%3N); LU=$(jqv .lastUpdated)
if [ "$CODE" = "200" ] && [ "$(jqv .hasData)" = "true" ] && [ "$(jqv .stale)" = "false" ] \
   && [ "${DUR:-999}" -le 250 ] 2>/dev/null \
   && [ $((NOW - ${LU:-0})) -le 150000 ] \
   && echo "$BODY" | jq -e '.balances | has("SOL")' > /dev/null; then
  ok balance-01-populated-fresh-fast "edad=$(( (NOW-LU)/1000 ))s durationMs=$DUR"
else bad balance-01-populated-fresh-fast "code=$CODE hasData=$(jqv .hasData) stale=$(jqv .stale) durationMs=$DUR edadMs=$((NOW-${LU:-0}))"; fi

# balance-02: ?tokens= respeta el subconjunto pedido (SOL siempre; el resto solo si >0).
get "$BASE/wallet/balance?tokens=SOL,USDC" 30
if [ "$CODE" = "200" ] && echo "$BODY" | jq -e '.balances | has("SOL") and (keys - ["SOL","USDC"] | length == 0)' > /dev/null; then
  ok balance-02-tokens-subset "$(jqv '.balances | keys | join(",")')"
else bad balance-02-tokens-subset "keys=$(jqv '.balances | keys | join(",")')"; fi

# balance-09: token inventado no aparece en la respuesta (el filtro de ceros lo poda).
get "$BASE/wallet/balance?tokens=SOL,FAKECOIN" 30
if [ "$CODE" = "200" ] && echo "$BODY" | jq -e '.balances | has("FAKECOIN") | not' > /dev/null; then
  ok balance-09-unknown-token-absent ""
else bad balance-09-unknown-token-absent "keys=$(jqv '.balances | keys | join(",")')"; fi

# balance-07: /wallet/balance y /health cuentan la MISMA historia del cache.
B_LU=$(jqv .lastUpdated); B_HD=$(jqv .hasData)
get "$BASE/health" 20
H_LU=$(jqv .balance.lastUpdated); H_HD=$(jqv .balance.hasData)
DELTA=$(( ${B_LU:-0} - ${H_LU:-0} )); [ "$DELTA" -lt 0 ] && DELTA=$((-DELTA))
if [ "$B_HD" = "$H_HD" ] && [ "$DELTA" -le 70000 ]; then
  ok balance-07-health-meta-consistency "deltaMs=$DELTA"
else bad balance-07-health-meta-consistency "balance.lastUpdated=$B_LU health=$H_LU hasData=$B_HD/$H_HD"; fi

# balance-08: auditoria de logs (30 min): si hubo boton cubierto, el log debe
# NOMBRAR al bloqueador; y en regimen no debe haber timeouts de click quemados.
LOGS30=$(docker logs "$CONTAINER" --since 30m 2>&1)
COVERED=$(echo "$LOGS30" | grep -c 'is covered by' || true)
NAMED=$(echo "$LOGS30" | grep -c 'covered by <' || true)
CLICKTO=$(echo "$LOGS30" | grep -c 'locator.click: Timeout' || true)
if [ "$CLICKTO" -eq 0 ] && [ "$COVERED" -eq "$NAMED" ]; then
  ok balance-08-failfast-log-audit "covered=$COVERED clickTimeouts=0"
else bad balance-08-failfast-log-audit "covered=$COVERED named=$NAMED clickTimeouts=$CLICKTO"; fi

# ============================================================ WALLET gates (solo lectura)
# wallet-tabs-01: conectado con address plausible.
# getWalletName scrapea la pagina viva: a mitad de una navegacion del warmer
# puede reportar desconectado sin estarlo. Hasta 3 intentos separados 5s; el
# fallo real (wallet caida) falla los tres.
for i in 1 2 3; do
  get "$BASE/wallet/status" 40
  [ "$(jqv .connected)" = "true" ] && break
  sleep 5
done
AD=$(jqv .address); L=${#AD}
if [ "$CODE" = "200" ] && [ "$(jqv .connected)" = "true" ] && [ "$L" -ge 32 ] && [ "$L" -le 44 ]; then
  ok wallet-tabs-01-status-connected "${AD:0:6}..${AD: -4}"
else bad wallet-tabs-01-status-connected "code=$CODE connected=$(jqv .connected) len=$L"; fi

# wallet-tabs-02/03: el gate de la clave falla cerrado en el endpoint REVERSIBLE
# (/wallet/import). Solo si ambos pasan se prueba /wallet/forget (37: la wallet
# real es el rehen si el gate regresara).
post "$BASE/wallet/import" '{"recoveryPhrase":"a b c d e f g h i j k l"}' 10
G1=$CODE
if [ "$G1" = "401" ] || [ "$G1" = "503" ]; then ok wallet-tabs-02-import-no-key-cerrado "code=$G1"
else bad wallet-tabs-02-import-no-key-cerrado "code=$G1"; fi
OUT=$(curl -s -m 10 -X POST -H 'Content-Type: application/json' -H 'X-API-Key: clave-incorrecta-de-prueba' -d '{"recoveryPhrase":"a b c d e f g h i j k l"}' -w $'\n%{http_code}' "$BASE/wallet/import" 2>/dev/null)
G2="${OUT##*$'\n'}"
if [ "$G2" = "401" ] || [ "$G2" = "503" ]; then ok wallet-tabs-03-import-wrong-key-cerrado "code=$G2"
else bad wallet-tabs-03-import-wrong-key-cerrado "code=$G2"; fi
if { [ "$G1" = "401" ] || [ "$G1" = "503" ]; } && { [ "$G2" = "401" ] || [ "$G2" = "503" ]; }; then
  OUT=$(curl -s -m 10 -X POST -H 'X-API-Key: clave-incorrecta-de-prueba' -w $'\n%{http_code}' "$BASE/wallet/forget" 2>/dev/null)
  G3="${OUT##*$'\n'}"
  if [ "$G3" = "401" ] || [ "$G3" = "503" ]; then ok wallet-tabs-04-forget-wrong-key-cerrado "code=$G3"
  else bad wallet-tabs-04-forget-wrong-key-cerrado "code=$G3 REVISAR YA: gate de forget"; fi
else
  skip wallet-tabs-04-forget-wrong-key-cerrado "gate de import fallo; no se toca forget"
fi

# wallet-tabs-08: sin churn de pestanas en 30 min (patron corregido: el log real
# es "newPage attempt N/6", y grep -c || echo imprimia doble).
C=$(echo "$LOGS30" | grep -Ec 'newPage attempt [2-6]/6|Failed to open a new tab|could not open a tab after' || true)
if [ "${C:-1}" -eq 0 ]; then ok wallet-tabs-08-no-newpage-churn ""
else bad wallet-tabs-08-no-newpage-churn "matches=$C"; fi

# ============================================================ OPS (solo lectura)
# ops-01: los seis endpoints de debug en 404 (produccion = AGENT_DEBUG false).
DBGFAIL=""
for ep in /debug/tabs /debug/balance-dom /debug/price-sources /debug/dialog /debug/click /trade/debug; do
  C=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$BASE$ep")
  [ "$C" = "404" ] || DBGFAIL="$DBGFAIL $ep=$C"
done
if [ -z "$DBGFAIL" ]; then ok ops-01-debug-endpoints-404 "6/6"
else bad ops-01-debug-endpoints-404 "$DBGFAIL"; fi

# ops-02: la X-API-Key de wallet no abre los endpoints de debug.
C=$(curl -s -o /dev/null -m 15 -H 'X-API-Key: cualquiera' -w '%{http_code}' "$BASE/debug/tabs")
if [ "$C" = "404" ]; then ok ops-02-debug-no-key-bypass ""
else bad ops-02-debug-no-key-bypass "code=$C"; fi

# ops-03: preflight CORS respondido con reflejo de Origin y X-API-Key permitida.
H=$(curl -s -m 10 -X OPTIONS -H 'Origin: http://sentinel014' -H 'Access-Control-Request-Method: GET' -D - -o /dev/null -w 'CODE:%{http_code}' "$BASE/price")
if echo "$H" | grep -q 'CODE:204' && echo "$H" | grep -qi 'Access-Control-Allow-Origin: http://sentinel014' && echo "$H" | grep -qi 'X-API-Key'; then
  ok ops-03-cors-preflight ""
else bad ops-03-cors-preflight "$(echo "$H" | tr '\r\n' ' ' | head -c 120)"; fi

# ops-05: noVNC (6080) cerrado en regimen (captura de exit correcta: $? del curl).
curl -s -o /dev/null -m 5 "http://localhost:6080/"; EC=$?
if [ "$EC" -ne 0 ]; then ok ops-05-novnc-closed "curl exit=$EC"
else bad ops-05-novnc-closed "6080 RESPONDE: hay sesion noVNC abierta"; fi

# ops-06: renderers == 3 (pagina + extension + about; estable desde la linea base).
R=$(docker exec "$CONTAINER" pgrep -fc 'type=renderer' 2>/dev/null || echo -1)
if [ "$R" = "3" ]; then ok ops-06-renderer-count "3"
else bad ops-06-renderer-count "renderers=$R (linea base: 3)"; fi

# ops-07: techos de recursos, comparados mecanicamente. Mem < 2048MiB; disco < 85%.
MEM=$(docker stats --no-stream --format '{{.MemUsage}}' "$CONTAINER" | awk '{v=$1; if (v ~ /GiB/) {gsub(/GiB/,"",v); v=v*1024} else gsub(/MiB/,"",v); printf "%d", v}')
DSK=$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
if [ "${MEM:-9999}" -lt 2048 ] && [ "${DSK:-100}" -lt 85 ]; then
  ok ops-07-resource-ceilings "mem=${MEM}MiB disco=${DSK}%"
else bad ops-07-resource-ceilings "mem=${MEM}MiB disco=${DSK}%"; fi

# ops-08: higiene de logs mecanica (30 min): cero patrones letales y ninguna
# linea repetida >=8 veces. Del conteo de repeticiones se EXCLUYEN los warns de
# reintento best-effort que el sistema emite por diseno bajo churn (el warmer
# reintenta cada tick; una pasada de la bateria con 3 activos los produce a
# docenas sin que nada este roto) — para la muerte real del warmer el detector
# correcto es freshestAgeMs (health-02/06), no contar lineas. Tambien se excluye
# el banner de arranque (una linea de '=' por cada boot legitimo).
LETHAL=$(echo "$LOGS30" | grep -Ec 'FATAL|profile appears to be in use|__name is not defined|Uncaught Exception' || true)
TOPDUP=$(echo "$LOGS30" | grep -v '^\s*$' \
  | grep -vE '\[refreshPrice\] No valid price|\[fetchBalancesFromUI\] Page is not ready|^====' \
  | sort | uniq -c | sort -rn | awk 'NR==1{print $1+0}')
if [ "${LETHAL:-1}" -eq 0 ] && [ "${TOPDUP:-0}" -lt 8 ]; then
  ok ops-08-log-hygiene "peorRepeticion=${TOPDUP:-0}"
else bad ops-08-log-hygiene "letales=$LETHAL peorRepeticion=${TOPDUP:-0}"; fi

# ops-12: /trade/update sin asset -> 400 inmediato (validacion antes del navegador).
post "$BASE/trade/update" '{}' 10
if [ "$CODE" = "400" ] && tlt "$TIME" 1; then ok ops-12-trade-update-400 "${TIME}s"
else bad ops-12-trade-update-400 "code=$CODE t=${TIME}s"; fi

# trade-02: /trade/estimate con body invalido -> 400 inmediato.
post "$BASE/trade/estimate" '{}' 10
if [ "$CODE" = "400" ] && tlt "$TIME" 1; then ok trade-02-estimate-invalid-400 "${TIME}s"
else bad trade-02-estimate-invalid-400 "code=$CODE t=${TIME}s"; fi

# ops-13: swagger montado (un 404 delataria swagger.yaml roto en el boot).
C=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$BASE/api-docs/")
CT=$(curl -s -m 10 -D - -o /dev/null "$BASE/swagger-custom.js" | grep -i '^Content-Type:' | tr -d '\r')
if { [ "$C" = "200" ] || [ "$C" = "301" ]; } && echo "$CT" | grep -qi 'javascript'; then
  ok ops-13-swagger-mounted "api-docs=$C"
else bad ops-13-swagger-mounted "api-docs=$C ct=$CT"; fi

# ops-14: allowlist de origen ACTIVA en rutas de trade. Desde dentro del host no
# existe un origen no autorizado que probar: Docker reescribe todo lo local
# (loopback, hairpin, cross-bridge) a la gateway del compose (172.18.0.1), que
# por eso mismo tiene que estar en la lista. Este test verifica configuracion +
# arranque con el gate cargado; el NEGATIVO real (403) exige un host LAN no
# listado y esta documentado como verificacion externa en el plan (se comprobo
# manualmente el 2026-08-21: host fuera de lista -> 403, sentinel014 y
# workstation -> pasan).
AL=$(docker exec "$CONTAINER" printenv TRADE_ALLOWED_IPS 2>/dev/null || true)
BANNER=$(docker logs "$CONTAINER" 2>&1 | grep -Fc '[allowlist] Restricting trade-capable endpoints' || true)
if [ -z "$AL" ]; then
  bad ops-14-source-allowlist "TRADE_ALLOWED_IPS sin configurar: trade abierto a toda la LAN"
elif [ "${BANNER:-0}" -ge 1 ]; then
  ok ops-14-source-allowlist "activa: $AL"
else
  bad ops-14-source-allowlist "env presente pero sin banner de arranque del gate"
fi

# trade-04: /trade/info de solo lectura responde con count coherente.
get "$BASE/trade/info" 90
if [ "$CODE" = "200" ] && [ "$(jqv .count)" = "$(jqv '.positions | length')" ]; then
  ok trade-04-info-readonly "count=$(jqv .count)"
else bad trade-04-info-readonly "code=$CODE count=$(jqv .count) len=$(jqv '.positions | length')"; fi

# ============================================================ --flap (opt-in, 100s)
if $FLAP; then
  # health-03: protocolo acordado — 3 assets cada 2s durante 100s, /health nunca 503.
  # Criterio de ALERTA, no de cero absoluto: bajo esta carga jup.ag tiene baches
  # reales de 40-80s sin lectura valida y el gate puede cruzar su umbral una
  # muestra aislada — eso es el detector funcionando en el borde, no la
  # enfermedad. La enfermedad historica era 36/40 en 503 SOSTENIDO. Fallo real:
  # dos 503 consecutivos (degradacion mantenida) o mas de dos en total.
  N200=0; N503=0; CONSEC=0; MAXCONSEC=0
  for a in SOL WBTC ETH; do
    ( end=$((SECONDS+100)); while [ $SECONDS -lt $end ]; do curl -s -m 30 "$BASE/price?asset=$a" > /dev/null; sleep 2; done ) &
  done
  sleep 8
  end=$((SECONDS+90))
  while [ $SECONDS -lt $end ]; do
    C=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$BASE/health")
    if [ "$C" = "200" ]; then N200=$((N200+1)); CONSEC=0
    else N503=$((N503+1)); CONSEC=$((CONSEC+1)); [ "$CONSEC" -gt "$MAXCONSEC" ] && MAXCONSEC=$CONSEC; fi
    sleep 2
  done
  wait
  if [ "$MAXCONSEC" -le 1 ] && [ "$N503" -le 2 ] && [ "$N200" -ge 30 ]; then
    ok health-03-no-flap-3assets "muestras=$((N200+N503)) 503s=$N503 (maxConsecutivos=$MAXCONSEC)"
  else bad health-03-no-flap-3assets "200s=$N200 503s=$N503 maxConsecutivos=$MAXCONSEC"; fi
else
  skip health-03-no-flap-3assets "requiere --flap (100s)"
fi

# ============================================================ --restart (opt-in)
# UNA sola ventana de reinicio que encadena todas las aserciones post-reinicio
# (28: antes eran 6 reinicios independientes = 6 cortes de servicio).
if $RESTART; then
  : "${BASE:?}"   # 49: jamas reiniciar con BASE rota
  A0=$(curl -s -m 30 "$BASE/wallet/status" | jq -r .address)
  T0=$(date -u +%Y-%m-%dT%H:%M:%S)
  docker restart "$CONTAINER" > /dev/null || halt "restart: docker restart fallo"
  # Recuperacion de /health en <=180s.
  RECOVERED=false
  for i in $(seq 1 36); do
    C=$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$BASE/health" 2>/dev/null)
    [ "$C" = "200" ] && { RECOVERED=true; break; }
    sleep 5
  done
  if $RECOVERED; then ok restart-01-health-recovers "en <=$((i*5))s"
  else
    docker ps -a | head -3; docker logs "$CONTAINER" --tail 60
    bad restart-01-health-recovers "sin 200 en 180s"
    halt "restart: el contenedor no se recupero — NO se ejecutan mas pruebas (42)"
  fi
  # price-12: primera lectura fria dentro del presupuesto (25s + margen).
  get "$BASE/price?asset=SOL" 40
  if [ "$CODE" = "200" ] && tlt "$TIME" 32; then ok restart-02-first-cold-read "t=${TIME}s"
  else bad restart-02-first-cold-read "code=$CODE t=${TIME}s"; fi
  # balance-05: el dialogo de terminos NO reaparece (user_data persiste). Solo la
  # linea exacta de aceptacion cuenta (19: el patron ancho matcheaba warns benignos).
  ACCEPTS=$(docker logs "$CONTAINER" --since "$T0" 2>&1 | grep -Fc "Accepted Jupiter's terms dialog" || true)
  if [ "${ACCEPTS:-1}" -eq 0 ]; then ok restart-03-terms-not-reaccepted ""
  else bad restart-03-terms-not-reaccepted "acceptances=$ACCEPTS (la persistencia del perfil fallo)"; fi
  # balance-04/bootstrap: el cache de balances se repuebla (bootstrap 10s, margen 120s).
  BOOTOK=false
  for i in $(seq 1 24); do
    HD=$(curl -s -m 20 "$BASE/wallet/balance" | jq -r .hasData 2>/dev/null)
    [ "$HD" = "true" ] && { BOOTOK=true; break; }
    sleep 5
  done
  if $BOOTOK; then ok restart-04-balances-repopulate "en <=$((i*5))s"
  else bad restart-04-balances-repopulate "hasData sigue false a los 120s"; fi
  # wallet-tabs-11: reconexion silenciosa del ConnKeeper (address identica, 21/46).
  sleep 60
  A1=$(curl -s -m 30 "$BASE/wallet/status" | jq -r .address)
  if [ "$A1" = "$A0" ] && [ "$A1" != "None" ] && [ "$A1" != "Unknown" ] && [ -n "$A1" ]; then
    ok restart-05-connkeeper-reconnect "addr intacta"
  else bad restart-05-connkeeper-reconnect "antes=$A0 despues=$A1"; fi
  # ops-09: arranque limpio — sin locks de perfil ni churn de pestanas desde T0 (23: solo desde T0).
  BOOTLOGS=$(docker logs "$CONTAINER" --since "$T0" 2>&1)
  BL=$(echo "$BOOTLOGS" | grep -Ec 'profile appears to be in use|Failed to open a new tab|could not open a tab after' || true)
  R=$(docker exec "$CONTAINER" pgrep -fc 'type=renderer' 2>/dev/null || echo -1)
  if [ "${BL:-1}" -eq 0 ] && [ "$R" = "3" ]; then ok restart-06-clean-boot "renderers=3"
  else bad restart-06-clean-boot "locks/churn=$BL renderers=$R"; fi
else
  skip restart-window "requiere --restart (1 corte de servicio de ~2-4 min)"
fi

# ============================================================ --debug-window (opt-in)
# Ventana AGENT_DEBUG=true con restauracion GARANTIZADA por trap (27/36): pase lo
# que pase, .env vuelve a su estado y el contenedor se recrea con debug apagado.
if $DEBUGWIN; then
  : "${BASE:?}"
  (
    set -e
    cd "$COMPOSE_DIR"
    cp .env .env.bak.battery
    trap 'cd "'"$COMPOSE_DIR"'"; [ -f .env.bak.battery ] && mv -f .env.bak.battery .env; docker compose up -d > /dev/null 2>&1' EXIT
    sed -i 's/^AGENT_DEBUG=.*/AGENT_DEBUG=true/' .env
    docker compose up -d > /dev/null 2>&1
    # || true: bajo set -e, el reset de conexion del contenedor arrancando (curl 56/7)
    # mataba el subshell en la primera iteracion del bucle de espera.
    for i in $(seq 1 36); do
      C=$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$BASE/health" 2>/dev/null || true); [ "$C" = "200" ] && break; sleep 5
    done
    sleep 15
    # wallet-tabs-07: exactamente 2 pestanas (phantom + trading).
    TABS=$(curl -s -m 60 "$BASE/debug/tabs")
    echo "$TABS" | jq -e '.tabCount == 2
      and ([.tabs[] | select(.kind=="phantom")] | length == 1)
      and ([.tabs[] | select(.kind=="trading")] | length == 1)' > /dev/null
    # 15: los endpoints de debug de solo lectura tambien funcionan (no estan rotos por __name).
    curl -s -m 60 "$BASE/debug/price-sources" | jq -e '.title | length > 0' > /dev/null
  )
  DBGRC=$?
  # Verificacion post-ventana: la restauracion REALMENTE ocurrio.
  for i in $(seq 1 36); do
    C=$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$BASE/health" 2>/dev/null); [ "$C" = "200" ] && break; sleep 5
  done
  C404=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$BASE/debug/tabs")
  if [ "$DBGRC" -eq 0 ] && [ "$C404" = "404" ]; then ok debug-window-tabs-and-endpoints "2 tabs; debug restaurado a 404"
  elif [ "$C404" != "404" ]; then bad debug-window-tabs-and-endpoints "CRITICO: /debug/tabs=$C404 — AGENT_DEBUG quedo abierto"
  else bad debug-window-tabs-and-endpoints "aserciones de la ventana fallaron (rc=$DBGRC)"; fi
else
  skip debug-window "requiere --debug-window (2 recreaciones del contenedor)"
fi

# ============================================================ battery-99: gate final
# Produccion debe quedar EXACTAMENTE como la encontramos.
E99=""
get "$BASE/health" 20;                       [ "$CODE" = "200" ] || E99="$E99 health=$CODE"
A9=$(curl -s -m 30 "$BASE/wallet/status" | jq -r .address)
for i in $(seq 1 12); do  # la address tarda en volver tras recrear el contenedor (ConnKeeper)
  [ "$A9" = "$SNAP_ADDR" ] && break; sleep 10
  A9=$(curl -s -m 30 "$BASE/wallet/status" | jq -r .address)
done
[ "$A9" = "$SNAP_ADDR" ] || E99="$E99 addr:$SNAP_ADDR->$A9"
C9=$(curl -s -m 90 "$BASE/trade/info" | jq -r .count);      [ "$C9" = "$SNAP_COUNT" ] || E99="$E99 posiciones:$SNAP_COUNT->$C9"
if ! $DEBUGWIN; then  # con --debug-window el .env se restaura por copia: el hash debe coincidir igual
  E9=$(sha256sum "$COMPOSE_DIR/.env" | cut -d' ' -f1);      [ "$E9" = "$SNAP_ENV" ] || E99="$E99 .env-modificado"
else
  E9=$(sha256sum "$COMPOSE_DIR/.env" | cut -d' ' -f1);      [ "$E9" = "$SNAP_ENV" ] || E99="$E99 .env-NO-restaurado"
fi
C9=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$BASE/debug/tabs"); [ "$C9" = "404" ] || E99="$E99 debug-abierto=$C9"
curl -s -o /dev/null -m 5 "http://localhost:6080/" && E99="$E99 6080-abierto"
R9=$(docker exec "$CONTAINER" pgrep -fc 'type=renderer' 2>/dev/null || echo -1); [ "$R9" = "3" ] || E99="$E99 renderers=$R9"
if [ -z "$E99" ]; then ok battery-99-epilogue-gate "prod intacta"
else bad battery-99-epilogue-gate "$E99"; fi

# ============================================================ resumen
echo "----------------------------------------------------------------------"
echo "RESULTADO: $PASS pass, $FAIL fail, $SKIP skip"
[ -n "$FAILED_IDS" ] && echo "Fallidos:$FAILED_IDS"
[ "$FAIL" -eq 0 ]
