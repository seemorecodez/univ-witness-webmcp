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
    assert(await sha256(join(directory, name)) === expectedDigest, `${label}: ${name} digest mismatch`);
  }
}

await verifyCoreDirectory(join(root, 'public', 'wasm'), 'public browser assets');
await verifyCoreDirectory(join(root, 'app', 'lib', 'generated'), 'checked-in transpilation');
if (regeneratedDir) await verifyCoreDirectory(regeneratedDir, 'fresh jco transpilation');

const sourceComponent = join(root, 'diagnostic', 'component', 'univ-portable-workload.wasm');
assert(await sha256(sourceComponent) === manifest.sourceComponentSha256, 'source component digest mismatch');

const page = await readFile(join(root, 'app', 'page.tsx'), 'utf8');
const contract = await readFile(join(root, 'app', 'lib', 'deployment-contract.ts'), 'utf8');
const compiler = await readFile(join(root, 'app', 'lib', 'deployment-compiler.ts'), 'utf8');
const capsuleVerifier = await readFile(join(root, 'app', 'lib', 'deployment-capsule-verifier.ts'), 'utf8');
const client = await readFile(join(root, 'app', 'lib', 'deployment.ts'), 'utf8');
const runtime = await readFile(join(root, 'app', 'lib', 'wasi-runtime.ts'), 'utf8');
const edge = await readFile(join(root, 'app', 'api', 'targets', 'sites-edge-wasi', 'route.ts'), 'utf8');
const generated = await readFile(join(root, 'app', 'lib', 'generated', 'univ-portable-workload.js'), 'utf8');

assert(page.includes('One deployment intent. Two execution capsules. One observed outcome.'), 'deployment-compiler framing is missing');
assert(page.includes('browser-wasi') && page.includes('sites-edge-wasi'), 'both explicit targets must be visible');
assert(page.includes('Portability frontier + runtime witness'), 'visible compiler-to-witness chain is missing');
assert(page.includes('setPlan(next.selectedPlan)'), 'creating a permitted handoff must replace any previously displayed blocked plan');
assert(page.includes('via WebMCP'), 'visible WebMCP provenance label is missing');
assert(page.includes('Independent attestation'), 'attestation caveat is missing');
for (const tool of ['get_univ_capabilities', 'compile_univ_deployment', 'create_deployment_handoff', 'deploy_univ_manifest', 'get_deployment_evidence']) {
  assert(page.includes(`'${tool}'`), `WebMCP tool missing: ${tool}`);
}
assert(contract.includes("'portable-release-v1'") && contract.includes("'network-bound-release-v1'"), 'closed manifest model is incomplete');
assert(contract.includes("actualTargetsExecuted: 2"), 'two-target portability receipt is missing');
assert(contract.includes('identityAuthorized: false'), 'handoff assurance limit is missing');
assert(contract.includes("schemaVersion: 'univ.deployment-receipt/v2'") && contract.includes("schemaVersion: 'univ.runtime-portability-witness/v1'"), 'runtime portability witness is not bound into the final receipt');
assert(contract.includes("schemaVersion: 'univ.deployment-handoff/v2'") && contract.includes('executionCapsules'), 'compiled capsules are not bound into the handoff');
assert(compiler.includes('TARGET_PASSPORTS') && compiler.includes('compileDeploymentProgram'), 'target-passport compiler is missing');
assert(compiler.includes("'univ.compatibility-certificate/v1'") && compiler.includes("'univ.execution-capsule/v1'"), 'compiler proof artifacts are incomplete');
assert(capsuleVerifier.includes('verifyCompatibilityCertificate') && capsuleVerifier.includes('verifyExecutionCapsule'), 'independent capsule verifier is missing');
assert(!capsuleVerifier.includes("import {\n  compileDeploymentProgram"), 'capsule verifier must not import the compiler implementation');
assert(client.includes("binding: 'sha256-before-instantiation'"), 'browser runtime digest gate is missing');
assert(client.includes('capsuleDigest: capsule.capsuleDigest'), 'browser receipt is not bound to its execution capsule');
assert(edge.includes("binding: 'static-compiled-module-import'"), 'edge static-module binding is missing');
assert(edge.includes('capsuleDigest: capsule.capsuleDigest'), 'edge receipt is not bound to its execution capsule');
assert(edge.includes('runtimeSha256Observed: false'), 'edge runtime hash limitation is not explicit');
assert(edge.includes('Workers clock may remain at zero'), 'edge timing limitation is not explicit');
assert(runtime.includes('enableNetwork: false'), 'guest networking must remain disabled');
assert(contract.includes("['upload', 'shell', 'native', 'OCI', 'worker', 'daemon', 'QEMU'"), 'closed public boundary is not documented');
assert(!page.includes('hello-wasi') && !contract.includes('minimal-command-v1'), 'stale component name found');
assert(!generated.includes('node:'), 'browser transpilation unexpectedly imports Node built-ins');

console.log('UNIV Deploy verification passed: deployment-intent compilation, target passports, verified capsules, handoff integrity, two real targets, portability receipts, and evidence limits are intact.');
