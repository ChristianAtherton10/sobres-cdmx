# Sobres en Vercel

**Dirección en vivo:** https://sobres-cdmx-sobres-33f0.vercel.app

Publicado el 2026-10-05. Antes estaba en Render; Vercel sirve la página desde su
red mundial, así que **ya no hay que esperar ~50 s a que "despierte"**.

## Estado

| | |
|---|---|
| Proyecto | `sobres-cdmx` (equipo `sobres-33f0`) |
| Base de datos | Upstash Redis `upstash-kv-almond-queen` ✅ conectada |
| Acceso | público (sin login) |
| Despliegue | automático en cada `git push` a `main` |

Comprobar que todo sigue bien:
**https://sobres-cdmx-sobres-33f0.vercel.app/api/health** → debe decir `"redis": true`.

## Cómo está armado

- `index.html` — toda la página (antes se llamaba `Sobres CDMX.dc.html`).
- `api/state.py` — devuelve el estado social (lo que pide la página cada 6 s).
- `api/mutate.py` — aplica cambios: unirse, amigos, reseñas, votos, planes.
- `api/health.py` — diagnóstico.
- `lib/sobres.py` — la lógica compartida por las tres funciones.
- `server.py` — **solo para tu compu** (`python3 server.py`). Vercel no lo usa.

En Vercel cada petición levanta una función que nace **sin memoria**, por eso
`api/mutate.py` lee → aplica → escribe en Redis dentro de la misma petición, con
un candado para que dos cambios simultáneos no se pisen. Sin la base de datos no
se guardaría nada: no es opcional.

## ⚠️ Dos trampas, por si algo se rompe

1. **No crees un `requirements.txt`** en la raíz. Si existe, Vercel cree que es
   una app de Python con un solo punto de entrada e ignora `api/*.py`.
   (Ese fue el error del primer despliegue fallido.)
2. **`vercel.json` lleva `"framework": null`** — que es como se elige "Other".
   Si se quita, el preset del proyecto vuelve a romper el build.

Y si alguna vez corres `vercel build` en tu Mac, borra después los
`pyproject.toml` y `uv.lock` que genera: los fija a Python 3.9 y eso rompe el
build remoto, que usa 3.12. (Ya están en `.gitignore`.)

## Reiniciar antes de una clase

Borra usuarios, amigos, planes y votos — conserva los negocios publicados:

```bash
curl -X POST -H "Content-Type: application/json" -d '{"op":"reset","payload":{"pin":"sobres-reset","keepVenues":true}}' https://sobres-cdmx-sobres-33f0.vercel.app/api/mutate
```

Quita `,"keepVenues":true` si también quieres borrar los negocios publicados.

## Apagar Render

Ya no hace falta. Entra a **https://dashboard.render.com** → servicio
`sobres-cdmx` → **Settings** → hasta abajo **Delete Service**.
(`render.yaml` se queda en el repo por si algún día quieres volver; no estorba.)

## Un dominio propio (opcional)

En Vercel: proyecto → **Settings** → **Domains**. Si algún día compras algo tipo
`sobrescdmx.com`, se conecta ahí y la dirección queda mucho más presentable.
