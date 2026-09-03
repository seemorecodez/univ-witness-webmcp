import core from '../../../lib/generated/univ-portable-workload.core.wasm?module';
import core2 from '../../../lib/generated/univ-portable-workload.core2.wasm?module';
import core3 from '../../../lib/generated/univ-portable-workload.core3.wasm?module';
import {
  COMPONENT_ID,
  CORE_DIGESTS,
  OUTPUT_LIMIT_BYTES,
  validateDeploymentHandoff,
  type CoreModuleName,
  type TargetReceipt,
} from '../../../lib/deployment-contract';
import { executePortableWorkload } from '../../../lib/wasi-runtime';

export const runtime = 'edge';

const compiledModules: Record<CoreModuleName, WebAssembly.Module> = {
  'univ-portable-workload.core.wasm': core,
  'univ-portable-workload.core2.wasm': core2,
  'univ-portable-workload.core3.wasm': core3,
};

let executionQueue = Promise.resolve();

function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = executionQueue.then(task, task);
  executionQueue = run.then(() => undefined, () => undefined);
  return run;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (!Number.isFinite(contentLength) || contentLength <= 0 || contentLength > 8_192) {
    return Response.json({ error: 'Bounded handoff body required.' }, { status: 413 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !('handoff' in body)) {
    return Response.json({ error: 'Closed handoff envelope required.' }, { status: 400 });
  }
  try {
    const handoff = await validateDeploymentHandoff((body as { handoff: unknown }).handoff, 'sites-edge-wasi');
    const capsule = handoff.executionCapsules.find((item) => item.targetId === 'sites-edge-wasi');
    if (!capsule) throw new Error('Verified edge execution capsule missing.');
    const result = await serialized(() => executePortableWorkload(async (name) => {
      const compiled = compiledModules[name];
      if (!compiled) throw new Error(`Unlisted executable module refused: ${name}`);
      return compiled;
    }));
    const receipt: TargetReceipt = {
      schemaVersion: 'univ.target-receipt/v2',
      targetId: 'sites-edge-wasi',
      environment: 'OpenAI Sites / Cloudflare Workers edge',
      execution: 'actual',
      handoffId: handoff.handoffId,
      capsuleDigest: capsule.capsuleDigest,
      manifestId: 'portable-release-v1',
      componentId: COMPONENT_ID,
      configuredAndEnforced: {
        guestNetwork: 'disabled',
        filesystemPreopens: 0,
        environmentVariables: 0,
        outputCaptureLimitBytes: OUTPUT_LIMIT_BYTES,
      },
      hostObserved: {
        ...result.hostObserved,
        timingNote: 'The Workers clock may remain at zero during an invocation; termination and output are observed, but sub-millisecond elapsed time is not claimed.',
      },
      artifactVerification: {
        runtimeSha256Observed: false,
        binding: 'static-compiled-module-import',
        expectedCoreDigests: CORE_DIGESTS,
        buildGate: 'CI pins generated core assets to diagnostic/manifest.json; the edge runtime receives static WebAssembly.Module bindings and does not expose their bytes for runtime re-hashing.',
      },
      componentReported: result.componentReported,
    };
    return Response.json({ receipt }, { headers: { 'cache-control': 'no-store' } });
  } catch (caught) {
    return Response.json({ error: caught instanceof Error ? caught.message : 'Edge execution failed.' }, { status: 400 });
  }
}
