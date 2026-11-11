// Gera os diagramas (SVG + PNG, tema claro para impressão/slides) a partir dos blocos Mermaid dos documentos.
// Cada bloco ```mermaid precedido de <!-- diagrama: nome --> vira docs/diagramas/src/nome.mmd,
// docs/diagramas/nome.svg e docs/diagramas/nome.png.
//
// Uso (na raiz do repositório):
//   node docs/diagramas/gerar-diagramas.mjs            -> usa "npx -y @mermaid-js/mermaid-cli"
//   MMDC="caminho/do/cli.js" node docs/diagramas/...    -> usa um mermaid-cli já instalado
//   CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe" (padrão no Windows)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const docs = join(here, '..');
const src = join(here, 'src');
mkdirSync(src, { recursive: true });

const files = ['MODELAGEM_DE_DADOS.md', 'FLUXOGRAMA.md', 'ARQUITETURA.md', 'UML.md'];
const only = process.argv.slice(2);
const blocks = [];
for (const f of files) {
  const path = join(docs, f);
  if (!existsSync(path)) continue;
  const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  const re = /<!-- diagrama: ([\w-]+) -->\n```mermaid\n([\s\S]*?)\n```/g;
  for (const m of text.matchAll(re)) blocks.push({ name: m[1], code: m[2] });
}

const chrome = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const pptr = join(src, 'puppeteer.json');
writeFileSync(pptr, JSON.stringify({
  ...(existsSync(chrome) ? { executablePath: chrome } : {}),
  headless: 'shell',
  args: ['--no-sandbox', '--disable-gpu'],
}));

// Tema claro com as cores da marca (verde #059669 / #0f5132, fundo branco)
const config = join(src, 'mermaid.config.json');
writeFileSync(config, JSON.stringify({
  theme: 'base',
  themeVariables: {
    fontFamily: 'Segoe UI, Arial, sans-serif',
    fontSize: '16px',
    background: '#ffffff',
    primaryColor: '#ecfdf5',
    primaryBorderColor: '#059669',
    primaryTextColor: '#0a0e0c',
    secondaryColor: '#f1f5f9',
    tertiaryColor: '#ffffff',
    lineColor: '#334155',
    textColor: '#0a0e0c',
    clusterBkg: '#f8fafc',
    clusterBorder: '#94a3b8',
    edgeLabelBackground: '#ffffff',
    // ER
    attributeBackgroundColorOdd: '#ffffff',
    attributeBackgroundColorEven: '#f0fdf4',
    // sequência
    actorBkg: '#ecfdf5',
    actorBorder: '#059669',
    actorTextColor: '#0a0e0c',
    signalColor: '#334155',
    signalTextColor: '#0a0e0c',
    labelBoxBkgColor: '#fef9c3',
    labelBoxBorderColor: '#a16207',
    noteBkgColor: '#fef9c3',
    noteBorderColor: '#a16207',
    activationBkgColor: '#d1fae5',
  },
  flowchart: { useMaxWidth: false, htmlLabels: true, curve: 'basis', nodeSpacing: 30, rankSpacing: 38, padding: 10, wrappingWidth: 320, diagramPadding: 12 },
  er: { useMaxWidth: false, layoutDirection: 'TB', minEntityWidth: 120, fontSize: 14 },
  state: { useMaxWidth: false },
  sequence: { useMaxWidth: false, mirrorActors: false, showSequenceNumbers: true, actorMargin: 60, messageFontSize: 15 },
}));

function mmdc(args) {
  if (process.env.MMDC) {
    execFileSync(process.execPath, [process.env.MMDC, ...args], { stdio: 'inherit' });
  } else {
    execFileSync('npx', ['-y', '@mermaid-js/mermaid-cli', ...args], { stdio: 'inherit', shell: true });
  }
}

for (const b of blocks) {
  if (only.length && !only.includes(b.name)) continue;
  const input = join(src, `${b.name}.mmd`);
  writeFileSync(input, b.code + '\n');
  const common = ['-i', input, '-c', config, '-p', pptr, '-b', 'white', '-q'];
  console.log(`> ${b.name}`);
  mmdc([...common, '-o', join(here, `${b.name}.svg`)]);
  mmdc([...common, '-o', join(here, `${b.name}.png`), '-s', '2']);
}
console.log(`${blocks.length} diagramas encontrados.`);
