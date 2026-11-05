#!/bin/zsh
# Guarda la llave de Google Places SIN mostrarla: en ~/.sobres/places_key (para
# los scripts locales) y en Vercel (producción y previews de feat/places).
# La llave nunca queda en el repositorio.
cd /Users/christianatherton/sobres-cdmx || exit 1
mkdir -p ~/.sobres
echo ""
echo "Pega aquí la llave de Google (no se va a ver mientras la pegas) y presiona Enter:"
read -s k
echo ""
if [ -z "$k" ]; then echo "No pegaste nada. Vuelve a intentarlo."; exit 1; fi
printf '%s' "$k" > ~/.sobres/places_key && chmod 600 ~/.sobres/places_key && echo "1/3 Guardada en tu Mac: ok"
printf '%s' "$k" | vercel env add GOOGLE_PLACES_KEY production >/dev/null 2>&1 && echo "2/3 Vercel (sobres.mx): ok" || echo "2/3 Vercel (sobres.mx): falló"
printf '%s' "$k" | vercel env add GOOGLE_PLACES_KEY preview feat/places >/dev/null 2>&1 && echo "3/3 Vercel (previews): ok" || echo "3/3 Vercel (previews): falló"
unset k
echo ""
echo "LISTO. Ya puedes regresar al chat y escribir: listo"
