# Plan: MIKIT Prototipo Local (navegador + .bat)

> Estado: **revisado** — lo leés y actualizamos.
> Fecha: 2026-09-24

## 1. Objetivo

Convertir MIKIT en un **prototipo funcional que se ejecute 100% en local**, abriendo la app en el **navegador** con un solo archivo `.bat`. Queda fuera de alcance:

- Compilación a `.exe` (cxfreeze / PyInstaller).
- App de escritorio con PyWebView (`launcher.py`).
- Cualquier despliegue remoto.

El foco secundario es un **buen rendimiento en el navegador** (carga rápida, sin overhead de desarrollo).

---

## 2. Estado actual (verificado en el repo)

| Componente                  | Comportamiento hoy                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend (`backend/main.py`) | FastAPI en puerto 8000. **Ya sirve el frontend** si existe `dist/`: monta `/assets`, responde `index.html` en `/` y tiene SPA fallback. CORS habilitado para Vite (5173). |
| Frontend (`src/`)           | React 18 + Vite. En dev corre en 5173. `npm run build` genera `dist/`.                                                                                                    |
| `src/utils/api.js`          | URL del API **hardcodeada** a `http://127.0.0.1:8000`.                                                                                                                    |
| `launcher.py`               | Wrapper PyWebView (ventana de escritorio). **Obsoleto** para este objetivo.                                                                                               |
| `vite.config.js`            | Configuración mínima, sin ajustes de build/rendimiento.                                                                                                                   |

Conclusión: la base ya sirve para un modo "producción local" (backend sirviendo `dist/`). El trabajo es orquestar el arranque con `.bat`, ajustar la URL del API a misma-origen y pulir rendimiento.

---

## 3. Decisiones de arquitectura

### 3.1 Modo de ejecución — **recomendado: backend sirviendo `dist/` (build)**

En vez de levantar Vite en dev, el `.bat` construye el frontend (`npm run build`) y el backend sirve los assets compilados en el mismo puerto (8000).

**Por qué gana en rendimiento:**

- **Misma origin** (`http://127.0.0.1:8000` para todo): sin CORS, sin conexiones duplicadas, sin redirecciones.
- Assets **minificados y con hash** (Vite): el navegador los cachea de forma agresiva → recargas instantáneas.
- **Un solo proceso** (uvicorn), sin el overhead del dev server.
- Sin `--reload` en producción → el backend no vigila archivos.

**Contrapartida:** el `.bat` puede necesitar un `npm run build` si `dist/` no existe (o si se pide rebuild). Es un paso automático y rápido (segundos).

> **DECIDIDO:** modo build. El prototipo se va a **exponer en vivo**, así que el `.bat` usa el mismo flujo que correría en producción: backend sirviendo `dist/`. Dev queda solo como herramienta de desarrollo.

### 3.2 Un solo puerto, misma origin

- Eliminar la dependencia del puerto 5173 del flujo normal.
- `src/utils/api.js`: cambiar `API_BASE_URL` a una **base relativa** (`''`) para que todas las llamadas vayan al mismo origen. Mantener la posibilidad de override por entorno si algún día se quiere dev en 5173 (p. ej. `const API_BASE_URL = import.meta.env.VITE_API_BASE || ''`).

### 3.3 Suerte del `launcher.py`

Queda fuera del flujo. Opciones: dejarlo como histórico (no se referencia) o eliminarlo en el commit final.

> **DECIDIDO:** se elimina el wrapper de escritorio (ver sección 3.5, Poda).

### 3.4 Persistencia de datos — local por PC, NADA generado se commitea

**Dónde viven los datos (verificado en el código):**

| Dato                  | Dónde se guarda                                                      | Persistencia                |
| --------------------- | -------------------------------------------------------------------- | --------------------------- |
| Grabaciones (audio)   | IndexedDB del navegador (`mikit-db`, store `recordings`)             | Por PC y navegador (perfil) |
| API keys / plantillas | localStorage del navegador                                           | Por PC y navegador (perfil) |
| Exportaciones MD/MP3  | Escritorio real del usuario (`get_desktop_path()`, soporta OneDrive) | Por PC (disco)              |

**Principio:** los datos persisten en la PC donde corre la app, pero **ningún dato generado entra al commit** de git. Así el repositorio queda liviano y cada usuario (p. ej. la compañera del grupo) clona, ejecuta y usa sus propios datos sin conflicto.

**Reglas:**

- **No se migra nada a la carpeta del proyecto.** IndexedDB, localStorage y el Escritorio ya persisten por PC sin tocar código.
- **Las API keys reales nunca se commitean** (ni en README, ni `.env`, ni `config.*`). Se manejan desde la UI (Configuración → localStorage) o en un archivo gitignored.
- Si en el futuro la app necesita una carpeta de datos local (`data/`), se excluye por completo en `.gitignore`.
- Verificar antes del primer commit que no haya restos locales trackeados (`dist/`, `venv/`, logs, etc.).

### 3.5 Poda de archivos no usados

Eliminar del repositorio lo que quedó del enfoque de escritorio. Verificado con `git ls-files`:

| Archivo           | Motivo                                                                                     | Acción    |
| ----------------- | ------------------------------------------------------------------------------------------ | --------- |
| `launcher.py`     | Wrapper PyWebView (escritorio) — obsoleto por el enfoque navegador + `.bat`                | ELIMINAR  |
| `icon.ico`        | Ícono de la ventana de escritorio — sin uso en navegador (el favicon es `public/LOGO.png`) | ELIMINAR  |
| `LOGO.png` (raíz) | Usado solo por `launcher.py` como ícono de ventana                                         | ELIMINAR  |
| `public/LOGO.png` | Favicon y logo del sidebar (`index.html`, `Layout.jsx`)                                    | CONSERVAR |

Regla general: antes del commit de poda, correr `git ls-files` y confirmar que solo queden archivos usados.

---

## 4. Flujo del `.bat` (`iniciar.bat`)

Objetivo: doble clic → todo listo → se abre el navegador.

```
1. Verificar Python disponible (py -3 o python) y Node (node/npm).
2. Si no existe venv\ → crear venv + pip install -r backend\requirements.txt.
3. Si no existe node_modules\ → npm install.
4. Si no existe dist\ (o existe flag de rebuild) → npm run build.
5. Lanzar backend: venv\Scripts\python backend\main.py  (host 127.0.0.1, port 8000, sin --reload).
6. Esperar a que responda http://127.0.0.1:8000 (loop con curl, timeout ~30s).
7. Abrir navegador: start "" http://127.0.0.1:8000
8. Mantener la consola abierta; al cerrarla (Ctrl+C o cerrar ventana) matar el proceso
   del backend (taskkill /PID o por ventana) para no dejar procesos colgados.
```

Detalles a cuidar:

- **Puerto 8000 ocupado**: detectar y avisar con mensaje claro en la consola.
- **Idempotente**: cada ejecución es segura; los pasos 2-4 solo corren si falta algo.
- **Logs visibles** en la consola del `.bat` (también sirve como "¿está vivo?").

> **Decisión abierta (C):** nombre del archivo — `iniciar.bat`, `MIKIT.bat` u otro.

---

## 5. Optimizaciones de rendimiento (navegador)

Priorizadas por impacto:

1. **Misma origin + assets con hash** (ya establecido en la sección 3): el mayor impacto, casi gratis.
2. **Cache headers para assets**: `/assets/*` con `Cache-Control: public, max-age=31536000, immutable` (los nombres con hash de Vite son inmutables). `index.html` y las rutas SPA con `no-cache` para recibir siempre la versión nueva.
3. **Compresión gzip/brotli para assets estáticos** — evaluar con cuidado: **no** comprimir la ruta `/transcribe` (usa streaming SSE; comprimir ahí agregaría latencia/buffering). Si se aplica, solo a archivos estáticos/jSON de respuesta.
4. **Backend `--no-reload`** + host `127.0.0.1` (evita exposición innecesaria y overhead).
5. **Vite build**: dejar `sourcemap: false` (valor por defecto), activar `build.chunkSizeWarningLimit` cómodo y, si se quiere, **code splitting por página** (React.lazy) para que la home cargue sin arrastrar Grabadora/Transcriptor. (Cambio opcional, fase posterior.)

---

## 6. Archivos a crear / modificar

| Archivo                   | Acción                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| `iniciar.bat`             | **CREAR** — launcher del prototipo (sección 4).                                                         |
| `PLAN_PROTOTIPO_LOCAL.md` | **CREAR** — este documento.                                                                             |
| `README.md`               | **REESCRIBIR** — arquitectura + uso del programa (doble clic en `iniciar.bat`).                         |
| `src/utils/api.js`        | **MODIFICAR** — `API_BASE_URL` relativa (misma origin), con fallback por entorno para dev.              |
| `backend/main.py`         | **MODIFICAR** — host `127.0.0.1` en `__main__`; cache headers para assets estáticos (opcional, fase 3). |
| `.gitignore`              | **MODIFICAR** — verificar exclusión de `data/` y restos locales (git liviano).                          |
| `vite.config.js`          | **MODIFICAR** — ajustes de build si se confirma (fase 3/opcional).                                      |
| `launcher.py`             | **ELIMINAR** (poda, sección 3.5).                                                                       |
| `icon.ico`                | **ELIMINAR** (poda, sección 3.5).                                                                       |
| `LOGO.png` (raíz)         | **ELIMINAR** (poda, sección 3.5).                                                                       |

---

## 7. Tareas (checklist de implementación)

**Fase 0 — Decisiones (resueltas)**

- [x] A: modo build (backend sirve `dist/`) — el prototipo se expone en vivo.
- [x] B: eliminar `launcher.py` (escritorio fuera de alcance).
- [x] D: persistencia local por PC — nada de datos generados en git.
- [x] C: nombre del `.bat` — por defecto `iniciar.bat`.

**Fase 0b — Poda**

- [ ] Eliminar `launcher.py`, `icon.ico`, `LOGO.png` (raíz).
- [ ] `git ls-files` → confirmar que solo quedan archivos usados.
- [ ] Correr el flujo completo para verificar que nada se rompe tras la poda.

**Fase 1 — Base funcional**

- [ ] Cambiar `API_BASE_URL` a relativa en `src/utils/api.js` (misma origin; dev sigue funcionando con CORS).
- [ ] Reescritura de `README.md` (arquitectura + uso del programa).
- [ ] `npm run build` → verificar que el backend sirve la app en `http://127.0.0.1:8000` (transcripción incluida).
- [ ] Verificar persistencia local: grabaciones en IndexedDB, keys en localStorage, exportaciones al Escritorio — **nada commiteable**.

**Fase 1b — Persistencia (resuelta)**

- [ ] No hay migraciones de datos: IndexedDB + localStorage + Escritorio ya persisten por PC.
- [ ] Revisar `.gitignore` para garantizar git liviano (sin `dist/`, `venv/`, datos ni keys).

**Fase 2 — Arranque con .bat**

- [ ] Crear `iniciar.bat` con el flujo de la sección 4 (deps → build si falta → backend → abrir navegador → cleanup).
- [ ] Probar: doble clic desde una carpeta cualquiera (rutas relativas al propio .bat, no al cwd).
- [ ] Probar detección de puerto ocupado y cierre limpio (sin procesos colgados).

**Fase 3 — Performance**

- [ ] Cache headers para `/assets` (immutable) y `no-cache` para HTML/SPA.
- [ ] Backend sin `--reload`, host `127.0.0.1`.
- [ ] Evaluar gzip/brotli solo para estáticos (sin tocar la ruta SSE).
- [ ] Medir: tiempo de arranque objetivo < 10 s con `dist/` existente; recarga de la app "instantánea".

**Fase 4 — Cierre**

- [ ] Resolver launcher.py (B).
- [ ] Actualizar README (ejecución con `.bat`, requisitos reducidos).
- [ ] Prueba final de flujo completo: grabar → transcribir → guardar MD/MP3.

---

## 8. Criterios de aceptación

- [ ] Doble clic en `iniciar.bat` abre el navegador en `http://127.0.0.1:8000` con la app funcionando.
- [ ] Sin `dist/`, el `.bat` lo construye solo y arranca igual.
- [ ] Grabar audio, transcribir y guardar en el Escritorio funcionan desde el navegador.
- [ ] Al cerrar la consola no quedan procesos Python/Node colgados.
- [ ] Primera carga rápida; recargas posteriores sirven assets desde caché.
- [ ] Git liviano: solo código fuente + docs; ningún dato generado, audio, key ni `dist/` en el commit.
- [ ] En una segunda PC (clon del repo): doble clic y la app funciona con datos propios de esa máquina.

---

## 9. Fuera de alcance (por ahora)

- Compilación/instaladores, PyWebView, firma de código.
- Despliegue remoto o multiusuario.
- Cambios en la lógica de transcripción o en el pool de API keys.
- Refactor profundo del frontend (solo ajustes puntuales de rendimiento/URL).
