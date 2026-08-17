#!/bin/zsh
# Sobres CDMX — arranca el sitio del salón y crea el link público.
# Doble click y listo. Deja esta ventana ABIERTA mientras dure la clase.
cd "$(dirname "$0")"

echo "🌮  SOBRES CDMX — iniciando servidor…"
pkill -f "python3 .*server.py" 2>/dev/null
pkill -f "cloudflared tunnel" 2>/dev/null
sleep 1

python3 server.py 4321 > /tmp/sobres-server.log 2>&1 &
SERVER_PID=$!
sleep 1

CF=/opt/homebrew/bin/cloudflared
if [ ! -x "$CF" ]; then CF=$(which cloudflared); fi
echo "🌐  Creando link público (Cloudflare)…"
"$CF" tunnel --url http://localhost:4321 --protocol http2 --no-autoupdate > /tmp/sobres-tunnel.log 2>&1 &
TUNNEL_PID=$!

URL=""
for i in {1..30}; do
  URL=$(grep -m1 -o "https://[a-z0-9-]*\.trycloudflare\.com" /tmp/sobres-tunnel.log 2>/dev/null)
  [ -n "$URL" ] && break
  sleep 1
done

if [ -z "$URL" ]; then
  echo "❌  No se pudo crear el link público. ¿Hay internet? Revisa /tmp/sobres-tunnel.log"
  echo "    El sitio local sigue en: http://localhost:4321"
else
  echo ""
  echo "══════════════════════════════════════════════════════════"
  echo ""
  echo "   ✅  LINK PARA COMPARTIR CON EL SALÓN (ya está copiado):"
  echo ""
  echo "   $URL"
  echo ""
  echo "══════════════════════════════════════════════════════════"
  echo ""
  echo "   • Mándalo al grupo — se abre en cualquier celular."
  echo "   • Cada quien pone su nombre en Perfil y ya puede"
  echo "     calificar, agregar amigos, votar y reservar."
  echo "   • NO cierres esta ventana: tu compu es el servidor."
  echo "   • El link cambia cada vez que corres este script."
  echo ""
  printf "%s" "$URL" | pbcopy
  open "$URL"
fi

wait $TUNNEL_PID
