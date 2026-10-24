# Device Lab

Simulador de pantallas para probar Arlequín (o cualquier web) como se ve **de verdad** en celulares y notebooks.

## Por qué DevTools "miente"
DevTools emula la pantalla completa (iPhone 15 Pro = 393×852). En el teléfono real Safari
se come ~190px con la barra de estado, la barra de direcciones y la de abajo → la web tiene
**393×659**. Lo mismo en notebooks: una 1920×1080 al 125% de Windows deja ~1536×730 útiles.
Device Lab usa por defecto ese **tamaño visible real** (columna *Viewport*).

Otras diferencias que no se emulan: "Zoom de pantalla" de iOS (Ajustes › Pantalla) baja el
ancho a 320–375px, y el tamaño de texto de Safari (aA). Si algo se ve raro en tu celular,
revisá eso primero.

## Uso
- **Doble click en `DeviceLab.bat`** → ventana con la lista de dispositivos.
  - Doble click en un dispositivo: abre un navegador emulándolo (tamaño, DPR, touch, user-agent).
    Abajo a la izquierda muestra el tamaño real del viewport.
  - *Probar seleccionados / TODOS*: recorre home → pregunta → grilla → cartas → contacto,
    saca capturas, detecta superposiciones (escudo/footer/botones sobre la carta, cosas fuera
    de pantalla) y abre `capturas/<fecha>/reporte.html`.
- CLI:
  ```
  python lab.py list
  python lab.py open "iPhone XR / 11"
  python lab.py shoot                       # todos
  python lab.py shoot --devices "iPhone SE (2/3)" --theme light
  python lab.py shoot --full-screen         # tamaño DevTools, para comparar
  python lab.py shoot --landscape
  ```
  `shoot` sale con código 1 si encontró problemas (sirve para CI).

## Notas
- Motor: Chromium por defecto. "Motor WebKit" usa el motor de Safari, pero la versión de
  Windows **no muestra imágenes AVIF** (el iPhone sí), así que sirve sólo para revisar CSS.
- Dispositivos: `devices.py`. Recorrido y chequeos: `scenarios/arlequin.json`.
- Las alturas "visibles" son aproximadas (±15px según versión de iOS / navegador).
