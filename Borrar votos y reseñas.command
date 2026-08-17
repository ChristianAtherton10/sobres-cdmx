#!/bin/zsh
cd "$(dirname "$0")"
curl -s -X POST -H 'Content-Type: application/json' -d '{"op":"reset","payload":{"pin":"sobres-reset"}}' http://localhost:4321/api/mutate >/dev/null && echo "✅ Estado del salón borrado (usuarios, votos, reseñas, reservas)." || { rm -f state.json; echo "✅ state.json borrado (el servidor no estaba corriendo)."; }
sleep 2
