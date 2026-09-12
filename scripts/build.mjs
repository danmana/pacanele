import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

export async function buildPage() {
  const result = await build({
    entryPoints: ['src/main.js'], bundle: true, minify: true, write: false,
    target: ['es2022'], format: 'iife', legalComments: 'inline',
  });
  const [template, css] = await Promise.all([
    readFile('src/page.html', 'utf8'), readFile('src/style.css', 'utf8'),
  ]);
  const html = template.replace('/* INLINE_STYLE */', css)
    .replace('/* INLINE_SCRIPT */', () => result.outputFiles[0].text.replaceAll('</script', '<\\/script'));
  await mkdir('dist', { recursive: true });
  await writeFile('dist/index.html', html);
  console.log(`Built dist/index.html — ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB, entirely self-contained.`);
  return html;
}
if (process.argv[1]?.endsWith('/build.mjs')) await buildPage();
