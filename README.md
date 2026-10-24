# Centro de Entrenamiento

👉 **Entrar a la app: https://federicodp91.github.io/centro-entrenamiento/**

Para instalarla en el celular abrí ese link y elegí "Instalar app" o "Agregar a pantalla de inicio" (Chrome: menú ⋮; Safari: botón Compartir).
`localhost` solo funciona en la PC donde corre el servidor, no en el celular.

App web (PWA) para entrenar, con un catálogo de 1012 ejercicios. Sin dependencias ni build: HTML, CSS y JavaScript puros. Los datos se guardan en el navegador (localStorage).

## Funciones

- **Ejercicios**: búsqueda (ignora tildes), filtro por categoría y equipamiento, favoritos, notas por ejercicio, cambio de categoría, link a videos de YouTube, historial y mejor peso. Podés crear ejercicios propios.
- **Rutinas**: armar rutinas con series, reps/tiempo, peso y descanso por ejercicio; reordenar, duplicar.
- **Entrenar**: sesión con cronómetro, registro de peso/reps por serie, valores de la última vez, temporizador de descanso con sonido y vibración.
- **Historial**: sesiones guardadas, volumen total y backup en Google Drive (manual con el botón ☁ Backup, o automático al terminar cada entrenamiento).

## Backup en Google Drive

El botón **☁ Backup** guarda todos tus datos en el archivo `Centro de Entrenamiento - backup.json` de tu Drive (siempre el mismo archivo, que se va actualizando). **Restaurar desde Drive** los trae de vuelta, por ejemplo en un celular nuevo. La app solo puede ver los archivos que ella misma crea, nada más de tu Drive.

Configuración (una sola vez):

1. Entrá a https://console.cloud.google.com/ y creá un proyecto (por ejemplo "Centro Entrenamiento").
2. **APIs y servicios → Biblioteca** → buscá **Google Drive API** → **Habilitar**.
3. **APIs y servicios → Pantalla de consentimiento de OAuth** (o "Google Auth Platform"): tipo **Externo**, nombre de la app, tu email. En **Público / Usuarios de prueba** agregá tu Gmail.
4. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo: **Aplicación web**
   - Orígenes autorizados de JavaScript: `https://federicodp91.github.io` y `http://localhost:5180`
5. Copiá el **ID de cliente** (termina en `.apps.googleusercontent.com`) y pegalo en `config.js` → `googleClientId`. Ese ID no es secreto.

## Usarla

```bash
python -m http.server 5180
```

Abrí http://localhost:5180. Para usarla en el celular, servila en la misma red (`http://<ip-de-tu-pc>:5180`) o publicala en un hosting estático (GitHub Pages, Netlify) y elegí "Agregar a pantalla de inicio".

## Editar la lista de ejercicios

1. Editá `data/ejercicios.txt` (uno por línea).
2. Ajustá reglas de categorías en `tools/categorizar.py` si hace falta.
3. Ejecutá `python tools/categorizar.py` para regenerar `data/exercises.js`.
4. Si usás la app instalada, subí la versión de `CACHE` en `sw.js`.
