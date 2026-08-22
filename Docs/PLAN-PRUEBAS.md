# Plan de pruebas — PRC Agent Jupiter

> Generado el 2026-08-21 a partir de un inventario exhaustivo del codigo (6 lectores paralelos sobre
> src/, swagger.yaml, Dockerfile/compose y el historial de commits), 68 pruebas derivadas por area y
> una doble critica adversarial (completitud + seguridad) con 58 hallazgos incorporados.
> Runner automatizado: `scripts/test-battery.sh` (se ejecuta EN sentinel016).

## Objetivo

Garantizar mecanicamente los comportamientos acordados y verificados en produccion:

1. **Precio**: cache caliente en ms, `stale` honesto, lecturas frias dentro de 25s, activos
   desconocidos rechazados (jamas el precio de otro activo bajo un nombre equivocado).
2. **Health**: 200 mientras la maquinaria vive; 503 solo con maquinaria muerta; sin falsas alarmas
   bajo sondeo multi-activo (medido: de 36/40 muestras 503 a 0/40).
3. **Balances**: poblados desde la UI, cero real distinguible de "nunca cargo", dialogo de terminos
   aceptado una sola vez y persistido, fail-fast con bloqueador nombrado.
4. **Wallet/pestanas**: exactamente 2 pestanas, Phantom persistente en background, jup.ag siempre
   al frente, popup de aprobacion protegido durante aprobaciones, gates de clave fallan cerrados.
5. **Operacion**: endpoints de debug en 404, recursos acotados, arranques limpios, doc coherente.

## Politica de riesgo (obligatoria)

| Riesgo | Politica |
|---|---|
| solo-lectura | Pasada por defecto del runner. Sin efectos. |
| muta-estado | Solo con bandera explicita (`--restart`, `--debug-window`). El filtro es el RIESGO, **nunca** el campo "automatizable". |
| requiere-fondos | **JAMAS automatizado.** Protocolo manual con humano presente y criterios de aborto. |
| destructivo | No existe en esta bateria y no debe existir. |

## Orquestacion

- Ejecucion **estrictamente serial**; jamas dos pasadas concurrentes ni durante trades manuales.
- La bateria abre con **battery-00** (snapshot: posiciones, address, sha256 de .env, renderers;
  si /health no es 200 se aborta todo) y cierra con **battery-99** (gate: produccion debe quedar
  EXACTAMENTE igual; cualquier divergencia bloquea futuras pasadas hasta revision humana).
- Los reinicios estan **consolidados en UNA ventana** (`--restart`): un solo corte de servicio
  encadena las 6 aserciones post-reinicio que antes eran 6 reinicios independientes.
- Las ventanas de AGENT_DEBUG usan **trap de restauracion garantizada**: pase lo que pase, .env
  vuelve y el contenedor se recrea con debug apagado; el epilogo verifica el 404.
- `price-03` exige 130s sin demanda de ETH: con consumidores activos es INCONCLUSO, no FALLO.
- Antes de cualquier trade manual: una lectura /price exitosa (resetea el contador de self-healing).

## Como ejecutar

```bash
export BASE=http://localhost:3011
~/prc-agent-jupiter/scripts/test-battery.sh                 # solo lectura (defecto)
~/prc-agent-jupiter/scripts/test-battery.sh --flap          # + anti-flapping (100s)
~/prc-agent-jupiter/scripts/test-battery.sh --restart       # + ventana unica de reinicio
~/prc-agent-jupiter/scripts/test-battery.sh --debug-window  # + ventana AGENT_DEBUG
```

Cadencia sugerida: defecto en cada despliegue; `--flap` semanal; `--restart` y
`--debug-window` mensuales o tras cambios en browser/phantom/balances.

## Linea base de referencia (2026-08-21)

/health 200 · balances hasData:true · 2 pestanas (phantom+trading) · 3 renderers ·
MEM ~1.6GiB/2.76GiB · anti-flapping 40/40 · wallet 2e16..NbKP conectada.

---

## Area: balance

### balance-01-populated-fresh-fast
**Balance poblado en régimen estable: hasData:true, stale:false, lastUpdated reciente y respuesta rápida (solo caché)**

- Prioridad: P0 · Riesgo: solo-lectura
- Runner: `balance-01`
- Precondiciones: Servicio arriba >3 minutos, wallet importada (wallet_address.txt presente / /wallet/status devuelve address real), startBalanceUpdates corriendo (arranque normal).
- Pasos: Ejecutar: curl -s -m 10 "$BASE/wallet/balance" y evaluar el JSON.
- Esperado: HTTP 200. Campos exactos: "hasData":true, "stale":false, "lastUpdated" numérico con (now_ms - lastUpdated) < 125000 (2x BALANCE_REFRESH_INTERVAL), "wallet" distinto de "Unknown" y de "None", "balances" contiene la clave "SOL", y "durationMs" < 1500 (la ruta sirve solo de caché, no toma el page lock).

### balance-02-tokens-param-subset
**Parámetro tokens=CSV limita las claves devueltas y SOL siempre está presente**

- Prioridad: P1 · Riesgo: solo-lectura
- Runner: `balance-02`
- Precondiciones: Igual que balance-01 (caché de balances poblada, hasData:true).
- Pasos: Ejecutar: curl -s -m 10 "$BASE/wallet/balance?tokens=SOL,USDC" y evaluar el JSON.
- Esperado: HTTP 200. Toda clave de "balances" pertenece al conjunto {SOL,USDC} (ninguna clave WBTC ni ETH). La clave "SOL" existe siempre (aunque su valor sea "0"). "hasData":true.

### balance-03-zero-filtering-non-sol
**Filtrado de ceros: tokens no-SOL con balance 0 no aparecen; SOL se conserva aunque sea 0**

- Prioridad: P2 · Riesgo: solo-lectura
- Runner: **pendiente de automatizar**
- Precondiciones: Caché poblada (hasData:true). Se conoce qué tokens tienen saldo real >0 en la wallet de prueba.
- Pasos: Ejecutar: curl -s -m 10 "$BASE/wallet/balance" (default SOL,WBTC,ETH,USDC) y revisar las claves de balances.
- Esperado: HTTP 200. Para cada clave distinta de "SOL" presente en "balances", su valor numérico (tras quitar comas) es > 0. "SOL" está presente siempre. Ninguna clave no-SOL tiene valor "0".

### balance-04-never-loaded-window-after-restart
**Distinción cero-real vs nunca-cargado: ventana inmediata post-restart reporta hasData:false y stale:true**

- Prioridad: P1 · Riesgo: muta-estado
- Runner: `restart-04 (ventana --restart, criterio tolerante a la carrera)`
- Precondiciones: Contenedor prc-agent-jupiter corriendo en sentinel016. Aviso: el restart vacía la caché de precios y balances en memoria; ejecutar fuera de horario crítico. No requiere rebuild (no hay cambio de código).
- Pasos: docker restart prc-agent-jupiter; reintentar curl a /wallet/balance cada 2s hasta que la API responda (máx 20s) y capturar la PRIMERA respuesta válida, antes de que el primer scrapeo termine.
- Esperado: La primera respuesta 200 tras el restart tiene exactamente: "hasData":false, "stale":true, "lastUpdated":null, y "balances" contiene solo {"SOL":"0"} (los demás tokens en 0 se filtran). Es decir: un "0" con hasData:false se identifica como 'nunca cargado', no como cero real.

### balance-05-terms-dialog-persistence-and-bootstrap
**El diálogo 'Acknowledge Terms and Conditions' NO reaparece tras reiniciar el contenedor y los balances se repueblan en fase bootstrap**

- Prioridad: P0 · Riesgo: muta-estado
- Runner: `restart-03 (grep exacto de la linea "Accepted Jupiter’s terms dialog")`
- Precondiciones: El diálogo de términos ya fue aceptado una vez con 'Do not show again' (persistido en el volumen ./user_data). Contenedor prc-agent-jupiter en sentinel016. Ejecutar DESPUÉS de balance-04 o en su lugar (comparten el restart).
- Pasos: docker restart prc-agent-jupiter; sondear /wallet/balance cada 5s hasta hasData:true (máx 180s, cubre carga de página + cadencia bootstrap de 10s); después inspeccionar docker logs desde el restart buscando líneas del manejador de términos.
- Esperado: 1) "hasData":true se alcanza en <=180s desde el restart y en esa respuesta "stale":false y "balances" contiene "SOL". 2) El grep de logs desde el restart imprime NO_TERMS_ACCEPT: cero líneas que indiquen que se hizo clic en 'Accept and Continue' (acknowledgeTermsDialog devolvió true). Si aparece una línea de aceptación, la persistencia en user_data está rota y el test FALLA.

### balance-06-steady-refresh-cadence-60s
**Cadencia de refresco en régimen estable: lastUpdated avanza al menos una vez en 70 segundos**

- Prioridad: P1 · Riesgo: solo-lectura
- Runner: **pendiente de automatizar**
- Precondiciones: Régimen estable: hasData:true desde hace >2 minutos (fuera de fase bootstrap). Sin sesión de onboarding/VNC activa (maintenanceMode pausaría los ciclos).
- Pasos: Tomar una muestra de /wallet/balance, esperar 70s (BALANCE_REFRESH_INTERVAL=60s + margen), tomar segunda muestra; comparar lastUpdated.
- Esperado: Ambas respuestas 200 con "hasData":true. lastUpdated de la muestra B es estrictamente mayor que el de la muestra A (hubo al menos un ciclo de refresco en la ventana de 70s). En la muestra B, (now_ms - lastUpdated) < 70000 y "stale":false.

### balance-07-health-meta-consistency
**Coherencia entre /health.balance y /wallet/balance: mismos hasData, stale y lastUpdated**

- Prioridad: P1 · Riesgo: solo-lectura
- Runner: `balance-07`
- Precondiciones: Servicio arriba; da igual si la caché está poblada o no (el test valida coherencia, no frescura).
- Pasos: Consultar /health (sin deep, no toca el navegador) y /wallet/balance en secuencia inmediata; comparar el objeto balance de /health con los campos planos de /wallet/balance.
- Esperado: Ambas 200 (o /health 503 con payload JSON, se acepta). health.balance.hasData == wallet.hasData, health.balance.stale == wallet.stale, y |health.balance.lastUpdated - wallet.lastUpdated| <= 65000 (a lo sumo un ciclo de refresco entre ambas lecturas; iguales si ningún ciclo cayó en medio). Si ambos lastUpdated son null, también pasa.

### balance-08-covered-button-fail-fast-log-audit
**Ruta fail-fast de botón cubierto: los skips nombran al blocker y no hay timeouts de 5s del click sin blocker identificado**

- Prioridad: P2 · Riesgo: solo-lectura
- Runner: `balance-08`
- Precondiciones: Contenedor con logs de al menos 24h disponibles (docker logs es de solo lectura). El escenario de botón cubierto puede no haber ocurrido — el test audita el formato cuando ocurre, no fuerza el escenario.
- Pasos: Extraer de docker logs (últimas 24h) las líneas del scraper de balances relacionadas con blockers y con timeouts del click del token selector; auditar su formato.
- Esperado: Criterio mecánico sobre la salida del grep: (a) cero líneas con 'Timeout 5000' (o el valor de BALANCE_CLICK_TIMEOUT_MS) que NO lleven antepuesta una descripción de blocker — todo timeout del click debe empezar nombrando al elemento que cubre; (b) toda línea de skip del click contiene una descripción no vacía del blocker con forma '<tag.clases>' o 'a zero-sized element'. Si el grep no devuelve ninguna línea (salida NO_BLOCKER_EVENTS), el test pasa vacío (escenario no ocurrió en la ventana).

### balance-09-unknown-token-negative
**Negativo: token desconocido en tokens= no inventa saldo — se resuelve como 0 y se filtra de la respuesta**

- Prioridad: P2 · Riesgo: solo-lectura
- Runner: `balance-09`
- Precondiciones: Caché de balances poblada (hasData:true).
- Pasos: Ejecutar: curl -s -m 10 "$BASE/wallet/balance?tokens=NOEXISTE,SOL" y revisar las claves de balances.
- Esperado: HTTP 200 (la ruta no valida el símbolo: getBalances devuelve '0' para tokens ausentes de caché). "balances" NO contiene la clave "NOEXISTE" (0 no-SOL se filtra) y SÍ contiene "SOL". Ningún valor inventado bajo el nombre desconocido. "hasData":true se mantiene.

## Area: ops

### ops-01-debug-endpoints-404
**Los seis endpoints de debug devuelven 404 con AGENT_DEBUG=false**

- Prioridad: P0 · Riesgo: solo-lectura
- Runner: `ops-01`
- Precondiciones: Contenedor prc-agent-jupiter en marcha con la configuración de producción (AGENT_DEBUG sin definir o distinto de 'true'). API accesible en $BASE.
- Pasos: Ejecutar un curl por cada endpoint de debug y capturar solo el código HTTP: /debug/tabs, /debug/balance-dom, /debug/price-sources, /debug/dialog, /debug/click, /trade/debug.
- Esperado: Seis líneas, cada una con código exactamente 404 (el gate requireDebug oculta en vez de responder 401/403). Ningún endpoint responde 200 ni 500. Ninguna llamada debe tocar el navegador (durationMs no aparece porque no hay cuerpo 200).

### ops-02-debug-gate-key-no-bypass
**La X-API-Key de wallet NO abre los endpoints de debug (negativo)**

- Prioridad: P1 · Riesgo: solo-lectura
- Runner: `ops-02`
- Precondiciones: AGENT_DEBUG=false en el contenedor. No hace falta conocer la clave real: cualquier valor sirve porque el gate de debug no consulta claves.
- Pasos: Llamar a /debug/tabs con cabecera X-API-Key con un valor arbitrario y capturar código y cuerpo.
- Esperado: Código exactamente 404 y cuerpo {"error":"Not found"}. La clave de wallet no debe cambiar el resultado: el gate de debug depende solo de la variable de entorno, nunca de cabeceras.

### ops-03-cors-preflight
**El preflight CORS se responde con 204 y refleja el Origin**

- Prioridad: P1 · Riesgo: solo-lectura
- Runner: `ops-03`
- Precondiciones: API en marcha en $BASE.
- Pasos: Enviar OPTIONS a /price con Origin arbitrario, Access-Control-Request-Method: GET y Access-Control-Request-Headers: X-API-Key; inspeccionar cabeceras de respuesta.
- Esperado: Código exactamente 204 sin cuerpo. Cabeceras presentes: Access-Control-Allow-Origin igual al Origin enviado (http://test.example), Vary: Origin, Access-Control-Allow-Methods conteniendo GET y POST, Access-Control-Allow-Headers conteniendo X-API-Key, Access-Control-Max-Age: 600.

### ops-04-browser-screenshot
**/browser/screenshot responde 200 con textos de la página**

- Prioridad: P2 · Riesgo: muta-estado
- Runner: **pendiente de automatizar**
- Precondiciones: Servicio sano (/health 200) y página jup.ag cargada. Nota: el endpoint hace bringToFront sobre la pestaña de trading (estado deseado en régimen) y escribe jup_screenshot.png dentro del proyecto — por eso se clasifica muta-estado aunque sea benigno.
- Pasos: GET /browser/screenshot con timeout amplio (60s) y validar la forma del JSON.
- Esperado: Código 200 con JSON que contiene: message (string), debugTexts (array, longitud entre 1 y 100 — debe contener al menos un texto con 'Price' o 'Connect') y durationMs (número < 60000). Un 500 aquí indica página muerta.

### ops-05-novnc-closed-steady-state
**Puerto 6080 (noVNC) rechaza conexiones sin sesión de onboarding activa**

- Prioridad: P2 · Riesgo: solo-lectura
- Runner: `ops-05 (exit code capturado justo tras curl)`
- Precondiciones: Ejecutar en el propio sentinel016 (el runner corre en el host). Ninguna sesión de onboarding abierta (no se ha llamado a /wallet/onboard-session).
- Pasos: curl a http://localhost:6080/ con timeout corto y capturar el código; el puerto está publicado por compose pero websockify solo corre durante una sesión.
- Esperado: code=000 (conexión rechazada/reseteada, curl exit != 0). Cualquier código HTTP 2xx/3xx/4xx indica que quedó un websockify vivo tras una sesión — fallo de higiene (stopVncSession no se ejecutó).

### ops-06-renderer-count
**El número de renderers de Chromium se mantiene en 3**

- Prioridad: P1 · Riesgo: solo-lectura
- Runner: `ops-06`
- Precondiciones: Contenedor prc-agent-jupiter en marcha al menos 5 minutos (estado estable, sin trade ni onboarding en curso). Ejecutar en sentinel016.
- Pasos: Contar procesos con '--type=renderer' dentro del contenedor (procps está instalado en la imagen).
- Esperado: Exactamente 3. Un valor mayor indica fuga de pestañas (el invariante es 2 pestañas: popup.html de Phantom + jup.ag, más el renderer de extensión); un valor creciente entre ejecuciones es fallo aunque una lectura puntual dé 3.

### ops-07-container-memory-ceiling
**Memoria del contenedor por debajo de 2 GiB**

- Prioridad: P1 · Riesgo: solo-lectura
- Runner: `ops-07 (+ techo de disco 85%)`
- Precondiciones: Contenedor en régimen estable (>10 min de uptime, warmer activo). Ejecutar en sentinel016 (host de ~2.76 GiB).
- Pasos: Leer docker stats sin stream para prc-agent-jupiter.
- Esperado: El primer valor de MemUsage < 2 GiB (referencia medida tras quitar el chart: ~0.96 GiB; valores 1.5-2 GiB son alerta amarilla, >= 2 GiB es fallo). El formato es 'X MiB|GiB / Y GiB': comparar mecánicamente el numerador convertido a MiB contra 2048.

### ops-08-log-hygiene-steady-state
**Sin errores repetitivos en los logs en régimen estable**

- Prioridad: P1 · Riesgo: solo-lectura
- Runner: `ops-08 (umbral mecanico: repeticion>=8 o patron letal)`
- Precondiciones: Contenedor con >= 15 minutos de uptime sin operaciones manuales (sin trades, sin onboarding, sin restarts) en esa ventana. Ejecutar en sentinel016.
- Pasos: Extraer los últimos 15 minutos de logs, filtrar líneas de error, agrupar por línea y contar repeticiones.
- Esperado: Cero líneas que contengan '[FATAL]'. Ninguna línea de error distinta repetida 5 o más veces en la ventana (un warn esporádico del warmer es tolerable; un error que se repite cada tick de 1s produciría cientos y es fallo). Cero apariciones de 'profile appears to be in use' y de '__name is not defined'.

### ops-09-restart-recovery
**Tras docker restart el servicio se recupera solo: health, wallet, balances, sin diálogo de términos**

- Prioridad: P0 · Riesgo: muta-estado
- Runner: `restart-01/06 (ventana --restart, logs acotados a --since T0)`
- Precondiciones: OPT-IN: interrumpe el servicio ~1-3 minutos. Ejecutar en sentinel016 fuera de horario de trading. Estado previo sano: /health 200 y wallet conectada. El volumen user_data debe conservar la aceptación de términos de sesiones previas.
- Pasos: docker restart prc-agent-jupiter; sondear /health cada 5s hasta 200 (máx 180s); esperar 120s adicionales (ConnKeeper arranca a +25s, bootstrap de balances cada 10s); leer /wallet/status, /health completo y el conteo de renderers.
- Esperado: 1) /health devuelve 200 en <= 180s desde el restart. 2) /wallet/status responde connected:true y address distinto de 'None' (reconexión silenciosa, sin popup). 3) En /health: balance.hasData:true y balance.stale:false — esto prueba que el diálogo 'Acknowledge Terms and Conditions' NO reapareció (persistió en user_data), porque si reapareciera el click de balances se saltaría y hasData seguiría false. 4) price.warmerRunning:true. 5) Conteo de renderers == 3 (exactamente 2 pestañas: Phantom persistente + jup.ag). 6) Los logs del arranque no contienen 'profile appears to be in use'.

### ops-10-rebuild-deploy-protocol
**Protocolo de rebuild: docker compose up -d --build recupera el servicio con el perfil intacto**

- Prioridad: P1 · Riesgo: muta-estado
- Runner: **manual**
- Precondiciones: MANUAL con humano presente (el build tarda minutos y recrea el contenedor con hostname nuevo — es exactamente el caso que dispara el bug histórico del SingletonLock). Sesión SSH a sentinel016 en el directorio del proyecto. Anotar antes: versión reportada por /health y balance.hasData.
- Pasos: 1) ssh a sentinel016 y cd al directorio del proyecto. 2) docker compose up -d --build. 3) Al terminar, sondear curl $BASE/health hasta 200. 4) docker logs prc-agent-jupiter desde el arranque: buscar 'profile appears to be in use' y 'Target page, context or browser has been closed'. 5) Verificar que /health.version coincide con la versión de package.json del código desplegado. 6) Esperar 3 min y comprobar balance.hasData:true y /wallet/status connected:true.
- Esperado: Build sin error; /health 200 en <= 180s tras el arranque del contenedor; CERO apariciones de 'profile appears to be in use' y de 'Target page, context or browser has been closed' en los 3 intentos de launch (clearProfileLocks con unlinkSync debe sobrevivir el cambio de hostname); version en /health igual a la de package.json (prueba de que el rebuild tomó el código — un restart plano no lo hace); balance.hasData:true y connected:true en <= 5 min; diálogo de términos ausente.

### ops-11-novnc-session-lifecycle
**Ciclo de sesión noVNC: 6080 abre al iniciar sesión y cierra al terminarla**

- Prioridad: P2 · Riesgo: muta-estado
- Runner: **manual**
- Precondiciones: MANUAL con humano presente: la sesión pone maintenanceMode y PAUSA el warmer de precios (los consumidores en sentinel014 verán precios envejecer). Requiere WALLET_API_KEY real. No ejecutar con BROWSER_HEADLESS activo (el display estaría vacío). Ventana corta (< 2 min).
- Pasos: 1) POST $BASE/wallet/onboard-session con cabecera X-API-Key correcta. 2) Verificar respuesta 200 con url, vncPassword y phantomOnboardingUrl. 3) curl -s -o /dev/null -w '%{http_code}' http://localhost:6080/vnc.html en sentinel016. 4) POST $BASE/wallet/onboard-session/close con X-API-Key. 5) Repetir el curl a 6080. 6) curl $BASE/price?asset=SOL y $BASE/health. Prueba negativa adicional: repetir el paso 1 con X-API-Key incorrecta antes de todo.
- Esperado: Con clave incorrecta: 401. Con clave correcta: 200 y JSON con url, vncPassword (string no vacío) y phantomOnboardingUrl. Durante la sesión: puerto 6080 responde HTTP 200 en /vnc.html. Tras close: 200 con address, y el curl a 6080 vuelve a code=000 (conexión rechazada — websockify parado). Después: /price?asset=SOL responde 200 en <= 25s (warmer reanudado) y /health vuelve a 200 con warmerRunning:true en <= 2 min.

## Area: wallet-tabs

### wallet-tabs-01-status-connected
**/wallet/status reporta direccion y conexion activa**

- Prioridad: P1 · Riesgo: solo-lectura
- Runner: `wallet-tabs-01`
- Precondiciones: Contenedor prc-agent-jupiter corriendo hace al menos 2 minutos con wallet importada; ninguna sesion de onboarding/mantenimiento activa.
- Pasos: Ejecutar: curl -s -m 30 "$BASE/wallet/status" y parsear el JSON de respuesta.
- Esperado: HTTP 200. JSON con campos: address (string distinta de "None" y de "Unknown", longitud entre 32 y 44 caracteres base58), connected == true, durationMs entero >= 0. Ningun otro codigo de estado es aceptable.

### wallet-tabs-02-import-missing-key-401
**/wallet/import sin cabecera X-API-Key es rechazado con 401**

- Prioridad: P0 · Riesgo: solo-lectura
- Runner: `wallet-tabs-02`
- Precondiciones: WALLET_API_KEY configurada en el .env del servidor (estado normal de produccion). El body se envia vacio a proposito: el gate de clave corre antes de cualquier validacion o efecto, asi que nada se importa ni se toca el perfil.
- Pasos: Ejecutar: curl -s -m 15 -X POST "$BASE/wallet/import" -H "Content-Type: application/json" -d '{}' SIN cabecera X-API-Key. Verificar codigo y que /wallet/status sigue reportando la misma address despues.
- Esperado: HTTP 401 exacto (no 400, no 503, no 200). El perfil no se toca: una llamada posterior a /wallet/status devuelve la misma address que antes con connected == true.

### wallet-tabs-03-import-wrong-key-401
**/wallet/import con X-API-Key incorrecta es rechazado con 401**

- Prioridad: P0 · Riesgo: solo-lectura
- Runner: `wallet-tabs-03`
- Precondiciones: WALLET_API_KEY configurada en el servidor. Se usa una clave deliberadamente invalida; el body vacio garantiza que aunque el gate fallara, la validacion de frase (400) frenaria antes de cualquier efecto.
- Pasos: Ejecutar: curl -s -m 15 -X POST "$BASE/wallet/import" -H "Content-Type: application/json" -H "X-API-Key: clave-invalida-bateria-test" -d '{}'.
- Esperado: HTTP 401 exacto. Prohibido que devuelva 400 (eso significaria que el gate dejo pasar la peticion hasta la validacion de body, un fallo del orden de comprobacion).

### wallet-tabs-04-forget-wrong-key-401
**/wallet/forget con X-API-Key incorrecta es rechazado con 401 y no borra nada**

- Prioridad: P0 · Riesgo: solo-lectura
- Runner: `wallet-tabs-04 (solo si 02 y 03 pasaron: la wallet real es el rehen)`
- Precondiciones: WALLET_API_KEY configurada en el servidor y wallet importada. NUNCA ejecutar este endpoint con la clave correcta en la bateria automatica.
- Pasos: Ejecutar: curl -s -m 15 -X POST "$BASE/wallet/forget" -H "X-API-Key: clave-invalida-bateria-test". Despues verificar con /wallet/status que la wallet sigue presente.
- Esperado: HTTP 401 exacto en /wallet/forget. Inmediatamente despues, GET /wallet/status devuelve HTTP 200 con connected == true y address distinta de "None" (prueba de que el perfil NO fue borrado).

### wallet-tabs-05-key-unset-fails-closed-503
**Sin WALLET_API_KEY configurada, import/forget fallan cerrado con 503 (no quedan abiertos)**

- Prioridad: P2 · Riesgo: muta-estado
- Runner: **manual**
- Precondiciones: Solo ejecucion manual y opt-in: requiere editar .env y recrear el contenedor en sentinel016. Hacer backup de .env antes. No ejecutar durante horario con posiciones abiertas.
- Pasos: 1) cp .env .env.bak en el directorio del proyecto en sentinel016. 2) Comentar la linea WALLET_API_KEY en .env. 3) docker compose up -d (recrear para que tome el env; un restart simple NO relee env_file). 4) Esperar 60s. 5) curl -s -m 15 -w '%{http_code}' -X POST "$BASE/wallet/import" -H 'Content-Type: application/json' -H 'X-API-Key: cualquiera' -d '{}' — anotar codigo. 6) Repetir contra /wallet/forget. 7) Restaurar: mv .env.bak .env && docker compose up -d. 8) Confirmar que con la clave restaurada una peticion sin clave vuelve a dar 401.
- Esperado: Pasos 5 y 6: HTTP 503 exacto en ambos endpoints (deshabilitados, no abiertos: un 200 o un 401 aqui es fallo critico). Paso 8: HTTP 401 tras restaurar. /price y /health deben seguir respondiendo 200 durante todo el ejercicio.

### wallet-tabs-06-debug-tabs-hidden-404
**/debug/tabs devuelve 404 con AGENT_DEBUG en su valor de produccion (false)**

- Prioridad: P0 · Riesgo: solo-lectura
- Runner: `ops-01 (incluido en los 6 endpoints)`
- Precondiciones: Contenedor en configuracion de produccion (AGENT_DEBUG sin definir o false). Este test ES el verificador de que el default de produccion esta restaurado tras cualquier sesion de diagnostico.
- Pasos: Ejecutar: curl -s -m 15 "$BASE/debug/tabs" y verificar codigo y body.
- Esperado: HTTP 404 exacto con body JSON {"error":"Not found"}. Un 200 aqui significa que AGENT_DEBUG=true quedo activo en produccion: fallo P0, restaurar de inmediato.

### wallet-tabs-07-two-tabs-steady-state
**Exactamente 2 pestanas en estado estable (phantom + trading), habilitando y restaurando AGENT_DEBUG**

- Prioridad: P1 · Riesgo: muta-estado
- Runner: `debug-window (--debug-window, trap de restauracion garantizada)`
- Precondiciones: Opt-in: recrea el contenedor dos veces. Definir COMPOSE_DIR apuntando al directorio del proyecto en sentinel016 (donde viven docker-compose.yml y .env). Ejecutar fuera de horario de trading. El comando hace backup de .env, activa AGENT_DEBUG=true, recrea, consulta /debug/tabs, restaura .env, recrea de nuevo y confirma el 404.
- Pasos: Ejecutar el comando unico (usa $COMPOSE_DIR y $BASE). Tras la primera recreacion espera 60s para que el navegador levante y se estabilicen las pestanas antes de consultar /debug/tabs.
- Esperado: La respuesta de /debug/tabs es HTTP 200 con tabCount == 2 exacto; en tabs[] hay exactamente un elemento con kind == "phantom" (url chrome-extension popup.html) y exactamente uno con kind == "trading" (url contiene jup.ag/perps); ninguno con closed == true; cero elementos kind "other" o "phantom-approval-popup". La verificacion final imprime restore_status:404 (AGENT_DEBUG restaurado a produccion). tabCount == 3 o mas es fuga de pestanas; tabCount == 1 significa que la pestana Phantom persistente murio.

### wallet-tabs-08-no-newpage-churn-logs
**Sin churn de newPage: la pestana Phantom se reutiliza entre ciclos de unlock**

- Prioridad: P2 · Riesgo: solo-lectura
- Runner: `wallet-tabs-08 (patron corregido: "newPage attempt [2-6]/6")`
- Precondiciones: Contenedor corriendo de forma continua al menos 30 minutos con trafico normal (el warmer y ConnKeeper generan ciclos de unlock; Phantom se auto-bloquea en reposo, asi que 30 min garantizan al menos un ciclo).
- Pasos: Leer los logs de los ultimos 30 minutos y contar apariciones del error de apertura de pestanas y de reintentos de openTabWithRetry.
- Esperado: El comando imprime exactamente 0. Cualquier valor > 0 indica que un unlock esta reabriendo pestanas en vez de reutilizar la pestana Phantom persistente (regresion del commit 716f5ab).

### wallet-tabs-09-renderer-count-three
**Numero de procesos renderer de Chromium estable en 3 (sin fuga de pestanas)**

- Prioridad: P2 · Riesgo: solo-lectura
- Runner: `ops-06 (unificado)`
- Precondiciones: Contenedor corriendo >= 5 minutos tras el arranque, sin aprobacion de wallet en vuelo (una aprobacion abre notification.html temporalmente y puede sumar un renderer legitimo).
- Pasos: Contar dentro del contenedor los procesos chromium con --type=renderer.
- Esperado: El comando imprime exactamente 3 (linea base medida en produccion para 2 pestanas + extension). 4 o mas sostenido = fuga de pestanas; menos de 3 = pestana Phantom o trading caida. Si hay duda, repetir a los 60s: el valor debe ser estable.

### wallet-tabs-10-front-tab-price-freshness
**jup.ag permanece como pestana frontal: las edades de precio servido ciclan bajas**

- Prioridad: P1 · Riesgo: solo-lectura
- Runner: `wallet-tabs-10 (reformulado: 20 muestras de freshestAgeMs<15s)`
- Precondiciones: Cache de SOL caliente (el comando hace una peticion de calentamiento y espera antes de muestrear). Sin trade en curso. Si Chromium estrangulara los timers de jup.ag por estar en background, las edades crecerian monotonamente en vez de ciclar cerca de 0.
- Pasos: Peticion de calentamiento a /price?asset=SOL (hasta 30s por si es lectura fria), espera 5s, luego 30 muestras cada 2s guardando cada JSON en una linea.
- Esperado: Las 30 muestras devuelven HTTP 200 con "stale":false y ageMs < 15000. Al menos 27 de las 30 tienen ageMs < 5000 (el warmer relee el mercado en pantalla ~cada 1s). Ninguna muestra con ageMs creciendo monotonicamente a lo largo de las 30 (eso indicaria pagina estrangulada por perder el frente). Ninguna respuesta 500/503.

### wallet-tabs-11-connkeeper-reconnect-after-restart
**ConnKeeper reconecta la wallet en silencio tras reinicio del contenedor**

- Prioridad: P1 · Riesgo: muta-estado
- Runner: `restart-05 (captura la address ANTES de reiniciar)`
- Precondiciones: Opt-in: reinicia el contenedor (restart simple, mantiene hostname y codigo). Ejecutar fuera de horario con posiciones abiertas. jup.ag debe ser app de confianza en Phantom para que la reconexion no levante popup de aprobacion. Primer pase de ConnKeeper a +25s del listen; 120s dan margen para arranque de navegador + unlock + reconexion.
- Pasos: docker restart prc-agent-jupiter, esperar 120s SIN llamar a /connect ni a ningun endpoint de wallet, y consultar /wallet/status.
- Esperado: HTTP 200 con connected == true y address identica a la registrada antes del reinicio (32-44 chars, distinta de "None"/"Unknown"), sin haber invocado POST /connect manualmente. Adicional: /health devuelve 200 en ese momento y los logs del arranque no contienen "Failed to open a new tab".

## Area: price

### price-01-warm-cache-hit
**Cache hit caliente: segunda lectura de SOL responde de memoria en <=5ms**

- Prioridad: P0 · Riesgo: solo-lectura
- Runner: `price-01`
- Precondiciones: Servicio arriba en sentinel016 (puerto 3011), warmer activo (PRICE_WARMER no es 'false'), jq y curl disponibles en el host. La primera peticion puede ser fria (hasta 25s).
- Pasos: Pedir SOL una vez para registrar demanda y calentar el cache; esperar 2s; pedir SOL de nuevo y validar los campos del JSON con jq. Comando exacto en 'comando'.
- Esperado: Segunda respuesta: HTTP 200 con asset=='SOL', stale==false, durationMs<=5 (contrato: 0 en cache hit), ageMs>=0 y ageMs<15000 (PRICE_SERVE_TTL). El campo price empieza con '$'.

### price-02-multi-asset-ages-bounded
**Rotacion multi-activo: 60s de sondeo a SOL/ETH/WBTC con edades acotadas y flag stale coherente**

- Prioridad: P1 · Riesgo: solo-lectura
- Runner: `price-02 (coherencia de stale con banda muerta 14-16s)`
- Precondiciones: Servicio arriba con warmer activo. Las primeras lecturas de ETH/WBTC pueden ser frias (hasta 25s cada una), por eso -m 30 por peticion. jq disponible.
- Pasos: Durante ~60s (30 iteraciones cada 2s) pedir SOL, ETH y WBTC en cada iteracion. Para cada respuesta 200 validar: ageMs<60000 (PRICE_STALE_MAX nunca se sirve superado) y stale==true exactamente cuando ageMs>=15000. Cualquier respuesta no-200 o inconsistente marca fallo.
- Esperado: 0 fallos en ~90 respuestas: todas HTTP 200, todas con ageMs<60000, y (stale==true <=> ageMs>=15000). Nunca un precio con edad >=60000 servido de cache.

### price-03-cold-read-after-ttl-prune
**Lectura fria bloqueante tras expirar demanda: ETH sin pedir 130s vuelve con ageMs=0 dentro del presupuesto de 25s**

- Prioridad: P0 · Riesgo: solo-lectura (condicional) *(reclasificado por la critica)*
- Runner: **pendiente de automatizar**
- Nota de la critica: Su premisa (nadie pide ETH en 130s) no es garantizable con el consumidor de sentinel014 activo. Verificar la premisa leyendo health.tracked; si ETH sigue, marcar INCONCLUSO, no FALLO.
- Precondiciones: Servicio arriba. PRICE_REQUEST_TTL=60s y PRICE_STALE_MAX=60s en valores por defecto. Ningun otro proceso debe pedir ETH durante la espera (la bateria no debe correr este test en paralelo con price-02). Duracion total ~2.5 min.
- Pasos: Pedir ETH una vez; esperar 130s (60s de prune del tracking + 60s para que el cache supere PRICE_STALE_MAX, con margen); pedir ETH con timeout de cliente de 30s y validar que fue lectura fria real.
- Esperado: Segunda peticion: HTTP 200 con asset=='ETH', ageMs==0 (leido de la UI en esta peticion), stale==false, durationMs<=25000 (PRICE_COLD_TIMEOUT_MS) y tipicamente >=500ms. Nunca se sirve el cache con edad >=60s.

### price-04-reject-unknown-asset-doge
**Activo desconocido DOGE rechazado con 400 UNSUPPORTED_ASSET, sin precio alguno**

- Prioridad: P0 · Riesgo: solo-lectura
- Runner: `price-04`
- Precondiciones: Servicio arriba. jq disponible.
- Pasos: Pedir /price?asset=DOGE y validar codigo HTTP y cuerpo. Critico: jup.ag renderiza el mercado por defecto con el simbolo desconocido en la URL, asi que un fallo aqui devolveria el precio de SOL etiquetado como DOGE.
- Esperado: HTTP 400 exacto; cuerpo con code=='UNSUPPORTED_ASSET', campo supported conteniendo SOL, ETH y WBTC, y SIN campo price (has("price")==false). Respuesta rapida (<1s, no toca el navegador).

### price-05-reject-prefix-lookalike-solx
**Simbolo casi-valido SOLX (prefijo de SOL) rechazado, nunca responde con el precio de SOL**

- Prioridad: P0 · Riesgo: solo-lectura
- Runner: `price-05`
- Precondiciones: Servicio arriba. jq disponible.
- Pasos: Pedir /price?asset=SOLX. Este caso guarda contra la regresion historica url.includes('SOL') que hacia coincidir cualquier prefijo y contra inRange abriendo en simbolo desconocido.
- Esperado: HTTP 400 exacto con code=='UNSUPPORTED_ASSET' y sin campo price. Jamas HTTP 200 con un valor numerico bajo el nombre SOLX.

### price-06-unknown-param-no-silent-default
**Parametro no reconocido sin alias valido devuelve 400 UNKNOWN_PARAM en vez de defaultear a SOL**

- Prioridad: P1 · Riesgo: solo-lectura
- Runner: `price-06`
- Precondiciones: Servicio arriba. jq disponible.
- Pasos: Pedir /price?a=WBTC (clave 'a' no es alias reconocido y no hay asset/token/symbol/Asset presente).
- Esperado: HTTP 400 exacto con code=='UNKNOWN_PARAM' y sin campo price. Nunca HTTP 200 con asset=='SOL' (el default silencioso esta prohibido cuando hay parametros no reconocidos sin alias valido).

### price-07-aliases-case-and-extra-params
**Aliases token/symbol/Asset, minusculas y parametro extra junto a alias valido: todos responden WBTC**

- Prioridad: P1 · Riesgo: solo-lectura
- Runner: `price-07`
- Precondiciones: Servicio arriba; WBTC ya calentado (correr tras price-02 o dar 30s de margen a la primera). jq disponible.
- Pasos: Pedir /price con las 6 variantes: asset=WBTC, token=WBTC, symbol=WBTC, Asset=WBTC, asset=wbtc (minusculas), asset=WBTC&foo=1 (extra junto a alias valido). Validar cada una.
- Esperado: Las 6 devuelven HTTP 200 con asset=='WBTC' y price con formato '$N' (empieza con $). En particular asset=WBTC&foo=1 NO debe dar 400 UNKNOWN_PARAM.

### price-08-empty-asset-param
**Alias presente pero vacio (?asset=) devuelve 400, no defaultea a SOL**

- Prioridad: P2 · Riesgo: solo-lectura
- Runner: `price-08`
- Precondiciones: Servicio arriba. jq disponible.
- Pasos: Pedir /price?asset= (alias reconocido con valor vacio). Verificado en prod: vacio es 400; solo la omision total del parametro defaultea a SOL.
- Esperado: HTTP 400 exacto con code=='UNSUPPORTED_ASSET' y sin campo price.

### price-09-default-sol-no-params
**Sin parametros, /price responde SOL**

- Prioridad: P2 · Riesgo: solo-lectura
- Runner: `price-09`
- Precondiciones: Servicio arriba; SOL previamente calentado (la primera lectura tras reinicio puede tardar hasta 25s, de ahi -m 30). jq disponible.
- Pasos: Pedir /price sin query string.
- Esperado: HTTP 200 con asset=='SOL', price con formato '$N' y ageMs<60000.

### price-10-value-format-and-ranges
**Formato del precio y rangos por activo: numerico tras quitar $ y comas, dentro del rango inRange de cada mercado**

- Prioridad: P1 · Riesgo: solo-lectura
- Runner: `price-10`
- Precondiciones: Servicio arriba; los 3 activos calentados o margen para lecturas frias (-m 30). awk y jq disponibles.
- Pasos: Pedir SOL, ETH y WBTC; para cada uno quitar '$' y ',' del campo price y validar: resto totalmente numerico (sin saltos de linea ni '%' — guarda contra la regresion '$81.49\n+2.31%') y dentro del rango del activo. Un valor fuera de rango delata precio de mercado equivocado bajo nombre correcto.
- Esperado: Los 3 con HTTP 200. Tras strip: SOL en [5,10000), ETH en [100,10000), WBTC >= 10000; cada valor cumple regex ^[0-9]+(\.[0-9]+)?$ (una sola linea, un solo token).

### price-11-demand-registers-in-health-tracked
**Pedir un activo lo registra como demanda: aparece en price.tracked de /health**

- Prioridad: P2 · Riesgo: solo-lectura
- Runner: `price-11 (rebajado a presencia inmediata)`
- Precondiciones: Servicio arriba. jq disponible. /health puede responder 200 o 503; el cuerpo JSON se emite igual y es lo que se valida.
- Pasos: Pedir /price?asset=ETH (registra demanda incluso si la lectura falla — peekPrice registra antes de cualquier lock); esperar 1s; leer /health y buscar ETH en price.tracked.
- Esperado: El cuerpo de /health contiene price.tracked como array con 'ETH' incluido (index != null). La demanda debe persistir al menos PRICE_REQUEST_TTL (60s) desde la peticion.

### price-12-restart-first-cold-read-within-budget
**Tras reinicio del contenedor, la primera lectura fria de SOL responde 200 dentro del presupuesto de 25s**

- Prioridad: P2 · Riesgo: muta-estado
- Runner: `restart-02 (dentro de la ventana --restart)`
- Precondiciones: OPT-IN: reinicia prc-agent-jupiter (cache en memoria se pierde, ~1-2 min de indisponibilidad). Ejecutar en sentinel016 con docker disponible. Un 'docker restart' simple conserva hostname (el lock de perfil no se dispara) pero NO recompila codigo — valido solo como test de arranque en frio. No correr en paralelo con otros tests.
- Pasos: docker restart prc-agent-jupiter; esperar a que /health responda (hasta 120s); cronometrar la primera peticion /price?asset=SOL con timeout de cliente de 30s. Regresion cubierta: con el presupuesto viejo de 15s las dos primeras peticiones post-restart daban 500.
- Esperado: La primera /price tras el arranque devuelve HTTP 200 (no 500) con asset=='SOL' y elapsed total <= 30000ms (25s de PRICE_COLD_TIMEOUT_MS + margen de cola del lock). ageMs==0 en esa respuesta.

### price-13-maintenance-mode-serving
**Modo mantenimiento: /price sirve cache marcado stale:true o falla con MAINTENANCE, nunca toca el navegador ni inventa frescura**

- Prioridad: P3 · Riesgo: muta-estado
- Runner: **manual**
- Precondiciones: MANUAL con humano presente. Requiere WALLET_API_KEY configurada y su valor en mano. Abre una sesion noVNC (pausa el warmer); cerrar la sesion al terminar es obligatorio para restaurar el servicio.
- Pasos: 1) Calentar SOL: curl -s "$BASE/price?asset=SOL". 2) Abrir mantenimiento: curl -s -X POST -H "X-API-Key: $KEY" "$BASE/wallet/onboard-session". 3) Durante la sesion, pedir varias veces curl -s -w '\n%{http_code}' "$BASE/price?asset=SOL" y tambien un activo sin cache reciente (p.ej. WBTC si no fue pedido antes). 4) Cerrar: curl -s -X POST -H "X-API-Key: $KEY" "$BASE/wallet/onboard-session/close". 5) Verificar recuperacion con una lectura normal de SOL.
- Esperado: Con cache existente: HTTP 200 con stale==true (cualquier edad) — el valor viejo se sirve marcado, jamas con stale==false si supera 15s. Sin cache: HTTP 500 con error que empieza por 'MAINTENANCE' — nunca 200, nunca una lectura fria (el navegador no debe ser tocado). Tras cerrar la sesion, /price?asset=SOL vuelve a 200 con stale==false en menos de 60s.

## Area: health

### health-01-shallow-200-payload
**/health superficial responde 200 'ok' con todos los campos del contrato**

- Prioridad: P0 · Riesgo: solo-lectura
- Runner: `health-01 (umbral leido del entorno real, no 60000 fijo)`
- Precondiciones: Servicio en estado estable en sentinel016 (contenedor prc-agent-jupiter arriba, warmer corriendo, sin sesión de onboarding activa). jq instalado en el host runner.
- Pasos: Ejecutar: curl -s a $BASE/health guardando cuerpo y código HTTP, luego validar con jq la presencia y tipo de cada campo del contrato: status, version, uptimeSec, pageReady, pageUrl, price{warmerRunning, tracked, staleThresholdMs, prices, hasFreshPrice, freshestAgeMs, staleTracked}, balance{lastUpdated, stale, hasData}, pageLock{locked, waiting}, durationMs.
- Esperado: Código HTTP exactamente 200. JSON con: status=="ok"; pageReady==null (sin deep=true nunca se evalúa); price.warmerRunning==true; price.staleThresholdMs==60000 (default PRICE_STALE_MAX; si .env lo sobreescribe debe ser igual a ese valor, nunca un 60000 hardcodeado divergente); existen price.hasFreshPrice, price.freshestAgeMs, price.staleTracked, price.tracked, price.prices; existen balance.lastUpdated, balance.stale, balance.hasData; pageLock.locked es boolean y pageLock.waiting es number; existen version, uptimeSec, pageUrl, durationMs.

### health-02-freshest-age-near-zero-alive
**Con un consumidor de precio activo, freshestAgeMs queda cerca de 0 y hasFreshPrice==true**

- Prioridad: P1 · Riesgo: solo-lectura
- Runner: `health-02`
- Precondiciones: Servicio estable. El GET a /price registra demanda de SOL en el warmer (comportamiento documentado, no una mutación de estado persistente).
- Pasos: 1) curl $BASE/price?asset=SOL (puede ser lectura fría de hasta 25s la primera vez). 2) Esperar 3s para que el warmer (tick de 1s) refresque el mercado en pantalla. 3) curl $BASE/health y validar frescura.
- Esperado: En la respuesta de /health: price.hasFreshPrice==true; price.freshestAgeMs != null y price.freshestAgeMs < 5000 (el warmer relee el mercado mostrado cada ~1s, así que la entrada más fresca debe tener edad de pocos segundos como máximo).

### health-03-no-flap-3asset-100s
**Sin flapping: 0 de 50 muestras 503 durante 100s de sondeo de 3 activos cada 2s (protocolo acordado)**

- Prioridad: P0 · Riesgo: solo-lectura
- Runner: `health-03 (--flap)`
- Precondiciones: Servicio estable, wallet conectada o no (irrelevante para precio). Sin trades en curso. Este es el protocolo exacto con el que se midió la regresión (antes: 36/40 muestras 503; después del fix: 0/40). Duración ~100-150s según latencia de los /price.
- Pasos: Bucle de 50 iteraciones: en cada iteración pedir /price para SOL, WBTC y ETH, luego muestrear el código HTTP de /health, luego sleep 2. Contar cuántas muestras de /health NO fueron 200.
- Esperado: Exactamente 0 muestras con código distinto de 200 sobre 50 muestras de /health. Cualquier 503 durante el sondeo multi-activo es la regresión de flapping y falla el test. Las llamadas a /price pueden devolver stale:true (los caches rotan hasta ~80s de edad) sin afectar el resultado.

### health-04-deep-true-pageready
**/health?deep=true evalúa pageReady y devuelve true en estado estable**

- Prioridad: P1 · Riesgo: muta-estado (leve) *(reclasificado por la critica)*
- Runner: **pendiente de automatizar**
- Nota de la critica: deep=true toma el page lock y puede recargar la pagina: no es lectura pura. Ejecutar manualmente, nunca durante trades ni junto a tests de latencia.
- Precondiciones: Servicio estable. Advertencia: deep=true toma el page lock y puede curar/recargar la página si el validador falla — es un GET pero no es totalmente inerte; no ejecutarlo en bucle apretado durante otras mediciones.
- Pasos: curl $BASE/health?deep=true con timeout de cliente de 45s (debe cubrir PAGE_LOCK_TIMEOUT_MS=10s más la validación del DOM).
- Esperado: Código HTTP 200; status=="ok"; pageReady==true (boolean, no null — a diferencia del modo superficial). Si getPage falla, pageReady==false y status "degraded" con 503, lo cual falla el test en estado estable.

### health-05-shallow-no-browser-latency
**El modo superficial no toca el navegador: 10 muestras con pageReady==null y durationMs bajo**

- Prioridad: P1 · Riesgo: solo-lectura
- Runner: `health-05`
- Precondiciones: Servicio estable. La promesa documentada es que /health sin deep=true solo lee metadatos en memoria (getPriceMeta/getBalanceMeta/getLockMeta), sin page lock ni DOM.
- Pasos: 10 llamadas a $BASE/health espaciadas 1s; en cada una validar pageReady==null y durationMs<250. Contar aciertos.
- Esperado: Al menos 9 de 10 muestras cumplen pageReady==null Y durationMs<250 (tolerancia de 1 muestra por jitter de CPU en el host de 2.8GB). Si durationMs crece a segundos, /health está tocando el navegador en la ruta superficial: regresión.

### health-06-staletracked-coherence
**Coherencia interna de staleTracked: subconjunto de tracked y cada entrada supera staleThresholdMs**

- Prioridad: P2 · Riesgo: solo-lectura
- Runner: `health-06`
- Precondiciones: Servicio estable. Opcionalmente haber pedido varios activos antes (health-03 sirve) para que tracked no esté vacío; el test es válido igual con listas vacías (vacío cumple trivialmente).
- Pasos: Tomar un snapshot de $BASE/health y validar con jq: (a) todo elemento de price.staleTracked está en price.tracked; (b) para cada activo en staleTracked, su price.prices[activo].ageMs >= price.staleThresholdMs.
- Esperado: jq devuelve true: staleTracked - tracked es lista vacía, y cada activo nombrado en staleTracked tiene ageMs >= staleThresholdMs (60000 por defecto). Un activo en staleTracked con ageMs menor al umbral, o no presente en tracked, es incoherencia del payload y falla.

### health-07-hasfreshprice-freshestagems-coherence
**Coherencia de hasFreshPrice (umbral 15s) y freshestAgeMs (mínimo de las edades cacheadas)**

- Prioridad: P2 · Riesgo: solo-lectura
- Runner: `health-06 (fusionado)`
- Precondiciones: Servicio estable. Promesas documentadas en swagger.yaml: hasFreshPrice es true si y solo si alguna entrada cacheada tiene menos de 15s; freshestAgeMs es la edad de la entrada más reciente, null con cache vacío.
- Pasos: Snapshot único de $BASE/health; con jq calcular el mínimo de [.price.prices[].ageMs] y compararlo con freshestAgeMs (tolerancia 100ms por instantes de cálculo distintos) y con hasFreshPrice (banda muerta 14000-16000ms para no fallar por el borde exacto del umbral).
- Esperado: Si prices está vacío: freshestAgeMs==null y hasFreshPrice==false. Si no: |freshestAgeMs - min(ageMs)| <= 100; y si min < 14000 entonces hasFreshPrice==true, si min > 16000 entonces hasFreshPrice==false (entre 14000 y 16000 no se asevera).

### health-08-deep-param-strict-negative
**Negativo: deep=1 / deep=yes NO activan el modo profundo (solo el string exacto 'true')**

- Prioridad: P2 · Riesgo: solo-lectura
- Runner: `health-08`
- Precondiciones: Servicio estable. El contrato dice que pageReady solo se evalúa con deep=true; cualquier otro valor debe comportarse como superficial (pageReady==null, sin tocar el navegador).
- Pasos: curl $BASE/health?deep=1 y curl $BASE/health?deep=yes; validar en ambos pageReady==null y durationMs<250.
- Esperado: Ambas respuestas: código 200, pageReady==null, durationMs<250 (prueba de que no se tomó el page lock ni se validó la página). Un pageReady boolean aquí significaría parsing laxo del parámetro: falla.

### health-09-pagelock-steady-waiting-zero
**pageLock.waiting sostenido en 0 en estado estable (sin cola detrás del lock)**

- Prioridad: P2 · Riesgo: solo-lectura
- Runner: `health-09 (waiting<=1 para no pillar al warmer)`
- Precondiciones: Servicio estable, sin trades ni onboarding en curso. La promesa: waiting no-cero sostenido significa requests apilándose detrás de una página retenida.
- Pasos: 15 muestras de $BASE/health espaciadas 2s; contar en cuántas pageLock.waiting==0. Instantáneos no-cero aislados son normales (el warmer de 1Hz y el ciclo de balances toman el lock brevemente).
- Esperado: pageLock.waiting==0 en al menos 13 de 15 muestras. Además ninguna muestra con waiting>3 (cola creciente = lock retenido demasiado tiempo, el bug histórico del click de balance de 30s).

### health-10-uptime-version-monotonic
**uptimeSec crece monótonamente entre muestras y version es estable y conocida**

- Prioridad: P3 · Riesgo: solo-lectura
- Runner: `health-10`
- Precondiciones: Servicio estable, sin reinicios durante el test.
- Pasos: Dos llamadas a $BASE/health separadas 3s; comparar uptimeSec y version de ambas.
- Esperado: version idéntica en ambas muestras y distinta del string "unknown" (que indica fallo leyendo package.json); uptimeSec de la segunda muestra entre (primera+2) y (primera+15) segundos. Un uptimeSec que retrocede indica reinicio del proceso a mitad del test.

### health-11-restart-recovery-200
**Opt-in: tras docker restart, /health vuelve a 200 en menos de 180s**

- Prioridad: P2 · Riesgo: muta-estado
- Runner: `restart-01 (ventana --restart)`
- Precondiciones: OPT-IN, nunca en la pasada automática por defecto: reinicia el contenedor prc-agent-jupiter (corte de servicio de ~1-2 min). Ejecutar en ventana acordada. Nota: 'docker restart' NO recoge cambios de src/ (eso requiere compose up -d --build); este test mide solo recuperación. El perfil user_data persiste, así que el diálogo de Terms NO debe reaparecer.
- Pasos: 1) docker restart prc-agent-jupiter. 2) Poll de $BASE/health cada 5s hasta obtener 200 o agotar 180s. 3) Registrar el tiempo de recuperación.
- Esperado: /health devuelve 200 con status=="ok" en <=180s desde el restart (la lectura fría inicial puede tardar hasta 25s adicionales pero el warmer arranca en el callback de listen y freshestAgeMs se puebla al primer refresh). Timeout de 180s sin 200 = falla.

### health-12-degraded-warmer-off-manual
**Manual opt-in: semántica degraded alcanzable apagando el warmer (PRICE_WARMER=false), luego revertir**

- Prioridad: P2 · Riesgo: muta-estado
- Runner: **manual**
- Precondiciones: SOLO MANUAL con humano presente, en ventana de mantenimiento en sentinel016: degrada el servicio de precios a propósito. Backup previo del .env (cp .env .env.bak). Nunca incluir en la batería automática: si el runner muere a mitad, prod queda degradado.
- Pasos: En sentinel016, en el directorio del proyecto: 1) cp .env .env.bak. 2) echo 'PRICE_WARMER=false' >> .env. 3) docker compose up -d --force-recreate (recrear para recoger el env; NO hace falta --build, no hay cambio de src/). 4) Esperar 90s (mayor que PRICE_STALE_MAX=60s para que las edades crucen el umbral). 5) curl -s -m 10 http://localhost:3011/health: verificar código 503, status=="degraded", price.warmerRunning==false. 6) REVERTIR SIEMPRE: mv .env.bak .env; docker compose up -d --force-recreate. 7) Esperar hasta 120s y verificar /health 200 con price.warmerRunning==true y que /price?asset=SOL vuelve a responder (primera lectura fría hasta 25s).
- Esperado: Paso 5: HTTP exactamente 503, status=="degraded", price.warmerRunning==false (el warmer apagado es condición suficiente de degraded por sí sola, sin esperar staleness). Paso 7: HTTP 200, status=="ok", price.warmerRunning==true, y una lectura de /price?asset=SOL con código 200 — prueba de reversión completa. Si el paso 7 no se cumple, escalar de inmediato: prod quedó degradado.

## Area: trade

### trade-01-estimate-drives-live-form
**/trade/estimate rellena el formulario REAL sin abrir posición (clasificación honesta: no es solo-lectura)**

- Prioridad: P1 · Riesgo: requiere-fondos
- Runner: **manual**
- Precondiciones: Humano presente observando noVNC (puerto 6080). /wallet/status devuelve connected:true. /health 200. Registrar el count inicial con GET /trade/info. Nota de diseño: getTradeEstimation escribe en el formulario vivo (selecciona lado/activo, cambia colateral a USDC vía el dropdown, teclea amount y leverage) y mantiene isTradeInProgress=true durante toda la operación; puede incluso disparar connectWalletInternal si el input está deshabilitado. No hace clic en el botón de trade ni toca Phantom, pero conduce el formulario real: por eso NO se automatiza.
- Pasos: 1) count0=$(curl -s -m 30 "$BASE/trade/info" | jq .count). 2) curl -s -m 90 -X POST "$BASE/trade/estimate" -H 'Content-Type: application/json' -d '{"asset":"SOL","side":"long","amount":10,"leverage":1.5}'. 3) En noVNC verificar que SOLO se rellena el formulario: no debe aparecer ningún popup notification.html de Phantom. 4) count1=$(curl -s -m 30 "$BASE/trade/info" | jq .count). 5) curl -s -m 30 "$BASE/price?asset=SOL" para confirmar que el warmer se recupera. ABORTAR si aparece un popup de aprobación de Phantom: rechazarlo manualmente en noVNC y detener la batería.
- Esperado: Paso 2: HTTP 200 con entryPrice, liquidationPrice, slippage y totalFees como strings no vacíos (entryPrice empieza con '$', slippage con formato 'Max: N%') y durationMs presente; si devuelve {error:...} se documenta como fallo. count1 == count0 (ninguna posición creada). Cero popups de Phantom durante el flujo. Paso 5: HTTP 200 con precio válido en menos de 30s (isTradeInProgress quedó limpio en el finally).

### trade-02-estimate-invalid-body-400
**/trade/estimate rechaza body incompleto con 400 sin tocar el navegador**

- Prioridad: P2 · Riesgo: solo-lectura
- Runner: `trade-02`
- Precondiciones: API arriba en $BASE. La validación (amount, leverage, side en {long,short}) ocurre antes de getPage, por lo que este negativo es seguro y automatizable.
- Pasos: Ejecutar: curl -s -m 10 -w '\nHTTP:%{http_code}' -X POST "$BASE/trade/estimate" -H 'Content-Type: application/json' -d '{"asset":"SOL"}'
- Esperado: HTTP:400 exacto. El body de error no contiene entryPrice ni liquidationPrice. La respuesta llega en < 1000 ms (no hubo interacción con la página ni espera del page lock).

### trade-03-long-minimal-manual
**Apertura de LONG mínimo con humano presente: verificación estricta pre-clic, aprobación Phantom y prueba de existencia**

- Prioridad: P0 · Riesgo: requiere-fondos
- Runner: **manual**
- Precondiciones: OBLIGATORIO humano presente con noVNC (6080) abierto. Saldo USDC >= 12 (verificar /wallet/balance con hasData:true). /wallet/status connected:true. /health 200. count0 registrado vía /trade/info. Tamaño mínimo: amount=10 USDC, leverage=1.1. Nunca ejecutar desde la batería automática.
- Pasos: 1) count0=$(curl -s -m 30 "$BASE/trade/info" | jq .count). 2) curl -s -m 120 -X POST "$BASE/trade/long" -H 'Content-Type: application/json' -d '{"asset":"SOL","collateral":"USDC","amount":10,"leverage":1.1}'. 3) Observar en noVNC: relleno del formulario, clic del botón lateral, popup notification.html, aprobación automática, retorno de jup.ag al frente. 4) curl -s -m 30 "$BASE/trade/info". 5) curl -s -m 30 "$BASE/wallet/balance?tokens=USDC". CRITERIOS DE ABORTO: (a) si el popup de Phantom muestra un monto distinto a ~10 USDC o un texto de simulación fallida, RECHAZAR manualmente en noVNC; (b) si el paso 2 devuelve 500, verificar /trade/info ANTES de cualquier reintento — la posición puede existir aunque la verificación fallara ('approved in wallet' sin toast); NUNCA reintentar a ciegas; (c) si tras 120s no hay respuesta, no relanzar: inspeccionar la página en noVNC.
- Esperado: Paso 2: HTTP 200 con message exactamente 'Long trade created and verified' y durationMs < 120000. Paso 4: count == count0+1 y la nueva posición tiene side:'long' y asset conteniendo 'SOL', con entryPrice y size no nulos. Paso 5: balances.USDC reducido en ~10 (tolerancia de fees) con hasData:true (openPosition dispara runBalanceUpdate al verificar).

### trade-04-info-readonly-fast
**/trade/info es de solo lectura: cuenta y posiciones consistentes sin navegar**

- Prioridad: P1 · Riesgo: solo-lectura
- Runner: `trade-04`
- Precondiciones: API arriba. Funciona con 0 o más posiciones. Toma el page lock pero no navega ni hace clic.
- Pasos: Ejecutar: curl -s -m 30 "$BASE/trade/info" y validar campos.
- Esperado: HTTP 200 con count entero >= 0, positions array cuya longitud == count, durationMs < 10000 (típicamente < 2000 con página caliente; > 10000 indica contención anómala del page lock). Cada posición, si existe, tiene index y side en {long,short,unknown}. Tras la llamada, GET /health sigue 200 y pageUrl contiene jup.ag/perps (no navegó).

### trade-05-update-tpsl-manual
**/trade/update fija TP/SL con aprobación Phantom; verificación manual obligatoria (el código NO verifica post-update)**

- Prioridad: P1 · Riesgo: requiere-fondos
- Runner: **manual**
- Precondiciones: Posición LONG de trade-03 abierta. Humano presente con noVNC. Leer entryPrice de /trade/info y calcular valores seguros: takeProfit = entry * 1.05, stopLoss = entry * 0.95 (redondeados a 2 decimales). Nota de diseño: updatePosition firma transacciones pero NO marca isTradeInProgress — anotar cualquier interferencia observada del warmer durante la edición.
- Pasos: 1) Leer entryPrice: curl -s -m 30 "$BASE/trade/info". 2) curl -s -m 120 -X POST "$BASE/trade/update" -H 'Content-Type: application/json' -d '{"asset":"SOL","takeProfit":TP,"stopLoss":SL}' (sustituir TP/SL calculados). 3) Observar en noVNC el modal del lápiz, el Confirm y el popup de Phantom. 4) Esperar 10s y verificar: curl -s -m 30 "$BASE/trade/info". CRITERIOS DE ABORTO: si el popup muestra 'Simulation failed', rechazar manualmente; si el paso 2 devuelve 500 'not approved', comprobar en /trade/info que TP/SL quedaron como estaban y no reintentar más de una vez.
- Esperado: Paso 2: HTTP 200 con message, asset:'SOL' y updates:{takeProfit,stopLoss} con los valores enviados. Paso 4 (la verificación REAL, porque el código no tiene bucle de prueba post-update a diferencia de open/close): la posición muestra takeProfit y stopLoss no nulos cuyos valores numéricos (quitando '$' y ',') coinciden con los enviados con tolerancia 0.5%. Registrar además que POST /trade/update sin asset devuelve HTTP 400 (probar aparte: es la única validación de la ruta).

### trade-06-close-all-manual
**/trade/close cierra TODAS las posiciones con prueba de cierre (count debe bajar) y refresco de balance a los 5s**

- Prioridad: P0 · Riesgo: requiere-fondos
- Runner: **manual**
- Precondiciones: Humano presente con noVNC. Al menos la posición de trade-03 abierta (count0 >= 1 vía /trade/info). ADVERTENCIA: no hay targeting por posición — cierra TODO; confirmar que no hay otras posiciones que deban conservarse.
- Pasos: 1) count0=$(curl -s -m 30 "$BASE/trade/info" | jq .count). 2) curl -s -m 120 -X POST "$BASE/trade/close". 3) Observar en noVNC: clic en 'Close All', botón de confirmación del diálogo, popup de Phantom, aprobación. 4) curl -s -m 30 "$BASE/trade/info" hasta 60s después. 5) Esperar 10s y curl -s -m 30 "$BASE/wallet/balance?tokens=USDC". CRITERIOS DE ABORTO: si el paso 2 devuelve 500 conteniendo 'count never decreased', la wallet YA aprobó — NO reintentar; esperar 60s, re-leer /trade/info y solo si count no bajó inspeccionar visualmente antes de cualquier acción.
- Esperado: Paso 2: HTTP 200 con message exactamente 'Close operation initiated' y durationMs < 120000. Paso 4: count == 0 (o count0 menos las cerradas) dentro de los 60s. Paso 5: USDC recuperado respecto al valor durante la posición (colateral devuelto menos fees), con hasData:true y lastUpdated posterior al cierre (closePosition agenda runBalanceUpdate a los 5s).

### trade-07-precheck-abort-insufficient
**Aborto ANTES del clic: amount imposible debe fallar en la validación estricta de fase 2 sin popup de Phantom**

- Prioridad: P0 · Riesgo: requiere-fondos
- Runner: **manual**
- Precondiciones: Humano presente con noVNC. Wallet conectada con saldo pequeño (el amount de prueba, 100000 USDC, debe superar ampliamente el saldo real). count0 registrado vía /trade/info. Este test ejercita la promesa: los errores de simulación/validación abortan ANTES de tocar la wallet.
- Pasos: 1) count0=$(curl -s -m 30 "$BASE/trade/info" | jq .count). 2) curl -s -m 120 -X POST "$BASE/trade/long" -H 'Content-Type: application/json' -d '{"asset":"SOL","collateral":"USDC","amount":100000,"leverage":1.1}'. 3) Vigilar noVNC durante todo el flujo: NO debe aparecer notification.html. 4) curl -s -m 30 "$BASE/trade/info". 5) curl -s -m 15 "$BASE/health". CRITERIO DE ABORTO: si a pesar de todo aparece el popup de Phantom, verificar que el agente lo aborta solo (error con 'Transaction simulation failed in wallet'); si el agente lo aprueba, rechazar MANUALMENTE en noVNC de inmediato y marcar el test como FALLO CRÍTICO.
- Esperado: Paso 2: HTTP 500 con error conteniendo el mensaje scrapeado del formulario (p.ej. 'Insufficient' o el texto del botón que no matchea /(Long|Short)\/(Buy|Sell) [numero]/); jamás HTTP 200. Paso 3: cero popups de Phantom (el aborto ocurre en fase 2, antes de cualquier clic). Paso 4: count == count0. Paso 5: /health sigue 200 (un solo reportFailure no alcanza las 5 faltas que reinician el navegador); repetir este test más de 4 veces seguidas SÍ provocaría el reinicio — no encadenarlo.

### trade-08-price-during-trade-503
**Durante un trade en curso, /price frío responde 503 (PAGE_BUSY/BUSY_TRADING) y el cache caliente sigue sirviendo**

- Prioridad: P1 · Riesgo: requiere-fondos
- Runner: **manual**
- Precondiciones: Se ejecuta DENTRO de la ventana del trade manual (trade-03 o trade-06), segunda terminal lista. WBTC debe estar fuera de cache: no pedir /price?asset=WBTC durante los 120s previos al trade (PRICE_REQUEST_TTL=60s lo poda; PRICE_STALE_MAX=60s invalida el resto). SOL debe estar caliente (mercado visible).
- Pasos: Mientras openPosition mantiene el page lock e isTradeInProgress=true (visible en noVNC): 1) curl -s -m 15 -w '\nHTTP:%{http_code}' "$BASE/price?asset=WBTC". 2) curl -s -m 5 -w '\nHTTP:%{http_code}' "$BASE/price?asset=SOL". 3) Tras terminar el trade, curl -s -m 30 "$BASE/price?asset=WBTC" para confirmar recuperación.
- Esperado: Paso 1: HTTP:503 con code en {PAGE_BUSY, BUSY_TRADING} y durationMs ~<=11000 (PAGE_LOCK_TIMEOUT_MS=10000); nunca un precio de WBTC inventado ni el precio de SOL etiquetado como WBTC. Paso 2: HTTP:200 con asset:'SOL', durationMs <= 5 y stale acorde a la edad del cache (el fast path no toca el lock). Paso 3: HTTP 200 con precio WBTC válido en <= 25s (cold read post-trade).

### trade-09-approval-popup-survives-getpage
**Ventana approvalInFlight: el popup de aprobación sobrevive a lecturas /price concurrentes y no queda huérfano después**

- Prioridad: P1 · Riesgo: requiere-fondos
- Runner: **manual**
- Precondiciones: Se ejecuta durante un trade manual mínimo (puede combinarse con trade-03). Segunda terminal lista. Para la verificación posterior se necesita una sesión de diagnóstico: AGENT_DEBUG=true temporal (requiere docker compose up -d --build o restart con el env; muta estado) que DEBE restaurarse a false al terminar.
- Pasos: 1) Lanzar el trade mínimo (protocolo de trade-03). 2) En cuanto el popup notification.html sea visible en noVNC, ejecutar en la segunda terminal: for i in $(seq 1 20); do curl -s -m 3 "$BASE/price?asset=SOL" >/dev/null; sleep 0.5; done (cada getPage dispara cleanupTabs — el ataque exacto que la bandera approvalInFlight debe resistir). 3) Observar que el popup NO se cierra y el trade se aprueba. 4) 60s después del trade: curl -s -m 15 "$BASE/health" | jq .price.freshestAgeMs. 5) En sesión de debug: curl -s -m 30 "$BASE/debug/tabs". 6) Restaurar AGENT_DEBUG=false y verificar curl -s -o /dev/null -w '%{http_code}' "$BASE/debug/tabs" == 404.
- Esperado: Paso 3: el trade termina HTTP 200 verificado; el popup jamás desaparece antes de la aprobación. Paso 4: freshestAgeMs < 5000 (approveConnection devolvió el frente a jup.ag; sin ello los timers se estrangulan y el cache se congela). Paso 5: tabCount == 2, tabs con kinds exactamente {phantom, trading}, ningún kind 'phantom-approval-popup' (la exención es una VENTANA, no permanente: un popup huérfano debe ser barrible). Paso 6: 404 confirmado (disciplina: producción vuelve a AGENT_DEBUG=false).

### trade-10-history-scrape
**/trade/history cambia a la pestaña History y scrapea los trades recientes (opt-in: navega la UI)**

- Prioridad: P2 · Riesgo: requiere-fondos *(reclasificado por la critica)*
- Runner: **pendiente de automatizar**
- Nota de la critica: Navega la UI viva y ante NOT_CONNECTED fuerza connectWallet (puede levantar y auto-aprobar un popup de Phantom). Degradado a manual con humano presente.
- Precondiciones: Idealmente tras un ciclo trade-03 + trade-06 para que exista historial. Clasificado muta-estado y no solo-lectura: hace clic en la pestaña History y, si detecta NOT_CONNECTED, fuerza connectWallet y reintenta (efecto secundario real). No mueve fondos.
- Pasos: Ejecutar: curl -s -m 90 "$BASE/trade/history". Después verificar manualmente que /price sigue sirviendo (curl -s -m 30 "$BASE/price?asset=SOL" devuelve 200).
- Esperado: HTTP 200 con count entero >= 0 e history array de longitud == count; si hubo un cierre reciente, count >= 1 y la entrada más nueva tiene time relativo (p.ej. terminado en 'ago' o formato relativo) y status no vacío. durationMs < 90000. Un /price posterior responde 200 (la página no quedó rota en la pestaña History).

### trade-11-close-noop-zero-positions
**/trade/close con 0 posiciones es un no-op exitoso sin tocar Phantom**

- Prioridad: P2 · Riesgo: requiere-fondos
- Runner: **manual**
- Precondiciones: Humano presente con noVNC (defensa: si countPositions() malinterpreta el DOM y cree que hay posiciones, el flujo SÍ haría clic en 'Close All'). Confirmar count == 0 vía /trade/info justo antes. Ejecutar solo después de trade-06.
- Pasos: 1) Verificar: curl -s -m 30 "$BASE/trade/info" | jq .count == 0. 2) curl -s -m 60 -w '\nHTTP:%{http_code}' -X POST "$BASE/trade/close". 3) Vigilar noVNC: no debe haber ningún clic en Close All ni popup de Phantom. 4) curl -s -m 30 "$BASE/trade/info". CRITERIO DE ABORTO: si aparece un popup de Phantom, rechazarlo manualmente y marcar FALLO (el conteo previo falló).
- Esperado: Paso 2: HTTP:200 con message 'Close operation initiated' resuelto como no-op rápido (durationMs < 15000, sin el bucle de 60s de prueba de cierre). Paso 3: cero interacción con el diálogo de cierre y cero popups. Paso 4: count sigue == 0. /health posterior 200.

### trade-12-cors-preflight-exposes-trades
**Documentar la exposición: el preflight CORS permite POST /trade/long desde cualquier origen (riesgo conocido, sin auth)**

- Prioridad: P2 · Riesgo: solo-lectura
- Runner: `ops-03 (unificado)`
- Precondiciones: API arriba. Test de documentación de riesgo: los endpoints de trade no tienen auth y el middleware CORS refleja cualquier Origin; el preflight OPTIONS no ejecuta ningún trade.
- Pasos: Ejecutar: curl -s -i -m 10 -X OPTIONS "$BASE/trade/long" -H 'Origin: http://evil.example' -H 'Access-Control-Request-Method: POST'
- Esperado: HTTP 204 con header Access-Control-Allow-Origin: http://evil.example (reflejado) y Access-Control-Allow-Methods conteniendo POST. Resultado esperado HOY (el riesgo está aceptado y documentado en el inventario); si algún día se añade auth/allowlist a los trades, este test debe pasar a esperar la denegación y actualizarse.

---

## Pruebas anadidas por la critica

| id | Origen | Que garantiza |
|---|---|---|
| battery-00 / battery-99 | seguridad | Snapshot y gate: la pasada deja prod EXACTAMENTE igual (posiciones, address, .env, debug 404, 6080 cerrado, renderers). |
| ops-12 | completitud | /trade/update sin asset -> 400 inmediato sin tocar el navegador. |
| ops-13 | completitud | /api-docs montado (un 404 delata swagger.yaml roto en el boot). |
| restart-01..06 | seguridad | Consolidacion de los 6 reinicios en una ventana con fail-safe: si /health no vuelve, se detiene TODA la bateria y se vuelcan logs. |
| ops-14 | seguridad | Allowlist de origen activa en rutas de trade: origen no autorizado -> 403; sin configurar -> FALLO. |
| (fix aplicado) | completitud | Deriva doc corregida: swagger decia 15s para PRICE_COLD_TIMEOUT_MS; el codigo usa 25s. Corregido en swagger.yaml. |

## Backlog manual (huecos detectados, pendientes de protocolo)

- **POST /connect** idempotente con wallet ya conectada; reconexion tras restart (humano en noVNC).
- **Lado SHORT jamas probado**: trade-03b manual (short minimo + cierre), mismas salvaguardas que trade-03.
- **Self-healing** (5 fallos -> relanzamiento del navegador) nunca verificado: ventana de mantenimiento dedicada.
- **Auditoria de secretos** tras cualquier /wallet/import: grep de logs por palabras de la frase (cero apariciones).
- **ConnKeeper en regimen**: observacion pasiva 45-60 min (connected:true en todas las muestras, sin robar el frente).
- **Fallback de /wallet/balance con wallet_address.txt borrado** (unico camino con escritura a disco).
- **Conflicto de aliases** ?asset=SOL&token=WBTC: fijar cual gana y congelarlo con un test.
- ~~/wallet/onboard-session/close sin sesion previa~~ — VERIFICADO 2026-08-22 durante la
  prueba del watchdog: no-op seguro con clave valida (responde con la address y reanuda
  warmers sin efectos adversos).

## Riesgos operativos: estado

1. **Endpoints de trade abiertos — MITIGADO EN PROFUNDIDAD (2026-08-21)**: dos capas
   independientes, ambas aplicadas y verificadas en prod.
   - *Aplicacion*: allowlist de IPs origen (TRADE_ALLOWED_IPS en .env; loopback siempre
     permitido) sobre las 8 rutas capaces de operar el formulario, disparar flujos de wallet o
     reescribir configuracion: /trade/long, /trade/short, /trade/close, /trade/update,
     /trade/estimate, /trade/history, /connect y /browser/visibility. Origen no listado -> 403
     con log del bloqueo. Vigilada por ops-14 (ademas FALLA si TRADE_ALLOWED_IPS no esta
     configurada).
   - *Kernel*: deploy/firewall-sentinel016.sh ejecutado en sentinel016 (2026-08-21). Reglas
     DOCKER-USER con conntrack --ctorigdstport: los puertos 3011 y 6080 solo aceptan trafico de
     192.168.1.250 (sentinel014) y 192.168.1.117 (workstation); el resto se descarta (DROP).
     Persistidas con netfilter-persistent (sobreviven reboots; la instalacion elimino ufw, que
     estaba deshabilitado y no filtraba puertos publicados por Docker). Verificacion en vivo:
     sentinel001 (no listado) agota timeout en 3011 y 6080; sentinel014, workstation y
     localhost responden 200. Esta capa resiste una regresion del middleware y cubre 6080.
2. **POST /browser/visibility — MITIGADO**: cubierto por ambas capas (reescribia .env desde
   cualquier cliente LAN; hoy solo alcanzable desde los dos hosts autorizados, y aun desde
   ellos exige pasar la allowlist).
3. **Sesiones noVNC sin watchdog — MITIGADO (2026-08-22)**: watchdog de cierre automatico
   implementado. Al abrir una sesion se arma un temporizador (ONBOARD_SESSION_TTL_MS, por
   defecto 10 min); al expirar cierra por el MISMO camino que POST /wallet/onboard-session/close
   (funcion compartida closeOnboardSession: mata noVNC, sale de maintenance, reconecta wallet y
   relanza warmers). Single-flight contra la carrera watchdog-vs-cierre-manual; la respuesta de
   apertura anuncia autoCloseAfterMinutes. Verificado en prod con TTL de prueba de 60s: disparo
   puntual con log [vnc] watchdog, 6080 cerrado, health 200 en 3s y wallet reconectada con la
   misma address; .env restaurado byte a byte tras la prueba. Capas previas siguen: kernel DROP
   de 6080 salvo sentinel014/workstation y battery-99 verificando 6080 cerrado.
