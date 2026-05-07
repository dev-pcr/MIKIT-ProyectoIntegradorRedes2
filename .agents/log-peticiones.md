# Registro de Actividad

## 2026-05-01
- **Descripción**: Implementación de las especificaciones del sistema (PWA Full-Stack). Se agregó persistencia a Configuración (localStorage), mejoras en Grabadora (modal de plantillas, historial funcional, reproductor integrado) y finalización del Transcriptor (exportación MD, botones funcionales, historial de transcripciones).
- **Motivo**: Adaptar la UI simulada a una aplicación completamente funcional, respetando la directriz de que se convertirá en una app de escritorio, por lo que se usaron las APIs nativas del navegador (IndexedDB y localStorage) junto con el backend FastAPI.

- **Descripción**: Refactorización masiva del código fuente de React para aplicar las reglas de Vercel React Best Practices (`vercel-react-best-practices`).
- **Motivo**: Mejorar el rendimiento de la aplicación, evitar *bugs* de renderizado por estados mutables globales y optimizar el DOM previniendo renderizados condicionales inseguros (`&&`). Se reemplazaron por ternarios y se aplicaron actualizaciones de estado funcionales en todos los módulos (`Layout`, `Settings`, `Recorder`, `Transcriber`).

- **Descripción**: Implementación de interfaz de progreso en tiempo real para el Transcriptor utilizando Server-Sent Events (SSE) y Framer Motion. Los mensajes fueron localizados íntegramente al español.
- **Motivo**: Proporcionar feedback visual detallado al usuario durante el proceso de transcripción (fraccionamiento, transcripción por partes y ensamblado final), mejorando la UX y la transparencia del sistema.

## 2026-05-02
- **Descripción**: Corrección de errores críticos en el empaquetado de escritorio. Se implementó un cierre limpio del backend (matando el proceso al cerrar la UI) y se habilitó la persistencia de datos mediante la configuración de `storage_path` en PyWebView.
- **Motivo**: Resolver el error "Failed to remove temporary directory", prevenir pantallas negras por puertos ocupados y asegurar que las API Keys y el historial no se borren.
- **Lecciones Aprendidas**: 
    1. En aplicaciones empaquetadas con PyInstaller (--onefile), los subprocesos deben ser terminados explícitamente para permitir la limpieza de archivos temporales. 
    2. PyWebView requiere una ruta de almacenamiento absoluta y persistente para mantener el estado de `localStorage` e `IndexedDB`. 
    3. Es fundamental mantener la consistencia entre `localhost` y `127.0.0.1` para evitar problemas de origen cruzado en el almacenamiento del navegador. 
    4. El uso de `Documents` como ruta de almacenamiento es más fiable en entornos restringidos que `AppData\Local`.

- **Descripción**: Pulido final de UI e Identidad Visual. Se integró el logo oficial en el Layout, se añadió un selector de plantillas con icono interactivo y se configuró el icono del sistema (`.ico`) generado a partir del logo original. Se actualizaron las reglas del proyecto (`reglamento-general.md`) para reflejar la nueva arquitectura técnica.
- **Motivo**: Unificar la imagen de marca en todos los puntos de contacto (App, Barra de Tareas, Instalador) y mejorar la usabilidad del modal de guardado.

## 2026-05-03
- **Descripción**: Implementación completa de branding (logo e iconos). Se generó `icon.ico` a partir de `LOGO.png`, se actualizó `launcher.py` para establecer el icono de la ventana (barra de tareas) y se modificó `MIKIT-Desktop.spec` para incluir el icono en el ejecutable. También se actualizó el favicon del frontend en `index.html` y la carpeta `public/`.
- **Motivo**: Cumplir con la solicitud del usuario de tener el logo personalizado en el acceso directo y la barra de tareas, reforzando la identidad visual del producto.

- **Descripción**: Configuración e inicialización del repositorio Git y subida a GitHub (https://github.com/dev-pcr/MiKit.git). Se creó un archivo `.gitignore` optimizado para el stack (Vite + FastAPI + Desktop artifacts) para evitar la subida de binarios y dependencias pesadas.
- **Motivo**: Establecer control de versiones formal y cumplir con el requerimiento de respaldo en la nube solicitado por el usuario.

## 2026-05-06
- **Descripción**: Se eliminó el límite de 25MB para archivos de audio en el Transcriptor. Se removió la validación en `handleFileDrop` y en el input de selección de archivo, y se actualizó el texto de la UI de "Max 25MB" a "Sin límite de tamaño".
- **Motivo**: El backend ya fracciona el audio en chunks de 10 minutos antes de enviarlo a Groq, por lo que el límite de frontend era innecesario y bloqueaba archivos grandes legítimos.

- **Descripción**: Se implementó la edición de plantillas de nombre en Configuración. Se agregó un botón `Editar` (lápiz) al lado del botón `Eliminar` en cada chip de plantilla. Al pulsarlo, se abre un modal glassmorphism con un input pre-cargado, con opciones de Guardar y Cancelar.
- **Motivo**: Mejorar la usabilidad del módulo de plantillas, permitiendo modificar una plantilla existente sin tener que eliminarla y volver a crearla.

- **Descripción**: Se agregó exportación masiva de historiales en Grabadora y Transcriptor. Un botón "Exportar Todo" crea una carpeta con timestamp en el Escritorio y guarda secuencialmente cada ítem (MP3 para grabaciones, .md para transcripciones). El sistema emite toasts de progreso ("Iniciando...", "Procesando X de Y...", "✅ Finalizado") y detiene el proceso con un mensaje de error descriptivo si algún ítem falla, incluyendo colisión de nombres mediante sufijos `(1)`, `(2)`.
- **Motivo**: Facilitar la exportación de archivos al sistema operativo para backup o uso externo sin necesidad de descargar uno a uno.

- **Descripción**: Se modificó el formato de exportación de audio a MP3 a 22050 Hz, 16 bits, 96 kbps (en lugar del anterior 192 kbps sin normalización). Se actualiza en el endpoint `/save_audio` del backend con pydub, aplicando `set_frame_rate(22050).set_sample_width(2)` antes de exportar.
- **Motivo**: Cumplir con las especificaciones de audio del proyecto para archivos de salida: calidad adecuada para voz con tamaño de archivo razonable.
- **Motivo**: Cumplir con las especificaciones de audio del proyecto para archivos de salida: calidad adecuada para voz con tamaño de archivo razonable.

- **Descripción**: Se implementó tolerancia a fallos parciales en el pipeline de transcripción. En el loop de chunks, cada llamada a Groq está envuelta en un try/except individual. Si un fragmento falla, el bucle se interrumpe, se unen los fragmentos exitosos y se añade al final del texto un mensaje indicando hasta qué fragmento se llegó y el error ocurrido.
- **Motivo**: Mejorar la resiliencia del sistema: en lugar de perder todo el trabajo ante un error de API (rate limit, timeout), se preserva y presenta al usuario la transcripción parcial lograda.

- **Descripción**: Mejora de la visibilidad y estabilidad del pipeline de transcripción. Se corrigió un error crítico en el parser de SSE (src/utils/api.js) que causaba bloqueos con archivos grandes al no manejar payloads fragmentados. Se añadieron sub-pasos detallados (
Leyendo
memoria
temporal, Normalizando
texto, Preparando
respuesta
final) al proceso de ensamblado tanto en el backend (main.py) como en el frontend (Transcriber.jsx).
- **Motivo**: Resolver el problema de la aplicación quedándose trabada al final de transcripciones largas y mejorar la experiencia de usuario proporcionando feedback visual más granular.

- **Descripción**: Implementación del Plan V2 para el pipeline de transcripción. Se añadió lógica de reintentos automáticos con Backoff Exponencial (5s, 15s) en el backend (main.py) para manejar errores de Rate Limit (429) de forma reactiva. Se actualizó la interfaz (Transcriber.jsx) para mostrar advertencias y contadores de reintento en tiempo real.
- **Motivo**: Optimizar la eficiencia del sistema (evitando pausas preventivas innecesarias) y asegurar que audios largos se completen íntegramente incluso bajo restricciones de API.
- **Descripción**: Implementación del Plan V3 para soporte de audios ultra-largos (3hs+). Se desarrolló un `KeyPool` en el backend que gestiona la rotación automática de claves ante errores 429 y realiza esperas inteligentes basadas en el header `retry-after`. El frontend fue actualizado para enviar todas las claves del usuario y mostrar estados granulares de rotación y espera.
- **Motivo**: Permitir la transcripción ininterrumpida de grabaciones extensas que superan los límites de ASH (Audio Seconds per Hour) de una sola clave gratuita, maximizando la velocidad mediante paralelismo secuencial de claves.

- **Descripción**: Implementación de párrafos automáticos inteligentes basados en silencios fonéticos. Se cambió el formato de respuesta a `verbose_json` y se desarrolló una lógica de ensamblado que calcula el silencio entre segmentos (incluso entre fragmentos de 10 minutos). Se estableció un umbral de 1.5 segundos para la creación de nuevos párrafos (`\n\n`).
- **Motivo**: Mejorar la legibilidad de las transcripciones largas, evitando bloques de texto densos y reflejando el ritmo natural del hablante sin los costos ni riesgos de modificación de palabras de un LLM.

- **Descripción**: Corrección de error de tipos en el pipeline de transcripción (`'dict' object has no attribute 'start'`). Se implementó un acceso robusto a los segmentos de Groq que detecta si la respuesta viene como diccionario u objeto. Se generó un nuevo ejecutable con la corrección.
- **Motivo**: Resolver el fallo que impedía completar las transcripciones cuando la API de Groq devolvía datos en formato diccionario, asegurando la estabilidad del sistema de párrafos.

- **Descripción**: Generación del instalador final (`Instalar_MIKIT_v1.0.exe`) y actualización de documentación maestra. Se actualizaron `Especificaciones.md` y `reglamento-general.md` para incluir el sistema de KeyPool, párrafos inteligentes y manejo de errores robusto.
- **Motivo**: Entregar el producto final empaquetado y asegurar que las reglas del proyecto reflejen las últimas innovaciones técnicas implementadas.
