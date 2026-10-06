# Publicar Sobres en Vercel

> Antes estaba en Render. Vercel sirve la página desde su red mundial, así que
> **ya no hay que esperar ~50 segundos a que "despierte"**: abre al instante.

## Lo que cambia (importante)

En Render el servidor estaba siempre prendido y guardaba todo en su memoria.
En Vercel no hay un servidor prendido: cada petición levanta una función que
nace sin memoria. Por eso **la base de datos ya no es opcional**.

Sin base de datos conectada, en Vercel no se guarda nada (ni nombres, ni amigos,
ni reseñas). Con ella conectada, se guarda todo para siempre.

Son 3 pasos. El paso 2 es el que no te puedes saltar.

---

## Paso 1 — Conectar el repo a Vercel

1. Entra a **https://vercel.com** → **Sign Up** / **Log In** → entra **con GitHub**.
2. Click en **Add New…** → **Project**.
3. En la lista de repos busca **`sobres-cdmx`** → click en **Import**.
4. Vercel detecta todo solo. **No cambies nada** de lo que te proponga:
   - Framework Preset: `Other`
   - Build Command: vacío
   - Output Directory: vacío
   - Install Command: vacío
5. **Todavía no le des Deploy.** Primero haz el Paso 2 (así solo despliega una vez).

## Paso 2 — Conectar la base de datos (obligatorio)

La forma más fácil es desde el propio Vercel, sin crear cuenta aparte:

1. En tu proyecto de Vercel, pestaña **Storage**.
2. Click en **Create Database** → elige **Upstash** → **Redis** → **Continue**.
3. Nombre: `sobres`. Región: la más cercana a Vercel (por defecto está bien).
4. Click en **Connect** / **Create**.

Vercel inyecta solas las llaves (`KV_REST_API_URL` y `KV_REST_API_TOKEN`) y el
código de Sobres ya sabe leer esos nombres. No tienes que copiar nada.

> **Si prefieres hacerlo a mano** (cuenta propia en upstash.com), mira
> `GUARDAR-DATOS.md`. Solo recuerda pegar las variables en
> **Settings → Environment Variables** de Vercel, no en Render.

⚠️ Esas llaves son contraseñas: no las publiques ni las mandes en capturas.

## Paso 3 — Desplegar y comprobar

1. Click en **Deploy** y espera 1–2 minutos.
2. Abre tu nueva dirección (algo como `https://sobres-cdmx.vercel.app`).
3. Comprueba la base de datos abriendo:
   **`https://TU-DIRECCION.vercel.app/api/health`**

   Debe decir **`"redis": true`**.

   - `"redis": true` → ✅ listo, ya nada se borra.
   - `"redis": false` → faltan las variables. Vuelve al Paso 2, y después
     entra a **Deployments → … → Redeploy** para que las tome.

4. Prueba rápida: pon tu nombre, califica un lugar, cierra todo, vuelve a entrar.
   Tu nombre y tu reseña deben seguir ahí.

---

## De aquí en adelante

Cada vez que hagas `git push` a `main`, Vercel vuelve a publicar solo
(igual que hacía Render). Tarda ~1 minuto.

## Apagar Render

Cuando Vercel ya te funcione, entra a **https://dashboard.render.com** →
servicio `sobres-cdmx` → **Settings** → hasta abajo **Delete Service**.
(El archivo `render.yaml` se queda en el repo por si algún día quieres volver;
no estorba.)

## Cómo está armado (por si lo necesitas)

- `index.html` — toda la página (antes se llamaba `Sobres CDMX.dc.html`).
- `api/state.py` — devuelve el estado social (lo que pide la página cada 6 s).
- `api/mutate.py` — aplica cambios: unirse, amigos, reseñas, votos, planes.
- `api/health.py` — diagnóstico: dice si la base de datos está conectada.
- `lib/sobres.py` — la lógica compartida por las tres funciones.
- `server.py` — **solo para tu compu** (`python3 server.py`). Vercel no lo usa.

## Reiniciar antes de una clase

Borra usuarios, amigos, planes y votos — conserva los negocios publicados:

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"op":"reset","payload":{"pin":"sobres-reset","keepVenues":true}}' \
  https://TU-DIRECCION.vercel.app/api/mutate
```
