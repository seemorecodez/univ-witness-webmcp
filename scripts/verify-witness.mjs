import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generatedFlag = process.argv.indexOf('--generated-dir');
const regeneratedDir = generatedFlag >= 0 ? resolve(process.argv[generatedFlag + 1]) : null;
const manifest = JSON.parse(await readFile(join(root, 'diagnostic', 'manifest.json'), 'utf8'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function verifyCoreDirectory(directory, label) {
  const expectedNames = Object.keys(manifest.coreModules).sort();
  const actualNames = (await readdir(directory)).filter((name) => name.endsWith('.wasm')).sort();
  assert(JSON.stringify(actualNames) === JSON.stringify(expectedNames), `${label}: executable module set changed`);
  for (const [name, expectedDigest] of Object.entries(manifest.coreModules)) {
    const actualDigest = await sha256(join(directory, name));
    assert(actualDigest === expectedDigest, `${label}: ${name} digest mismatch`);
  }
}

await verifyCoreDirectory(join(root, 'public', 'wasm'), 'public runtime assets');
await verifyCoreDirectory(join(root, 'app', 'lib', 'generated'), 'checked-in transpilation');
if (regeneratedDir) await verifyCoreDirectory(regeneratedDir, 'fresh jco transpilation');

const sourceComponent = join(root, 'diagnostic', 'target', 'wasm32-wasip2', 'release', 'witness-release-diagnostic.wasm');
assert(await sha256(sourceComponent) === manifest.sourceComponentSha256, 'source component digest mismatch');

const page = await readFile(join(root, 'app', 'page.tsx'), 'utf8');
const runtime = await readFile(join(root, 'app', 'lib', 'witness.ts'), 'utf8');
const generated = await readFile(join(root, 'app', 'lib', 'generated', 'witness-release-diagnostic.js'), 'utf8');
const exactFraming = 'Release and security teams can let browser agents run only pre-approved diagnostics and return reviewable execution receipts without granting arbitrary code execution.';

assert(page.includes(exactFraming), 'required user and workflow framing is missing');
assert(page.includes('https://github.com/seemorecodez/univ-witness-webmcp'), 'clean public source link is missing');
assert(page.includes('via WebMCP'), 'visible WebMCP provenance label is missing');
assert(page.includes('Independent attestation'), 'attestation caveat is missing');
assert(page.includes("'get_univ_capabilities'"), 'capabilities tool missing');
assert(runtime.includes("'upload', 'shell', 'native', 'OCI', 'worker', 'daemon', 'QEMU'"), 'closed public boundary is not documented');
assert(!page.includes('hello-wasi') && !runtime.includes('hello-wasi'), 'stale hello-wasi name found');
assert(!page.includes('minimal-command-v1') && !runtime.includes('minimal-command-v1'), 'stale no-op component ID found');
assert(!generated.includes('node:'), 'browser transpilation unexpectedly imports Node built-ins');

console.log('Witness verification passed: closed surface, exact digests, deterministic component, and evidence language are intact.');
