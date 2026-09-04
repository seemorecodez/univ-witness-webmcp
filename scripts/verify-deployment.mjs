import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generatedFlag = process.argv.indexOf('--generated-dir');
const regeneratedDir =
  generatedFlag >= 0 ? resolve(process.argv[generatedFlag + 1]) : null;
const manifest = JSON.parse(
  await readFile(join(root, 'diagnostic', 'manifest.json'), 'utf8'),
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function sha256(path) {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}

async function verifyCoreDirectory(directory, label) {
  const expectedNames = Object.keys(manifest.coreModules).sort();
  const actualNames = (await readdir(directory))
    .filter((name) => name.endsWith('.wasm'))
    .sort();
  assert(
    JSON.stringify(actualNames) === JSON.stringify(expectedNames),
    `${label}: executable module set changed`,
  );
  for (const [name, expectedDigest] of Object.entries(manifest.coreModules)) {
    assert(
      (await sha256(join(directory, name))) === expectedDigest,
      `${label}: ${name} digest mismatch`,
    );
  }
}

await verifyCoreDirectory(
  join(root, 'public', 'wasm'),
  'public browser assets',
);
await verifyCoreDirectory(
  join(root, 'app', 'lib', 'generated'),
  'checked-in transpilation',
);
if (regeneratedDir)
  await verifyCoreDirectory(regeneratedDir, 'fresh jco transpilation');

const sourceComponent = join(
  root,
  'diagnostic',
  'component',
  'univ-portable-workload.wasm',
);
assert(
  (await sha256(sourceComponent)) === manifest.sourceComponentSha256,
  'source component digest mismatch',
);

const page = await readFile(join(root, 'app', 'page.tsx'), 'utf8');
const contract = await readFile(
  join(root, 'app', 'lib', 'deployment-contract.ts'),
  'utf8',
);
const compiler = await readFile(
  join(root, 'app', 'lib', 'deployment-compiler.ts'),
  'utf8',
);
const capsuleVerifier = await readFile(
  join(root, 'app', 'lib', 'deployment-capsule-verifier.ts'),
  'utf8',
);
const receiptVerifier = await readFile(
  join(root, 'app', 'lib', 'deployment-receipt-verifier.ts'),
  'utf8',
);
const client = await readFile(
  join(root, 'app', 'lib', 'deployment.ts'),
  'utf8',
);
const runtime = await readFile(
  join(root, 'app', 'lib', 'wasi-runtime.ts'),
  'utf8',
);
const edge = await readFile(
  join(root, 'app', 'api', 'targets', 'sites-edge-wasi', 'route.ts'),
  'utf8',
);
const evidenceWriter = await readFile(
  join(root, 'app', 'api', 'evidence', 'route.ts'),
  'utf8',
);
const evidenceReader = await readFile(
  join(root, 'app', 'api', 'evidence', '[evidenceId]', 'route.ts'),
  'utf8',
);
const evidenceSchema = await readFile(join(root, 'db', 'schema.ts'), 'utf8');
const hosting = JSON.parse(
  await readFile(join(root, '.openai', 'hosting.json'), 'utf8'),
);
const migration = await readFile(
  join(root, 'drizzle', '0000_famous_hannibal_king.sql'),
  'utf8',
);
const generated = await readFile(
  join(root, 'app', 'lib', 'generated', 'univ-portable-workload.js'),
  'utf8',
);

assert(
  page.includes('Approve one release. Prove it behaved the same everywhere.'),
  'organization-facing release-gate framing is missing',
);
assert(
  page.includes('browser-wasi') && page.includes('sites-edge-wasi'),
  'both explicit targets must be visible',
);
assert(
  page.includes('Portability frontier + runtime witness'),
  'visible compiler-to-witness chain is missing',
);
assert(
  page.includes('Copy durable proof link') &&
    page.includes('Download receipt JSON'),
  'durable evidence handoff is missing',
);
assert(
  page.includes('Judge this with one prompt'),
  'one-prompt judge journey is missing',
);
assert(
  page.includes('setPlan(next.selectedPlan)'),
  'creating a permitted handoff must replace any previously displayed blocked plan',
);
assert(
  page.includes(
    'const receiptPlan = await planDeployment(next.receipt.manifestId)',
  ),
  'deployment receipt must re-anchor the displayed plan',
);
assert(
  page.includes('setPlan(receiptPlan)'),
  'deployment completion must synchronize the displayed plan',
);
assert(
  page.includes('via WebMCP'),
  'visible WebMCP provenance label is missing',
);
assert(
  page.includes('External attestation / outside this proof'),
  'attestation caveat is missing',
);
assert(
  page.includes("item.state === 'REFUSED' ? 'text-[#ff9d91]'"),
  'timeline details must reserve red for refused calls',
);
assert(
  page.includes('authenticated approval is future work'),
  'attestation absence must be presented as a limitation, not a failure',
);
for (const tool of [
  'get_univ_capabilities',
  'compile_univ_deployment',
  'create_deployment_handoff',
  'deploy_univ_manifest',
  'get_deployment_evidence',
]) {
  assert(page.includes(`'${tool}'`), `WebMCP tool missing: ${tool}`);
}
assert(
  contract.includes("'portable-release-v1'") &&
    contract.includes("'network-bound-release-v1'"),
  'closed manifest model is incomplete',
);
assert(
  contract.includes('actualTargetsExecuted: 2'),
  'two-target portability receipt is missing',
);
assert(
  contract.includes('identityAuthorized: false'),
  'handoff assurance limit is missing',
);
assert(
  contract.includes("schemaVersion: 'univ.deployment-receipt/v3'") &&
    contract.includes("schemaVersion: 'univ.runtime-portability-witness/v1'"),
  'runtime portability witness is not bound into the final receipt',
);
assert(
  contract.includes("release: DeploymentManifest['release']") &&
    receiptVerifier.includes('Receipt release identity mismatch refused.'),
  'durable receipt must bind and re-verify the named release identity',
);
assert(
  contract.includes('handoff: DeploymentHandoff') &&
    receiptVerifier.includes('{ allowExpired: true }') &&
    receiptVerifier.includes('Receipt handoff binding mismatch refused.'),
  'durable receipt must carry a re-verifiable historical handoff envelope',
);
assert(
  contract.includes('EXPECTED_WORKLOAD_RESULT') &&
    receiptVerifier.includes(
      'component output does not match the pinned workload.',
    ) &&
    receiptVerifier.includes('Evidence claim language mismatch refused.'),
  'receipt verifier must bind the exact pinned workload and claim taxonomy',
);
assert(
  contract.includes("schemaVersion: 'univ.deployment-handoff/v2'") &&
    contract.includes('executionCapsules'),
  'compiled capsules are not bound into the handoff',
);
assert(
  compiler.includes('TARGET_PASSPORTS') &&
    compiler.includes('compileDeploymentProgram'),
  'target-passport compiler is missing',
);
assert(
  compiler.includes("'univ.compatibility-certificate/v1'") &&
    compiler.includes("'univ.execution-capsule/v1'"),
  'compiler proof artifacts are incomplete',
);
assert(
  capsuleVerifier.includes('verifyCompatibilityCertificate') &&
    capsuleVerifier.includes('verifyExecutionCapsule'),
  'independent capsule verifier is missing',
);
assert(
  !capsuleVerifier.includes('import {\n  compileDeploymentProgram'),
  'capsule verifier must not import the compiler implementation',
);
assert(
  receiptVerifier.includes('verifyDeploymentReceipt') &&
    receiptVerifier.includes('receipt-integrity-digest'),
  'edge-side receipt verifier is missing',
);
assert(
  receiptVerifier.includes('honest-attestation-boundary'),
  'receipt verifier must preserve the attestation boundary',
);
assert(
  client.includes("binding: 'sha256-before-instantiation'"),
  'browser runtime digest gate is missing',
);
assert(
  client.includes('capsuleDigest: capsule.capsuleDigest'),
  'browser receipt is not bound to its execution capsule',
);
assert(
  client.includes("fetch('/api/evidence'"),
  'successful executions must persist their bounded evidence',
);
assert(
  client.includes('getDeploymentEvidence') &&
    client.includes('`/api/evidence/${encodeURIComponent(evidenceId)}`'),
  'durable evidence retrieval is missing',
);
assert(
  edge.includes("binding: 'static-compiled-module-import'"),
  'edge static-module binding is missing',
);
assert(
  edge.includes('capsuleDigest: capsule.capsuleDigest'),
  'edge receipt is not bound to its execution capsule',
);
assert(
  edge.includes('runtimeSha256Observed: false'),
  'edge runtime hash limitation is not explicit',
);
assert(
  edge.includes('Workers clock may remain at zero'),
  'edge timing limitation is not explicit',
);
assert(
  runtime.includes('enableNetwork: false'),
  'guest networking must remain disabled',
);
assert(
  ['upload', 'shell', 'native', 'OCI', 'worker', 'daemon', 'QEMU'].every(
    (name) => contract.includes(`'${name}'`),
  ),
  'closed public boundary is not documented',
);
assert(
  hosting.d1 === 'DB' && hosting.r2 === null,
  'D1 must be the only persistent Sites binding',
);
assert(
  evidenceSchema.includes("sqliteTable('deployment_evidence'"),
  'bounded evidence schema is missing',
);
assert(
  migration.includes('CREATE TABLE `deployment_evidence`') &&
    migration.includes('CREATE UNIQUE INDEX'),
  'D1 evidence migration is incomplete',
);
assert(
  evidenceWriter.includes('MAX_EVIDENCE_BYTES = 64 * 1024') &&
    evidenceWriter.includes('INSERT OR IGNORE INTO deployment_evidence'),
  'bounded idempotent evidence storage is missing',
);
assert(
  evidenceReader.includes('verifyDeploymentReceipt') &&
    evidenceReader.includes('Stored evidence digest mismatch refused.'),
  'evidence retrieval must re-verify stored receipts',
);
assert(
  !page.includes('hello-wasi') && !contract.includes('minimal-command-v1'),
  'stale component name found',
);
assert(
  !generated.includes('node:'),
  'browser transpilation unexpectedly imports Node built-ins',
);

console.log(
  'UNIV Deploy verification passed: release-gate compilation, target passports, verified capsules, two real runtimes, durable D1 evidence, retrieval verification, and authority limits are intact.',
);
