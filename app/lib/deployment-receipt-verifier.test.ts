import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMPONENT_ID,
  CORE_DIGESTS,
  EVIDENCE_CLAIMS,
  EXPECTED_WORKLOAD_RESULT,
  HANDOFF_TTL_MS,
  MANIFESTS,
  OUTPUT_LIMIT_BYTES,
  WORKLOAD_ID,
  createDeploymentHandoff,
  sha256Bytes,
  sha256Object,
  type DeploymentHandoff,
  type DeploymentReceipt,
  type TargetId,
  type TargetReceipt,
} from './deployment-contract';
import { verifyDeploymentReceipt } from './deployment-receipt-verifier';

function clone<T>(value: T): T {
  return structuredClone(value);
}

async function resignHandoff(handoff: DeploymentHandoff) {
  const { handoffDigest: _previous, ...withoutDigest } = handoff;
  handoff.handoffDigest = await sha256Object(withoutDigest);
}

async function resignReceipt(receipt: DeploymentReceipt) {
  const { evidenceDigest: _previous, ...withoutDigest } = receipt;
  receipt.evidenceDigest = await sha256Object(withoutDigest);
}

async function makeTargetReceipt(
  handoff: DeploymentHandoff,
  targetId: TargetId,
  outputDigest: string,
  outputBytes: number,
): Promise<TargetReceipt> {
  const capsule = handoff.executionCapsules.find(
    (candidate) => candidate.targetId === targetId,
  );
  assert(capsule);
  const browser = targetId === 'browser-wasi';
  return {
    schemaVersion: 'univ.target-receipt/v2',
    targetId,
    environment: browser
      ? 'browser main thread + WebAssembly'
      : 'OpenAI Sites / Cloudflare Workers edge',
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
      termination: 'completed',
      durationMs: browser ? 4.2 : 0,
      timingSource: 'performance.now',
      ...(browser
        ? {}
        : {
            timingNote:
              'The Workers clock may remain at zero during an invocation; termination and output are observed, but sub-millisecond elapsed time is not claimed.',
          }),
      stdoutCapturedBytes: outputBytes,
      stdoutWrittenBytes: outputBytes,
      stdoutTruncated: false,
      workloadOutputSha256: outputDigest,
    },
    artifactVerification: browser
      ? {
          runtimeSha256Observed: true,
          binding: 'sha256-before-instantiation',
          expectedCoreDigests: CORE_DIGESTS,
          observedCoreDigests: CORE_DIGESTS,
          allRuntimeDigestsMatched: true,
          buildGate:
            'Public CI verifies source component and generated browser assets against diagnostic/manifest.json.',
        }
      : {
          runtimeSha256Observed: false,
          binding: 'static-compiled-module-import',
          expectedCoreDigests: CORE_DIGESTS,
          buildGate:
            'CI pins generated core assets to diagnostic/manifest.json; the edge runtime receives static WebAssembly.Module bindings and does not expose their bytes for runtime re-hashing.',
        },
    componentReported: clone(EXPECTED_WORKLOAD_RESULT),
  };
}

async function makeValidReceipt(): Promise<DeploymentReceipt> {
  const handoff = await createDeploymentHandoff('portable-release-v1');
  const outputText = JSON.stringify(EXPECTED_WORKLOAD_RESULT);
  const outputDigest = await sha256Bytes(new TextEncoder().encode(outputText));
  const outputBytes = new TextEncoder().encode(`${outputText}\n`).byteLength;
  const targetReceipts = await Promise.all([
    makeTargetReceipt(handoff, 'browser-wasi', outputDigest, outputBytes),
    makeTargetReceipt(handoff, 'sites-edge-wasi', outputDigest, outputBytes),
  ]);
  const withoutDigest = {
    schemaVersion: 'univ.deployment-receipt/v3' as const,
    evidenceId: crypto.randomUUID(),
    source: 'WebMCP' as const,
    createdAt: new Date().toISOString(),
    manifestId: 'portable-release-v1' as const,
    release: MANIFESTS['portable-release-v1'].release,
    manifestDigest: handoff.manifestDigest,
    programDigest: handoff.programDigest,
    handoffId: handoff.handoffId,
    handoffDigest: handoff.handoffDigest,
    handoff,
    capsuleDigests: {
      'browser-wasi': targetReceipts[0].capsuleDigest,
      'sites-edge-wasi': targetReceipts[1].capsuleDigest,
    },
    enforcementGrade: 'CLOSED_MANIFEST_PINNED_ARTIFACTS' as const,
    targetReceipts,
    portability: {
      actualTargetsExecuted: 2 as const,
      sameManifest: true as const,
      sameComponent: true as const,
      sameWorkloadOutput: true as const,
      workloadOutputSha256: outputDigest,
      portableAcrossExecutedTargets: true as const,
    },
    runtimeWitness: {
      schemaVersion: 'univ.runtime-portability-witness/v1' as const,
      programDigest: handoff.programDigest,
      requiredObservations: [
        'componentId',
        'manifestId',
        'outputSha256',
        'status',
        'workloadId',
      ],
      actualTargets: ['browser-wasi', 'sites-edge-wasi'] as TargetId[],
      sharedObservation: {
        componentId: COMPONENT_ID,
        manifestId: 'portable-release-v1' as const,
        outputSha256: outputDigest,
        status: 'HEALTHY' as const,
        workloadId: WORKLOAD_ID,
      },
      equivalentOverDeclaredObservations: true as const,
      limitations: [
        'Equivalence is limited to the named observation fields and executed targets.',
        'No claim is made for unobserved behavior or unregistered hosts.',
      ],
    },
    evidenceClaims: clone(EVIDENCE_CLAIMS),
  };
  return {
    ...withoutDigest,
    evidenceDigest: await sha256Object(withoutDigest),
  };
}

await test('accepts a self-contained receipt after its handoff expires', async () => {
  const receipt = await makeValidReceipt();
  const createdAt = Date.parse('2026-01-01T00:00:00.000Z');
  receipt.handoff.createdAt = new Date(createdAt).toISOString();
  receipt.handoff.expiresAt = new Date(
    createdAt + HANDOFF_TTL_MS,
  ).toISOString();
  receipt.createdAt = new Date(createdAt + 1_000).toISOString();
  await resignHandoff(receipt.handoff);
  receipt.handoffDigest = receipt.handoff.handoffDigest;
  await resignReceipt(receipt);
  const verified = await verifyDeploymentReceipt(receipt);
  assert.equal(verified.verification.verified, true);
  assert.equal(verified.verification.checks.length, 6);
});

await test('rejects a handoff whose enforced authority changed', async () => {
  const receipt = await makeValidReceipt();
  (receipt.handoff.constraints as { guestNetwork: string }).guestNetwork =
    'enabled';
  await assert.rejects(
    verifyDeploymentReceipt(receipt),
    /Handoff constraints mismatch refused/,
  );
});

await test('rejects component output not produced by the pinned workload', async () => {
  const receipt = await makeValidReceipt();
  receipt.targetReceipts[0].componentReported.records[0].value = 'unknown';
  await resignReceipt(receipt);
  await assert.rejects(
    verifyDeploymentReceipt(receipt),
    /component output does not match the pinned workload/,
  );
});

await test('rejects an independent-attestation overclaim', async () => {
  const receipt = await makeValidReceipt();
  (
    receipt.evidenceClaims.independentAttestation as { present: boolean }
  ).present = true;
  await resignReceipt(receipt);
  await assert.rejects(
    verifyDeploymentReceipt(receipt),
    /Independent attestation may not be inferred/,
  );
});

await test('rejects an altered final receipt digest', async () => {
  const receipt = await makeValidReceipt();
  receipt.evidenceDigest = '0'.repeat(64);
  await assert.rejects(
    verifyDeploymentReceipt(receipt),
    /Deployment receipt integrity digest mismatch refused/,
  );
});
