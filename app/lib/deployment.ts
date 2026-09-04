import {
  COMPONENT_ID,
  CORE_DIGESTS,
  EVIDENCE_CLAIMS,
  MANIFESTS,
  OUTPUT_LIMIT_BYTES,
  createDeploymentHandoff,
  sha256Bytes,
  sha256Object,
  validateDeploymentHandoff,
  type CoreModuleName,
  type DeploymentHandoff,
  type DeploymentReceipt,
  type InvocationSource,
  type TargetId,
  type TargetReceipt,
} from './deployment-contract';
import { executePortableWorkload } from './wasi-runtime';
import type { ReceiptVerification } from './deployment-receipt-verifier';

const handoffStore = new Map<string, DeploymentHandoff>();

export interface DurableEvidenceRecord {
  stored: true;
  durable: true;
  storedAt: string;
  sharePath: string;
  verification: ReceiptVerification;
}

export interface DeploymentRunResult {
  receipt: DeploymentReceipt;
  evidence: DurableEvidenceRecord;
}

export async function createStoredHandoff(
  manifestId: unknown,
): Promise<DeploymentHandoff> {
  const handoff = await createDeploymentHandoff(manifestId);
  handoffStore.set(handoff.handoffId, handoff);
  return handoff;
}

async function executeBrowserTarget(
  handoff: DeploymentHandoff,
): Promise<TargetReceipt> {
  await validateDeploymentHandoff(handoff, 'browser-wasi');
  const capsule = handoff.executionCapsules.find(
    (item) => item.targetId === 'browser-wasi',
  );
  if (!capsule) throw new Error('Verified browser execution capsule missing.');
  const observedCoreDigests = {} as Record<CoreModuleName, string>;
  const result = await executePortableWorkload(async (name) => {
    if (!(name in CORE_DIGESTS))
      throw new Error(`Unlisted executable module refused: ${name}`);
    const response = await fetch(`/wasm/${name}`, { cache: 'no-store' });
    if (!response.ok)
      throw new Error(`Included WASI module unavailable (${response.status}).`);
    const bytes = await response.arrayBuffer();
    const digest = await sha256Bytes(bytes);
    observedCoreDigests[name] = digest;
    if (digest !== CORE_DIGESTS[name])
      throw new Error(`Digest mismatch refused before instantiation: ${name}`);
    return WebAssembly.compile(bytes);
  });
  const allRuntimeDigestsMatched = Object.entries(CORE_DIGESTS).every(
    ([name, digest]) => observedCoreDigests[name as CoreModuleName] === digest,
  );
  if (!allRuntimeDigestsMatched)
    throw new Error(
      'Browser runtime did not observe every required core-module digest.',
    );
  return {
    schemaVersion: 'univ.target-receipt/v2',
    targetId: 'browser-wasi',
    environment: 'browser main thread + WebAssembly',
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
    hostObserved: result.hostObserved,
    artifactVerification: {
      runtimeSha256Observed: true,
      binding: 'sha256-before-instantiation',
      expectedCoreDigests: CORE_DIGESTS,
      observedCoreDigests,
      allRuntimeDigestsMatched: true,
      buildGate:
        'Public CI verifies source component and generated browser assets against diagnostic/manifest.json.',
    },
    componentReported: result.componentReported,
  };
}

function assertTargetReceipt(
  value: unknown,
  targetId: 'sites-edge-wasi',
): asserts value is TargetReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Edge returned a malformed target receipt.');
  const receipt = value as Partial<TargetReceipt>;
  if (
    receipt.schemaVersion !== 'univ.target-receipt/v2' ||
    receipt.targetId !== targetId ||
    receipt.execution !== 'actual' ||
    receipt.manifestId !== 'portable-release-v1' ||
    receipt.componentId !== COMPONENT_ID ||
    typeof receipt.capsuleDigest !== 'string' ||
    receipt.hostObserved?.termination !== 'completed' ||
    receipt.componentReported?.status !== 'HEALTHY' ||
    receipt.artifactVerification?.runtimeSha256Observed !== false
  ) {
    throw new Error('Edge returned an unexpected target receipt.');
  }
}

async function executeEdgeTarget(
  handoff: DeploymentHandoff,
): Promise<TargetReceipt> {
  const response = await fetch('/api/targets/sites-edge-wasi', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ handoff }),
  });
  const payload = (await response.json().catch(() => null)) as {
    receipt?: unknown;
    error?: unknown;
  } | null;
  if (!response.ok)
    throw new Error(
      typeof payload?.error === 'string'
        ? payload.error
        : `Edge handoff failed (${response.status}).`,
    );
  assertTargetReceipt(payload?.receipt, 'sites-edge-wasi');
  if (payload.receipt.handoffId !== handoff.handoffId)
    throw new Error('Edge receipt handoff mismatch.');
  const capsule = handoff.executionCapsules.find(
    (item) => item.targetId === 'sites-edge-wasi',
  );
  if (!capsule || payload.receipt.capsuleDigest !== capsule.capsuleDigest)
    throw new Error('Edge receipt capsule mismatch.');
  return payload.receipt;
}

export async function deployStoredHandoff(
  handoffId: unknown,
  handoffDigest: unknown,
  source: InvocationSource,
): Promise<DeploymentRunResult> {
  if (typeof handoffId !== 'string' || typeof handoffDigest !== 'string')
    throw new Error('Exact handoff ID and digest are required.');
  const handoff = handoffStore.get(handoffId);
  if (!handoff || handoff.handoffDigest !== handoffDigest)
    throw new Error('Session-local handoff not found or digest mismatch.');
  await validateDeploymentHandoff(handoff);
  const browserReceipt = await executeBrowserTarget(handoff);
  const edgeReceipt = await executeEdgeTarget(handoff);
  if (
    browserReceipt.hostObserved.workloadOutputSha256 !==
      edgeReceipt.hostObserved.workloadOutputSha256 ||
    JSON.stringify(browserReceipt.componentReported) !==
      JSON.stringify(edgeReceipt.componentReported)
  ) {
    throw new Error(
      'Portability comparison failed: target workload outputs differ.',
    );
  }
  const evidenceId = crypto.randomUUID();
  const capsuleDigests = {
    'browser-wasi': browserReceipt.capsuleDigest,
    'sites-edge-wasi': edgeReceipt.capsuleDigest,
  };
  const withoutDigest = {
    schemaVersion: 'univ.deployment-receipt/v3' as const,
    evidenceId,
    source,
    createdAt: new Date().toISOString(),
    manifestId: 'portable-release-v1' as const,
    release: MANIFESTS['portable-release-v1'].release,
    manifestDigest: handoff.manifestDigest,
    programDigest: handoff.programDigest,
    handoffId: handoff.handoffId,
    handoffDigest: handoff.handoffDigest,
    handoff,
    capsuleDigests,
    enforcementGrade: 'CLOSED_MANIFEST_PINNED_ARTIFACTS' as const,
    targetReceipts: [browserReceipt, edgeReceipt],
    portability: {
      actualTargetsExecuted: 2 as const,
      sameManifest: true as const,
      sameComponent: true as const,
      sameWorkloadOutput: true as const,
      workloadOutputSha256: browserReceipt.hostObserved.workloadOutputSha256,
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
        outputSha256: browserReceipt.hostObserved.workloadOutputSha256,
        status: browserReceipt.componentReported.status,
        workloadId: browserReceipt.componentReported.workloadId,
      },
      equivalentOverDeclaredObservations: true as const,
      limitations: [
        'Equivalence is limited to the named observation fields and executed targets.',
        'No claim is made for unobserved behavior or unregistered hosts.',
      ],
    },
    evidenceClaims: EVIDENCE_CLAIMS,
  };
  const receipt: DeploymentReceipt = {
    ...withoutDigest,
    evidenceDigest: await sha256Object(withoutDigest),
  };
  handoffStore.delete(handoffId);
  const response = await fetch('/api/evidence', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(receipt),
  });
  const payload = (await response.json().catch(() => null)) as
    | (DurableEvidenceRecord & { receipt?: DeploymentReceipt; error?: unknown })
    | null;
  if (
    !response.ok ||
    payload?.stored !== true ||
    payload.durable !== true ||
    payload.verification?.verified !== true
  ) {
    throw new Error(
      typeof payload?.error === 'string'
        ? payload.error
        : `Evidence persistence failed (${response.status}).`,
    );
  }
  return { receipt, evidence: payload };
}

export async function getDeploymentEvidence(
  evidenceId: unknown,
): Promise<DeploymentRunResult> {
  if (typeof evidenceId !== 'string' || !/^[0-9a-f-]{36}$/.test(evidenceId))
    throw new Error('Evidence ID must be a UUID.');
  const response = await fetch(
    `/api/evidence/${encodeURIComponent(evidenceId)}`,
    { cache: 'no-store' },
  );
  const payload = (await response.json().catch(() => null)) as
    | (DurableEvidenceRecord & { receipt?: DeploymentReceipt; error?: unknown })
    | null;
  if (
    !response.ok ||
    !payload?.receipt ||
    payload.stored !== true ||
    payload.durable !== true ||
    payload.verification?.verified !== true
  ) {
    throw new Error(
      typeof payload?.error === 'string'
        ? payload.error
        : `Evidence retrieval failed (${response.status}).`,
    );
  }
  return { receipt: payload.receipt, evidence: payload };
}
