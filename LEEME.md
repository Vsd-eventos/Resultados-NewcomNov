# Resultados en vivo · Torneo de Newcom · VSD Eventos

## Archivos
- `Code.gs` → va en Apps Script (NO se sube a GitHub)
- `index.html`, `styles.css`, `app.js` → van al repo de GitHub Pages

## 1. Formulario
Preguntas (el script tolera variaciones como "Puntos Equipo A", "Cancha N°", "Categoria:"):
`Categoría`, `Cancha`, `Equipo A`, `Puntos A`, `Equipo B`, `Puntos B`

- **Categoría**: desplegable con `+50` y `+60` (también acepta "Mayores +50", "60", etc.).
- **Puntos A / B**: respuesta corta con validación *Número → Número entero → mayor o igual que 0*.
- Compartí el formulario solo con los planilleros.

## 2. Apps Script
1. Abrí la hoja de respuestas → **Extensiones → Apps Script** → borrá lo que haya y pegá `Code.gs`.
2. Si la pestaña de respuestas no se llama `Respuestas de formulario 1`, cambiá ese texto en la línea `HOJA:`.
3. Guardá (💾).
4. **Instalar los activadores (una sola vez):** en el desplegable de funciones elegí `instalarTriggers` → **▶ Ejecutar** → Revisar permisos → tu cuenta → *Configuración avanzada* → *Ir a … (no seguro)* → **Permitir**. En el ícono del reloj ⏰ tienen que aparecer 3 activadores.
5. **Implementar → Nueva implementación → ⚙ App web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario** (no "con cuenta de Google")
6. Copiá la URL que termina en `/exec` y abrila en incógnito: tiene que mostrar algo que empieza con `{"v":`.

> Cada vez que cambies el código: **Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión → Implementar**. La URL no cambia.

## 3. Página
1. En `app.js`, reemplazá `API_URL` por tu URL `/exec`.
2. Subí `index.html`, `styles.css` y `app.js` al repo → **Settings → Pages → Deploy from branch (main)**.

Mientras `API_URL` tenga `TU_ID`, la página muestra datos de ejemplo.

## Si algo no anda
Abrí la URL `/exec` en incógnito:
- **Pide iniciar sesión** → el acceso no está en "Cualquier usuario".
- **"No existe la hoja…"** → corregí `HOJA:`.
- **"No encuentro: … tiene estos títulos: …"** → el mensaje dice qué títulos ve; ajustá la pregunta del formulario.
- **`{"v":…,"m":[]}`** → funciona pero no hay filas válidas (¿categoría distinta de +50/+60? ¿puntos vacíos?).

## Por qué aguanta ~1000 personas
- La web app responde un JSON guardado en caché; la hoja se relee solo cuando llega un formulario, o como máximo cada 20 s, y lo hace una sola ejecución a la vez.
- Cada visitante consulta cada 30–40 s (con dispersión aleatoria) y deja de consultar si la pestaña no está visible.
- Si hay errores, cada navegador espera cada vez más (hasta 5 min) y sigue mostrando los últimos datos.

## Seguridad
- La web app solo lee: no hay forma de escribir en la hoja desde la página.
- Solo se publican los datos del partido, nunca emails ni otras columnas.
- Textos limpiados y con largo máximo; puntos y categorías validados.
- La página inserta todo como texto (sin `innerHTML`): sin XSS.
- `Content-Security-Policy` estricta: solo scripts propios y conexiones a Google.

## Detalles
- El día (Viernes/Sábado) sale de la marca temporal del envío.
- Si se reenvía el mismo partido (mismo día, categoría, cancha y equipos), queda el último envío: sirve para corregir.
- Al abrir un viernes o sábado se selecciona solo ese día.
- Los filtros quedan en la URL (`#dia=S&cat=%2B60`) para compartir links filtrados.
