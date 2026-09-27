// Smoke test de render: monta un componente de página en Node con los globals
// del browser stubbeados y falla si el render tira.
//
// Existe porque un throw durante render deja la pantalla en blanco y el build
// de Vite NO lo detecta: Vite/esbuild parsean, no ejecutan. Un ReferenceError
// de TDZ (usar una variable antes de declararla) compila perfecto y revienta
// la pantalla al montar.
//
// Uso: node scripts/smoke-recorder.mjs [pagina]
//   pagina: Recorder (default) | Settings | Transcriber | History | AIProcessor | Home | Layout
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { build } from 'esbuild';

const PAGES = {
  Recorder: 'src/pages/Recorder.jsx',
  Settings: 'src/pages/Settings.jsx',
  Transcriber: 'src/pages/Transcriber.jsx',
  History: 'src/pages/History.jsx',
  AIProcessor: 'src/pages/AIProcessor.jsx',
  Home: 'src/pages/Home.jsx',
  Layout: 'src/components/Layout.jsx',
};
const name = process.argv[2] || 'Recorder';
const entry = PAGES[name];
if (!entry) {
  console.log(`pagina desconocida: ${name}. Disponibles: ${Object.keys(PAGES).join(', ')}`);
  process.exit(2);
}
// Layout usa <Outlet/>: solo renderiza dentro de un <Route> con hijo. Montarlo
// suelto no ejercita el sidebar, que es justo lo que se quiere cubrir.
const needsRouter = name === 'Layout';

// --- stubs del browser ANTES de que se importe nada ---
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = { addEventListener() {}, removeEventListener() {} };
// Node >=21 expone `navigator` como getter read-only: asignar directo tira.
Object.defineProperty(globalThis, 'navigator', {
  value: { mediaDevices: { getUserMedia: async () => { throw new Error('no audio en test'); } } },
  configurable: true,
  writable: true,
});
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};

// framer-motion consulta estas clases del DOM para decidir si un nodo es SVG.
// No existen en Node, y sin ellas el render explota por reasons que no tienen
// nada que ver con el código de la app.
class FakeNode {}
class FakeElement extends FakeNode {}
class FakeSVGElement extends FakeElement {}
for (const [k, v] of Object.entries({
  Node: FakeNode,
  Element: FakeElement,
  HTMLElement: FakeElement,
  SVGElement: FakeSVGElement,
})) {
  if (!(k in globalThis)) Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
}
globalThis.window.getComputedStyle = () => ({ getPropertyValue: () => '' });
globalThis.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.AudioContext = function () {
  return { state: 'running', createMediaStreamSource: () => ({ connect() {} }), createAnalyser: () => ({ fftSize: 1, getFloatTimeDomainData() {} }), close: async () => {} };
};

// El bundle tiene que quedar DENTRO del proyecto: si se escribe en temp,
// `require('react')` no resuelve porque node_modules no está en el ancestro.
const dir = mkdtempSync(join(process.cwd(), '.smoke-'));
process.on('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

// Bundle del componente + deps, en formato CJS para poder requirearlo.
const result = await build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
  jsx: 'automatic',
  loader: { '.js': 'jsx' },
  external: ['react', 'react-dom', 'react/jsx-runtime', 'react-router-dom', 'lucide-react', 'framer-motion'],
  define: { 'import.meta.env': '{}' },
});
const out = join(dir, 'page.cjs');
const { writeFileSync } = await import('fs');
writeFileSync(out, result.outputFiles[0].text);

const { createRequire } = await import('module');
const require = createRequire(import.meta.url);

let Page;
try {
  Page = require(out).default;
} catch (e) {
  console.log(`FALLO AL IMPORTAR ${name}:`);
  console.log('  ' + (e.message || e));
  process.exit(1);
}
console.log(`[${name}] import: OK`);

const React = require('react');
const { renderToString } = require('react-dom/server');
const { MemoryRouter, Routes, Route } = require('react-router-dom');

const tree = needsRouter
  ? React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        Routes,
        null,
        React.createElement(
          Route,
          { path: '/', element: React.createElement(Page) },
          React.createElement(Route, { index: true, element: React.createElement('div', null, 'contenido') })
        )
      )
    )
  : React.createElement(MemoryRouter, null, React.createElement(Page));

try {
  const html = renderToString(tree);
  console.log(`[${name}] render: OK  ->  ${html.length} chars`);
  if (html.length < 500) {
    console.log(`[${name}] AVISO: render sospechosamente corto, revisá que la pagina muestre contenido.`);
  }
  // El sidebar es la estructura que sostiene todas las pantallas: si su markup
  // no aparece, la pagina quedo sin navegacion aunque el render "pase".
  if (needsRouter) {
    const missing = ['MIKIT', 'href="/grabadora"', 'href="/transcriptor"'].filter((s) => !html.includes(s));
    if (missing.length) {
      console.log(`[Layout] FALLO: falta markup del sidebar -> ${missing.join(', ')}`);
      process.exit(1);
    }
    console.log('[Layout] sidebar: OK (logo + 6 links de navegacion presentes)');
  }
} catch (e) {
  console.log(`[${name}] FALLO EN RENDER:`);
  console.log('  ' + (e.message || e));
  console.log((e.stack || '').split('\n').filter(l => l.includes(name) || l.includes('src')).slice(0, 5).join('\n'));
  process.exit(1);
}
