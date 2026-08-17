# Publicar Sobres CDMX en internet (gratis, permanente)

Tu proyecto ya está listo para subirse. Son 2 pasos: GitHub → Render.

---

## PASO 1 — Subir el código a GitHub

### 1.1 Crea el repositorio
1. Entra a **https://github.com/new** (si no tienes cuenta, créala — es gratis)
2. **Repository name:** `sobres-cdmx`
3. Déjalo en **Public**
4. **NO** marques ninguna casilla de "Add a README", "Add .gitignore" ni "Choose a license"
5. Click en **Create repository**

### 1.2 Sube el código
GitHub te va a mostrar una página con comandos. Ignórala y corre esto en la Terminal,
**cambiando `TU-USUARIO` por tu usuario de GitHub**:

```
cd ~/sobres-cdmx
git remote add origin https://github.com/TU-USUARIO/sobres-cdmx.git
git branch -M main
git push -u origin main
```

Te va a pedir usuario y contraseña:
- **Username:** tu usuario de GitHub
- **Password:** ⚠️ NO es tu contraseña normal. Necesitas un "token":
  1. Ve a **https://github.com/settings/tokens/new**
  2. Note: `sobres`
  3. Expiration: `No expiration`
  4. Marca la casilla **`repo`**
  5. Click **Generate token** abajo
  6. Copia el token (empieza con `ghp_`) y pégalo como contraseña

---

## PASO 2 — Publicarlo en Render

1. Entra a **https://render.com** → **Get Started** → entra con tu cuenta de GitHub
2. En el dashboard: **New +** → **Web Service**
3. Conecta tu GitHub y elige el repo **`sobres-cdmx`**
4. Llena así:
   - **Name:** `sobres-cdmx` (esto define tu link)
   - **Region:** Oregon (o la que salga)
   - **Branch:** `main`
   - **Runtime / Language:** **Python 3**
   - **Build Command:** *(déjalo vacío)*
   - **Start Command:** `python3 server.py`
   - **Instance Type:** **Free**
5. Click **Create Web Service**
6. Espera ~2 minutos. Cuando diga **Live**, tu link es:

   ### https://sobres-cdmx.onrender.com

Ese link es **permanente**. Nunca más tienes que prender ni apagar nada.

---

## Cosas que debes saber

**Se duerme si nadie lo usa.** En el plan gratis, si pasan ~15 minutos sin visitas,
el sitio se "duerme". La siguiente persona que entre va a esperar ~30-50 segundos
mientras despierta. Después va rapidísimo.

👉 **Truco para presentar:** abre el link tú 2 minutos antes de la clase para que
ya esté despierto cuando entren todos.

**El estado se puede borrar solo.** Los usuarios, amigos, planes y votos se guardan
en el disco del servidor, pero Render en plan gratis puede reiniciar la instancia
(al dormirse mucho tiempo o al hacer cambios). Si eso pasa, todos vuelven a
"¿Cuál es tu nombre?" — la app sigue funcionando perfecto, solo se pierde
lo que habían creado. Para la clase no es problema.

---

## Cómo actualizar el sitio después

Cada vez que cambies algo del proyecto:

```
cd ~/sobres-cdmx
git add -A
git commit -m "cambios"
git push
```

Render detecta el push y actualiza el sitio solo en ~2 minutos.

---

## Reiniciar todo (borrar usuarios y planes)

Con el sitio ya publicado, corre esto cambiando el link por el tuyo:

```
curl -X POST -H "Content-Type: application/json" \
  -d '{"op":"reset","payload":{"pin":"sobres-reset"}}' \
  https://sobres-cdmx.onrender.com/api/mutate
```

Todos los dispositivos se reinician solos en unos segundos.
