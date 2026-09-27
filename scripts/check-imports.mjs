// Check estatico de imports: falla si el JSX usa un componente que no esta
// importado ni declarado en el archivo.
//
// Existe por un bug real: se uso <ChevronUp/> sin agregarlo al import de
// lucide-react. El build de Vite PASO y el smoke test tambien, porque ambos
// resuelven lucide-react por su entrada CommonJS y un named export inexistente
// queda como `undefined` en vez de error. La pantalla se caia recien en el
// navegador, al montar.
//
// Un ReferenceError de render no se detecta parseando: hay que ejecutarlo o
// compararlo contra los simbolos disponibles. Esto es lo barato.
//
// Uso: node scripts/check-imports.mjs
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = 'src';

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.jsx?$/.test(p)) out.push(p);
  }
  return out;
}

const problems = [];

for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8');

  // Paso 1: sacar comentarios, conservando strings. Los imports viven adentro
  // de strings ("from 'x'"), asi que todavia no se pueden blindingar.
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/[^\n]*$/gm, ' ');

  // Paso 2: a partir de ahi, dos vistas distintas con propositos distintos.
  //   - imports y declaraciones: necesitan los strings intactos.
  //   - tags JSX: no deben ver nada dentro de strings ni plantillas, para no
  //     tomar por codigo un "<div>" que este dentro de un texto.
  const noStrings = noComments
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""');

  const available = new Set();

  // imports con llaves: import { A, B as C } from 'x'
  for (const m of noComments.matchAll(/import\s+([\s\S]*?)\s+from\s*['"][^'"]*['"]/g)) {
    const clause = m[1];
    const braces = clause.match(/\{([\s\S]*?)\}/);
    if (braces) {
      for (const raw of braces[1].split(',')) {
        const part = raw.trim().replace(/^type\s+/, '');
        if (!part) continue;
        const as = part.split(/\s+as\s+/);
        available.add((as[1] ?? as[0]).trim());
      }
    }
    // default y namespace: import Foo, * as ns from 'x'
    const head = (braces ? clause.slice(0, clause.indexOf('{')) : clause).split(',');
    for (const raw of head) {
      const t = raw.trim();
      if (t && !t.startsWith('*') && !t.startsWith('type ')) available.add(t);
    }
  }
  // imports sin from: import './styles.css'
  // declaraciones locales: function Foo() {} / const Foo = () => {}
  for (const m of noComments.matchAll(/\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) {
    available.add(m[1]);
  }

  for (const m of noStrings.matchAll(/<([A-Z][A-Za-z0-9_]*)(?=[\s/>])/g)) {
    const tag = m[1];
    if (!available.has(tag)) problems.push(`${relative('.', file)}: <${tag}> no esta importado ni declarado`);
  }
}

if (problems.length) {
  console.error(`\n[check-imports] FALLO — ${problems.length} componente(s) sin resolver:\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error('\nEn Vite esto NO rompe el build si el paquete se resuelve por CJS:');
  console.error('queda como undefined y la pantalla revienta recien en el navegador.\n');
  process.exit(1);
}

console.log('[check-imports] OK — ningun componente JSX sin importar');
