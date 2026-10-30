# BOMB BLITZ — GitHub Pages + Render

Esta edición separa la web del servidor para que el frontend se publique en GitHub Pages y las partidas online funcionen mediante un servidor Node.js en Render.

## Arquitectura
- **GitHub Pages:** interfaz del juego (HTML).
- **Render:** servidor Node.js + Socket.IO + diccionario español.
- Hasta 4 jugadores por sala, turnos de 12 segundos y validación de palabras en servidor.

## A. Publicar el servidor en Render

1. Crea un repositorio de GitHub para este proyecto, por ejemplo `bomb-blitz`.
2. Sube TODO el contenido de esta carpeta a la raíz del repositorio: `package.json`, `server.js`, `public/`, `render.yaml`, etc.
3. Entra en https://render.com/ y crea una cuenta.
4. Selecciona **New → Web Service** y conecta el repositorio `bomb-blitz`.
5. Configura:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
6. Despliega el servicio. Render te dará una URL pública parecida a `https://bomb-blitz-server.onrender.com`.
7. Comprueba que `https://TU-SERVIDOR.onrender.com/health` muestra un JSON con `ok: true` y `dictionaryStatus: "ready"` (puede tardar un poco en cargar el diccionario).

El plan gratuito de Render puede suspender servicios inactivos; la primera conexión después de un rato puede tardar en despertar.

## B. Conectar la web con el servidor

1. Abre `app-config.js` en la raíz del repositorio de GitHub.
2. Sustituye `https://PON-AQUI-TU-SERVIDOR.onrender.com` por la URL real de Render, sin añadir una barra al final.
3. Guarda los cambios.

**Importante:** actualiza también `public/app-config.js` con la misma URL. Así la página servida por Render también se conecta correctamente.

## C. Publicar la web en GitHub Pages

1. En GitHub, abre el repositorio y entra en **Settings → Pages**.
2. En **Build and deployment**, elige **Deploy from a branch**.
3. Selecciona la rama `main` y la carpeta `/ (root)`, y pulsa **Save**.
4. Espera a que GitHub publique la web. La dirección suele ser `https://TU-USUARIO.github.io/bomb-blitz/`.

## D. Probar una partida

1. Abre la URL de GitHub Pages en dos navegadores o dispositivos.
2. En uno, crea una sala.
3. En el otro, introduce el código de sala y únete.
4. Cuando haya al menos dos jugadores, el anfitrión puede iniciar la partida.

## Reglas
- De 2 a 4 jugadores por sala.
- 12 segundos por turno.
- La palabra debe contener la secuencia indicada.
- No se pueden repetir palabras.
- La palabra se valida con un diccionario español en el servidor.
- Si se acaba el tiempo, el jugador queda eliminado; gana el último jugador activo.

## Archivos importantes
- `index.html`: copia de la interfaz para GitHub Pages.
- `public/index.html`: interfaz que sirve el servidor Render.
- `app-config.js` y `public/app-config.js`: URL del servidor online.
- `server.js`: salas, turnos, temporizador y validación.
- `package.json`: dependencias y comando de inicio.

## Nota
GitHub Pages por sí solo no puede ejecutar Node.js ni WebSockets del servidor. Para multijugador online, el servicio de Render debe permanecer disponible. Las salas se guardan en memoria y se pierden si el servidor se reinicia.
