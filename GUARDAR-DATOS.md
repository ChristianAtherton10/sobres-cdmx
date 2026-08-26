# Que Sobres NO se reinicie (guardar amigos, planes y reseñas para siempre)

## Por qué se borraba

Render (plan gratis) le da a tu servidor un disco **temporal**. Cuando la página
se duerme por inactividad o se vuelve a desplegar, ese disco se borra y con él
`state.json` — que es donde vivían usuarios, amigos, planes y reseñas.

El código ya está listo para guardar en una base de datos externa gratuita
(**Upstash Redis**). Solo falta conectarla: son ~3 minutos, es gratis y **no pide tarjeta**.

---

## Paso 1 — Crear la base de datos (gratis)

1. Entra a **https://upstash.com** → **Sign Up** (puedes entrar con GitHub)
2. En el panel, click en **Create Database**
3. Llénalo así:
   - **Name:** `sobres`
   - **Primary Region:** elige **N. California (us-west-1)** o **Oregon** (cerca de Render)
   - Deja lo demás como viene
4. Click en **Create**

## Paso 2 — Copiar las dos llaves

1. Entra a la base `sobres` que acabas de crear
2. Baja a la sección **REST API**
3. Vas a ver dos valores — cópialos (hay un botón de copiar en cada uno):
   - `UPSTASH_REDIS_REST_URL` → algo como `https://xxx-12345.upstash.io`
   - `UPSTASH_REDIS_REST_TOKEN` → una cadena larga

⚠️ El token es una contraseña: no lo publiques ni lo mandes en capturas de pantalla.

## Paso 3 — Pegarlas en Render

1. Entra a **https://dashboard.render.com** → tu servicio **sobres-cdmx**
2. En el menú izquierdo, click en **Environment**
3. Click en **Add Environment Variable** y agrega la primera:
   - **Key:** `UPSTASH_REDIS_REST_URL`
   - **Value:** la URL que copiaste
4. Click otra vez en **Add Environment Variable** y agrega la segunda:
   - **Key:** `UPSTASH_REDIS_REST_TOKEN`
   - **Value:** el token que copiaste
5. Click en **Save, rebuild, and deploy**

Render se reinicia solo (1–2 min).

## Paso 4 — Comprobar que quedó

Abre esta dirección en el navegador:

**https://sobres-cdmx.onrender.com/api/health**

Debe decir `"redis": true`.

- `"redis": true` → ✅ listo, ya nada se borra
- `"redis": false` → alguna variable quedó mal escrita; revisa que los nombres
  estén idénticos (todo en MAYÚSCULAS y con guiones bajos)

---

## Después de conectarlo

- Si agregas un amigo, **se queda guardado** aunque la página se duerma, se
  reinicie o la vuelvas a desplegar.
- Lo mismo con planes, votos, reseñas y los negocios publicados.
- El estado se guarda automáticamente cada pocos segundos y también justo antes
  de que Render apague el servidor.

## Reiniciar a propósito (antes de una clase)

Borra usuarios, amigos, planes y votos — pero **conserva los negocios publicados**:

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"op":"reset","payload":{"pin":"sobres-reset","keepVenues":true}}' \
  https://sobres-cdmx.onrender.com/api/mutate
```

Si quieres borrar TODO, incluyendo los negocios publicados, quita `,"keepVenues":true`.

## Nota sobre el plan gratis

La página se duerme tras ~15 min sin visitas y el primero en entrar espera ~50 s
mientras despierta. Eso no borra nada (una vez conectado Upstash). Truco: ábrela
un par de minutos antes de presentar.
