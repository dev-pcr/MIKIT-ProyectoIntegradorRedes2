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

