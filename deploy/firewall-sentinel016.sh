#!/bin/bash
# ============================================================================
# Firewall de red para el agente Jupiter en sentinel016 — EJECUTAR CON SUDO.
#
#   sudo bash deploy/firewall-sentinel016.sh
#
# Por que existe: los endpoints de trade del agente no llevan autenticacion, asi
# que cualquier proceso con acceso de red a sentinel016:3011 puede abrir
# posiciones reales. La aplicacion ya aplica una allowlist de IPs origen
# (TRADE_ALLOWED_IPS), pero la defensa correcta es en el kernel: este script
# corta el trafico ANTES de que llegue al contenedor.
#
# Por que DOCKER-USER y no ufw/INPUT: Docker publica 3011 y 6080 con reglas DNAT
# propias que se evaluan ANTES que INPUT — un "ufw deny 3011" clasico NO corta el
# trafico hacia contenedores. DOCKER-USER es la cadena que Docker reserva para
# reglas del administrador y se evalua antes que las suyas.
#
# Este script NO toca el puerto 22 (ssh) ni ninguna otra regla existente.
# ============================================================================
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Ejecutar con sudo."; exit 1; }

# Origenes autorizados (mantener en sintonia con TRADE_ALLOWED_IPS del .env):
SENTINEL014="192.168.1.250"   # consumidor del agente
WORKSTATION="192.168.1.117"   # estacion de trabajo del operador

# Los puertos publicados del contenedor. conntrack --ctorigdstport casa el puerto
# ORIGINAL del cliente (antes del DNAT de Docker), que es lo que uno espera.
for PORT in 3011 6080; do
  # Limpieza idempotente: borra reglas previas de este script (marcadas por comentario).
  while iptables -S DOCKER-USER 2>/dev/null | grep -q "jupiter-fw-$PORT"; do
    RULE=$(iptables -S DOCKER-USER | grep "jupiter-fw-$PORT" | head -1 | sed 's/^-A //')
    iptables -D $RULE || break
  done
  # Permitidos primero, DROP del resto despues (el orden de insercion los deja asi).
  iptables -I DOCKER-USER 1 -p tcp -m conntrack --ctorigdstport "$PORT" --ctdir ORIGINAL \
    -m comment --comment "jupiter-fw-$PORT" -j DROP
  iptables -I DOCKER-USER 1 -s "$WORKSTATION" -p tcp -m conntrack --ctorigdstport "$PORT" --ctdir ORIGINAL \
    -m comment --comment "jupiter-fw-$PORT" -j RETURN
  iptables -I DOCKER-USER 1 -s "$SENTINEL014" -p tcp -m conntrack --ctorigdstport "$PORT" --ctdir ORIGINAL \
    -m comment --comment "jupiter-fw-$PORT" -j RETURN
done

echo "Reglas aplicadas:"
iptables -S DOCKER-USER | grep jupiter-fw

# Persistencia: sin esto las reglas mueren en el proximo reboot.
if ! dpkg -l netfilter-persistent 2>/dev/null | grep -q '^ii'; then
  echo "Instalando netfilter-persistent para que las reglas sobrevivan reboots..."
  DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent netfilter-persistent
fi
netfilter-persistent save

echo
echo "Listo. Verificacion sugerida:"
echo "  - Desde sentinel014:    curl -s http://192.168.1.91:3011/health   (debe responder)"
echo "  - Desde otro host LAN:  curl -m 5 http://192.168.1.91:3011/health (debe agotar timeout)"
echo "  - En este host:         curl -s http://localhost:3011/health      (debe responder)"
