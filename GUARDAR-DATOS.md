# Que Sobres NO se reinicie (guardar amigos, planes y reseñas para siempre)

> **Si ya seguiste el Paso 2 de `PUBLICAR.md` (Storage → Upstash desde Vercel),
> ya está hecho y no necesitas esta guía.** Esto es la versión manual, por si
> prefieres tu propia cuenta de Upstash.

## Por qué hace falta

En Vercel no hay un servidor prendido: cada petición levanta una función que
nace **sin memoria** y se apaga al terminar. No hay disco donde guardar nada.

Por eso Sobres guarda su estado (usuarios, amigos, planes, reseñas, negocios
publicados) en una base de datos externa gratuita: **Upstash Redis**.

**Sin esto, en Vercel no se guarda absolutamente nada.** La página abre, pero
los nombres y las reseñas desaparecen en cuanto cambias de pantalla.

---

## Paso 1 — Crear la base de datos (gratis, sin tarjeta)

1. Entra a **https://upstash.com** → **Sign Up** (puedes entrar con GitHub)
2. En el panel, click en **Create Database**
3. Llénalo así:
   - **Name:** `sobres`
   - **Primary Region:** la más cercana a tu región de Vercel
   - Deja lo demás como viene
4. Click en **Create**

## Paso 2 — Copiar las dos llaves

1. Entra a la base `sobres` que acabas de crear
2. Baja a la sección **REST API**
3. Copia los dos valores (hay un botón de copiar en cada uno):
   - `UPSTASH_REDIS_REST_URL` → algo como `https://xxx-12345.upstash.io`
   - `UPSTASH_REDIS_REST_TOKEN` → una cadena larga

⚠️ El token es una contraseña: no lo publiques ni lo mandes en capturas de pantalla.

## Paso 3 — Pegarlas en Vercel

1. Entra a **https://vercel.com/dashboard** → tu proyecto **sobres-cdmx**
2. **Settings** → **Environment Variables**
3. Agrega la primera:
   - **Key:** `UPSTASH_REDIS_REST_URL`
   - **Value:** la URL que copiaste
   - **Environments:** deja marcados los tres (Production, Preview, Development)
4. Agrega la segunda igual:
   - **Key:** `UPSTASH_REDIS_REST_TOKEN`
   - **Value:** el token que copiaste
5. Click en **Save**
6. Ve a **Deployments** → en el último, menú **…** → **Redeploy**

   (Las variables nuevas solo las toma un despliegue nuevo.)

## Paso 4 — Comprobar que quedó

Abre en el navegador:

**`https://TU-DIRECCION.vercel.app/api/health`**

Debe decir `"redis": true`.

- `"redis": true` → ✅ listo, ya nada se borra
- `"redis": false` → revisa que los nombres estén idénticos (todo en MAYÚSCULAS
  y con guiones bajos) y que hayas hecho el **Redeploy** del paso 3.6

---

## Después de conectarlo

- Si agregas un amigo, **se queda guardado** para siempre.
- Lo mismo con planes, votos, reseñas y los negocios publicados.
- Cada cambio se guarda en el momento, dentro de la misma petición.

## Sobre el plan gratis de Upstash

Son **500,000 comandos al mes**, que para una clase sobra de más. Sobres ya
viene optimizado para gastar poco:

- la página consulta cada 6 segundos, no cada 4;
- **deja de consultar cuando la pestaña está en segundo plano**;
- las funciones reutilizan el último estado leído durante 2.5 s, así que muchas
  personas conectadas a la vez no multiplican las lecturas.

Si algún día quisieras afinarlo, la variable de entorno `SOBRES_CACHE_TTL`
(en segundos) controla ese reuso.

## Reiniciar a propósito (antes de una clase)

Borra usuarios, amigos, planes y votos — pero **conserva los negocios publicados**:

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"op":"reset","payload":{"pin":"sobres-reset","keepVenues":true}}' \
  https://TU-DIRECCION.vercel.app/api/mutate
```

Si quieres borrar TODO, incluyendo los negocios publicados, quita `,"keepVenues":true`.
