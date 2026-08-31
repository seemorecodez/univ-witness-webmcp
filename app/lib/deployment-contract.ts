export const WORKLOAD_ID = 'release-inspector-v1' as const;
export const COMPONENT_ID = 'univ-portable-workload-v1' as const;
export const OUTPUT_LIMIT_BYTES = 4_096;
export const HANDOFF_TTL_MS = 5 * 60 * 1_000;

export const CORE_DIGESTS = {
  'univ-portable-workload.core.wasm': 'ed7d4da018b95412204c27bac278d8ae1c8b97f70a9c181b6d70ff9a312608b3',
  'univ-portable-workload.core2.wasm': '408f82de838034d97d89cd3855c41c48f7e3af6e096b5a4d24dfb5975e1900a5',
  'univ-portable-workload.core3.wasm': '0df3129978bb49e53f8da9d7f2d92a9f836c374e3f92fc61c39c57b39a01f7a7',
} as const;

export type CoreModuleName = keyof typeof CORE_DIGESTS;
export type TargetId = 'browser-wasi' | 'sites-edge-wasi';
export type ManifestId = 'portable-release-v1' | 'network-bound-release-v1';
export type InvocationSource = 'human' | 'WebMCP';

export interface DeploymentManifest {
  schemaVersion: 'univ.deployment-manifest/v1';
  manifestId: ManifestId;
  label: string;
  description: string;
  workload: {
    componentId: typeof COMPONENT_ID;
    workloadId: typeof WORKLOAD_ID;
    sourceComponentSha256: string;
    coreModuleSha256: typeof CORE_DIGESTS;
  };
  targets: readonly TargetId[];
  requirements: {
    guestNetwork: 'disabled' | 'required';
    filesystemPreopens: 0;
    environmentVariables: 0;
    outputCaptureLimitBytes: typeof OUTPUT_LIMIT_BYTES;
  };
  policy: {
    arbitraryCode: 'refused';
    arbitraryArguments: 'refused';
    arbitraryUrls: 'refused';
    deploymentMode: 'one-shot';
  };
}

export const MANIFESTS: Record<ManifestId, DeploymentManifest> = {
  'portable-release-v1': {
    schemaVersion: 'univ.deployment-manifest/v1',
    manifestId: 'portable-release-v1',
    label: 'Portable release inventory',
    description: 'Deploy the same included WASI workload to the browser and OpenAI Sites edge.',
    workload: {
      componentId: COMPONENT_ID,
      workloadId: WORKLOAD_ID,
      sourceComponentSha256: '99f1b53ecb4a3400d802dea49e733b2409d4b9c65c770645d2f54c8dac3cacb0',
      coreModuleSha256: CORE_DIGESTS,
    },
    targets: ['browser-wasi', 'sites-edge-wasi'],
    requirements: {
      guestNetwork: 'disabled',
      filesystemPreopens: 0,
      environmentVariables: 0,
      outputCaptureLimitBytes: OUTPUT_LIMIT_BYTES,
    },
    policy: {
      arbitraryCode: 'refused',
      arbitraryArguments: 'refused',
      arbitraryUrls: 'refused',
      deploymentMode: 'one-shot',
    },
  },
  'network-bound-release-v1': {
    schemaVersion: 'univ.deployment-manifest/v1',
    manifestId: 'network-bound-release-v1',
    label: 'Network-bound release inventory',
    description: 'Negative-control manifest that is blocked before handoff because it requires guest networking.',
    workload: {
      componentId: COMPONENT_ID,
      workloadId: WORKLOAD_ID,
      sourceComponentSha256: '99f1b53ecb4a3400d802dea49e733b2409d4b9c65c770645d2f54c8dac3cacb0',
      coreModuleSha256: CORE_DIGESTS,
    },
    targets: ['browser-wasi', 'sites-edge-wasi'],
    requirements: {
      guestNetwork: 'required',
      filesystemPreopens: 0,
      environmentVariables: 0,
      outputCaptureLimitBytes: OUTPUT_LIMIT_BYTES,
    },
    policy: {
      arbitraryCode: 'refused',
      arbitraryArguments: 'refused',
      arbitraryUrls: 'refused',
      deploymentMode: 'one-shot',
    },
  },
};

export interface DeploymentPlan {
  schemaVersion: 'univ.deployment-plan/v1';
  manifestId: ManifestId;
  manifestDigest: string;
  decision: 'PERMIT' | 'BLOCK';
  enforcementGrade: 'CLOSED_MANIFEST_PINNED_ARTIFACTS';
  targets: Array<{
    targetId: TargetId;
    modeled: true;
    execution: 'actual';
    runtime: string;
    artifactBinding: string;
  }>;
  reasons: string[];
  controlledHandoffAvailable: boolean;
  configuredAndEnforced: string[];
}

export interface DeploymentHandoff {
  schemaVersion: 'univ.deployment-handoff/v1';
  handoffId: string;
  handoffDigest: string;
  manifestId: 'portable-release-v1';
  manifestDigest: string;
  componentId: typeof COMPONENT_ID;
  sourceComponentSha256: string;
  coreModuleSha256: typeof CORE_DIGESTS;
  targets: TargetId[];
  constraints: {
    guestNetwork: 'disabled';
    filesystemPreopens: 0;
    environmentVariables: 0;
    arbitraryCode: 'refused';
  };
  createdAt: string;
  expiresAt: string;
  integrityBound: true;
  identityAuthorized: false;
}

export interface WorkloadResult {
  schemaVersion: 'univ.workload-result/v1';
  manifestId: 'portable-release-v1';
  workloadId: typeof WORKLOAD_ID;
  status: 'HEALTHY';
  summary: string;
  records: Array<{ id: string; value: string }>;
}

export interface RuntimeObservation {
  termination: 'completed';
  durationMs: number;
  timingSource: 'performance.now';
  timingNote?: string;
  stdoutCapturedBytes: number;
  stdoutWrittenBytes: number;
  stdoutTruncated: boolean;
  workloadOutputSha256: string;
}

export interface TargetReceipt {
  schemaVersion: 'univ.target-receipt/v1';
  targetId: TargetId;
  environment: string;
  execution: 'actual';
  handoffId: string;
  manifestId: 'portable-release-v1';
  componentId: typeof COMPONENT_ID;
  configuredAndEnforced: {
    guestNetwork: 'disabled';
    filesystemPreopens: 0;
    environmentVariables: 0;
    outputCaptureLimitBytes: typeof OUTPUT_LIMIT_BYTES;
  };
  hostObserved: RuntimeObservation;
  artifactVerification: {
    runtimeSha256Observed: boolean;
    binding: 'sha256-before-instantiation' | 'static-compiled-module-import';
    expectedCoreDigests: typeof CORE_DIGESTS;
    observedCoreDigests?: Record<CoreModuleName, string>;
    allRuntimeDigestsMatched?: true;
    buildGate: string;
  };
  componentReported: WorkloadResult;
}

export interface DeploymentReceipt {
  schemaVersion: 'univ.deployment-receipt/v1';
  evidenceId: string;
  evidenceDigest: string;
  source: InvocationSource;
  createdAt: string;
  manifestId: 'portable-release-v1';
  manifestDigest: string;
  handoffId: string;
  handoffDigest: string;
  enforcementGrade: 'CLOSED_MANIFEST_PINNED_ARTIFACTS';
  targetReceipts: TargetReceipt[];
  portability: {
    actualTargetsExecuted: 2;
    sameManifest: true;
    sameComponent: true;
    sameWorkloadOutput: true;
    workloadOutputSha256: string;
    portableAcrossExecutedTargets: true;
  };
  evidenceClaims: {
    configuredAndEnforced: string;
    activelyObserved: string;
    buildPinned: string;
    independentAttestation: { present: false; note: string };
  };
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256Bytes(bytes: BufferSource): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', bytes));
}

export async function sha256Object(value: unknown): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(canonicalize(value)));
}

export function assertManifestId(value: unknown): asserts value is ManifestId {
  if (typeof value !== 'string' || !(value in MANIFESTS)) {
    throw new Error('Closed input rejected: choose one included deployment manifest.');
  }
}

export async function planDeployment(value: unknown): Promise<DeploymentPlan> {
  assertManifestId(value);
  const manifest = MANIFESTS[value];
  const decision = manifest.requirements.guestNetwork === 'disabled' ? 'PERMIT' : 'BLOCK';
  return {
    schemaVersion: 'univ.deployment-plan/v1',
    manifestId: value,
    manifestDigest: await sha256Object(manifest),
    decision,
    enforcementGrade: 'CLOSED_MANIFEST_PINNED_ARTIFACTS',
    targets: [
      {
        targetId: 'browser-wasi',
        modeled: true,
        execution: 'actual',
        runtime: 'browser main thread + WebAssembly',
        artifactBinding: 'runtime SHA-256 before instantiation',
      },
      {
        targetId: 'sites-edge-wasi',
        modeled: true,
        execution: 'actual',
        runtime: 'OpenAI Sites / Cloudflare Workers edge',
        artifactBinding: 'CI-pinned static compiled-module import',
      },
    ],
    reasons: decision === 'PERMIT'
      ? ['Both targets satisfy the manifest without guest network, filesystem preopens, environment variables, or arbitrary inputs.']
      : ['Guest networking is required by the manifest but disabled on every exposed target.'],
    controlledHandoffAvailable: decision === 'PERMIT',
    configuredAndEnforced: [
      'Closed manifest allowlist; no arbitrary code, bytes, path, URL, or arguments',
      'One included source component and three digest-pinned generated core modules',
      'Only browser-wasi and sites-edge-wasi may receive a handoff',
      `${OUTPUT_LIMIT_BYTES.toLocaleString()}-byte stdout capture ceiling`,
    ],
  };
}

export async function createDeploymentHandoff(value: unknown): Promise<DeploymentHandoff> {
  const plan = await planDeployment(value);
  if (plan.decision !== 'PERMIT' || plan.manifestId !== 'portable-release-v1') {
    throw new Error('Handoff refused: the selected manifest does not satisfy the exposed target policy.');
  }
  const manifest = MANIFESTS['portable-release-v1'];
  const createdAt = new Date();
  const withoutDigest = {
    schemaVersion: 'univ.deployment-handoff/v1' as const,
    handoffId: crypto.randomUUID(),
    manifestId: 'portable-release-v1' as const,
    manifestDigest: plan.manifestDigest,
    componentId: COMPONENT_ID,
    sourceComponentSha256: manifest.workload.sourceComponentSha256,
    coreModuleSha256: CORE_DIGESTS,
    targets: [...manifest.targets],
    constraints: {
      guestNetwork: 'disabled' as const,
      filesystemPreopens: 0 as const,
      environmentVariables: 0 as const,
      arbitraryCode: 'refused' as const,
    },
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + HANDOFF_TTL_MS).toISOString(),
    integrityBound: true as const,
    identityAuthorized: false as const,
  };
  return { ...withoutDigest, handoffDigest: await sha256Object(withoutDigest) };
}

function exactKeys(record: Record<string, unknown>, expected: string[]): boolean {
  const actual = Object.keys(record).sort();
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index]);
}

export async function validateDeploymentHandoff(value: unknown, targetId?: TargetId): Promise<DeploymentHandoff> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Malformed deployment handoff refused.');
  const candidate = value as Record<string, unknown>;
  const keys = ['schemaVersion', 'handoffId', 'handoffDigest', 'manifestId', 'manifestDigest', 'componentId', 'sourceComponentSha256', 'coreModuleSha256', 'targets', 'constraints', 'createdAt', 'expiresAt', 'integrityBound', 'identityAuthorized'];
  if (!exactKeys(candidate, keys)) throw new Error('Unexpected handoff fields refused.');
  if (candidate.schemaVersion !== 'univ.deployment-handoff/v1' || candidate.manifestId !== 'portable-release-v1' || candidate.componentId !== COMPONENT_ID) {
    throw new Error('Unknown handoff contract refused.');
  }
  if (typeof candidate.handoffId !== 'string' || !/^[0-9a-f-]{36}$/.test(candidate.handoffId)) throw new Error('Invalid handoff ID refused.');
  if (typeof candidate.handoffDigest !== 'string' || !/^[0-9a-f]{64}$/.test(candidate.handoffDigest)) throw new Error('Invalid handoff digest refused.');
  if (candidate.integrityBound !== true || candidate.identityAuthorized !== false) throw new Error('Invalid handoff assurance flags refused.');
  if (!Array.isArray(candidate.targets) || candidate.targets.length !== 2 || candidate.targets[0] !== 'browser-wasi' || candidate.targets[1] !== 'sites-edge-wasi') {
    throw new Error('Unknown target set refused.');
  }
  if (targetId && !candidate.targets.includes(targetId)) throw new Error('Target is not bound to this handoff.');
  if (typeof candidate.expiresAt !== 'string' || Date.parse(candidate.expiresAt) <= Date.now()) throw new Error('Expired deployment handoff refused.');
  const expectedManifestDigest = await sha256Object(MANIFESTS['portable-release-v1']);
  if (candidate.manifestDigest !== expectedManifestDigest) throw new Error('Manifest digest mismatch refused.');
  if (candidate.sourceComponentSha256 !== MANIFESTS['portable-release-v1'].workload.sourceComponentSha256) throw new Error('Source component digest mismatch refused.');
  if (canonicalize(candidate.coreModuleSha256) !== canonicalize(CORE_DIGESTS)) throw new Error('Core-module digest set mismatch refused.');
  if (canonicalize(candidate.constraints) !== canonicalize({ guestNetwork: 'disabled', filesystemPreopens: 0, environmentVariables: 0, arbitraryCode: 'refused' })) {
    throw new Error('Handoff constraints mismatch refused.');
  }
  const { handoffDigest, ...withoutDigest } = candidate;
  if (await sha256Object(withoutDigest) !== handoffDigest) throw new Error('Handoff integrity digest mismatch refused.');
  return candidate as unknown as DeploymentHandoff;
}

export function getCapabilities() {
  return {
    service: 'UNIV Deploy',
    audience: 'Platform, release, and security teams',
    workflow: 'Plan one manifest, hand it to two explicit WASI targets, execute both, and compare bounded receipts.',
    manifests: Object.keys(MANIFESTS),
    actualTargets: ['browser-wasi', 'sites-edge-wasi'],
    workloadIds: [WORKLOAD_ID],
    executableSurface: 'included digest-pinned WASI component only',
    unavailablePaths: ['upload', 'shell', 'native', 'OCI', 'worker', 'daemon', 'QEMU', 'arbitrary URL', 'arbitrary bytes'],
    assuranceBoundary: 'Handoffs are integrity-bound and expiring; they are not authenticated identity authorization or independent attestation.',
  };
}
