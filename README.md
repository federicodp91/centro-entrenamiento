# Centro de Entrenamiento

👉 **Entrar a la app: https://federicodp91.github.io/centro-entrenamiento/**

Para instalarla en el celular abrí ese link y elegí "Instalar app" o "Agregar a pantalla de inicio" (Chrome: menú ⋮; Safari: botón Compartir).
`localhost` solo funciona en la PC donde corre el servidor, no en el celular.

App web (PWA) para entrenar, con un catálogo de 1012 ejercicios. Sin dependencias ni build: HTML, CSS y JavaScript puros. Los datos se guardan en el navegador (localStorage).

## Funciones

- **Ejercicios**: búsqueda (ignora tildes), filtro por categoría y equipamiento, favoritos, notas por ejercicio, cambio de categoría, link a videos de YouTube, historial y mejor peso. Podés crear ejercicios propios.
- **Rutinas**: armar rutinas con series, reps/tiempo, peso y descanso por ejercicio; reordenar, duplicar.
- **Entrenar**: sesión con cronómetro, registro de peso/reps por serie, valores de la última vez, temporizador de descanso con sonido y vibración.
- **Historial**: sesiones guardadas, volumen total, exportar/importar backup en JSON.

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
