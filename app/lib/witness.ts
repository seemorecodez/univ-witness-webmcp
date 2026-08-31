import { WASIShim } from '@bytecodealliance/preview2-shim/instantiation';
import * as cli from '@bytecodealliance/preview2-shim/cli';
import { instantiate } from './generated/witness-release-diagnostic.js';

export const COMPONENT_ID = 'release-policy-diagnostic-v1' as const;
export const OUTPUT_LIMIT_BYTES = 4_096;

export const PROFILES = {
  'approved-release-v1': {
    label: 'Approved release candidate',
    description: 'Included candidate with license, SBOM digest, provenance, and no unsafe runtime requirements.',
    expectedVerdict: 'PASS',
  },
  'blocked-release-v1': {
    label: 'Blocked release candidate',
    description: 'Included negative control missing release evidence and requesting unsafe runtime behavior.',
    expectedVerdict: 'BLOCK',
  },
} as const;

export type ProfileId = keyof typeof PROFILES;
export type InvocationSource = 'human' | 'WebMCP';

const CORE_DIGESTS = {
  'witness-release-diagnostic.core.wasm': 'd68feaf63019279c72af748a29527c74ac7a44023bea812a1e880712bcc5203c',
  'witness-release-diagnostic.core2.wasm': '408f82de838034d97d89cd3855c41c48f7e3af6e096b5a4d24dfb5975e1900a5',
  'witness-release-diagnostic.core3.wasm': '0df3129978bb49e53f8da9d7f2d92a9f836c374e3f92fc61c39c57b39a01f7a7',
} as const;

type CoreModuleName = keyof typeof CORE_DIGESTS;

export interface DiagnosticReport {
  schemaVersion: 'witness.diagnostic/v1';
  diagnosticId: 'release-policy-v1';
  profileId: ProfileId;
  verdict: 'PASS' | 'BLOCK';
  summary: string;
  checks: Array<{ id: string; observed: boolean }>;
}

export interface ExecutionReceipt {
  schemaVersion: 'witness.receipt/v1';
  evidenceId: string;
  evidenceDigest: string;
  source: InvocationSource;
  createdAt: string;
  componentId: typeof COMPONENT_ID;
  profileId: ProfileId;
  enforcementGrade: 'CLOSED_AND_PINNED';
  configuredAndEnforced: {
    closedProfileAllowlist: ProfileId[];
    digestGate: 'sha256-before-instantiation';
    filesystemPreopens: 0;
    environmentVariables: 0;
    guestNetwork: 'disabled';
    outputCaptureLimitBytes: number;
  };
  hostObserved: {
    coreDigests: Record<CoreModuleName, string>;
    allDigestsMatched: boolean;
    termination: 'completed';
    durationMs: number;
    stdoutCapturedBytes: number;
    stdoutWrittenBytes: number;
    stdoutTruncated: boolean;
  };
  componentReported: DiagnosticReport;
  independentAttestation: {
    present: false;
    note: string;
  };
}

export interface DiagnosticPlan {
  componentId: typeof COMPONENT_ID;
  profileId: ProfileId;
  enforcementGrade: 'CLOSED_AND_PINNED';
  executableSurface: 'included-wasi-component-only';
  expectedCoreDigests: typeof CORE_DIGESTS;
  configuredBoundaries: string[];
  caveat: string;
}

const evidenceStore = new Map<string, ExecutionReceipt>();

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(bytes: BufferSource): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', bytes));
}

function randomHex(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function assertProfileId(value: unknown): asserts value is ProfileId {
  if (typeof value !== 'string' || !(value in PROFILES)) {
    throw new Error('Closed input rejected: choose one included release profile.');
  }
}

export function getCapabilities() {
  return {
    service: 'UNIV Witness',
    audience: 'Release and security teams',
    workflow: 'Run only pre-approved diagnostics and return reviewable execution receipts without granting arbitrary code execution.',
    executableSurface: 'WASI only',
    componentIds: [COMPONENT_ID],
    profileIds: Object.keys(PROFILES),
    unavailablePaths: ['upload', 'shell', 'native', 'OCI', 'worker', 'daemon', 'QEMU'],
    evidenceLanguage: ['configuredAndEnforced', 'hostObserved', 'componentReported', 'independentAttestation'],
  };
}

export function planDiagnostic(profileId: unknown): DiagnosticPlan {
  assertProfileId(profileId);
  return {
    componentId: COMPONENT_ID,
    profileId,
    enforcementGrade: 'CLOSED_AND_PINNED',
    executableSurface: 'included-wasi-component-only',
    expectedCoreDigests: CORE_DIGESTS,
    configuredBoundaries: [
      'Closed profile enum; no arbitrary arguments',
      'SHA-256 gate on every executable core module before instantiation',
      'Zero filesystem preopens and zero environment variables',
      'Guest network disabled',
      `${OUTPUT_LIMIT_BYTES.toLocaleString()}-byte stdout capture ceiling`,
    ],
    caveat: 'This is browser-host evidence, not an independently signed or remotely attested execution.',
  };
}

function makeOutputCapture() {
  const decoder = new TextDecoder();
  let text = '';
  let writtenBytes = 0;
  let capturedBytes = 0;
  let truncated = false;

  return {
    handler: {
      write(contents: Uint8Array) {
        writtenBytes += contents.byteLength;
        const remaining = OUTPUT_LIMIT_BYTES - capturedBytes;
        if (remaining <= 0) {
          truncated = true;
          return;
        }
        const accepted = contents.subarray(0, remaining);
        capturedBytes += accepted.byteLength;
        truncated ||= accepted.byteLength < contents.byteLength;
        text += decoder.decode(accepted, { stream: true });
      },
      blockingFlush() {},
    },
    finish() {
      text += decoder.decode();
      return { text, writtenBytes, capturedBytes, truncated };
    },
  };
}

export async function runDiagnostic(profileId: unknown, source: InvocationSource): Promise<ExecutionReceipt> {
  assertProfileId(profileId);
  const stdout = makeOutputCapture();
  const stderr = makeOutputCapture();
  cli._setStdout(stdout.handler);
  cli._setStderr(stderr.handler);

  const observedDigests = {} as Record<CoreModuleName, string>;
  const loadPinnedCore = async (path: string) => {
    if (!(path in CORE_DIGESTS)) {
      throw new Error(`Unlisted executable module refused: ${path}`);
    }
    const name = path as CoreModuleName;
    const response = await fetch(`/wasm/${name}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Included WASI module unavailable (${response.status}).`);
    const bytes = await response.arrayBuffer();
    const digest = await sha256(bytes);
    observedDigests[name] = digest;
    if (digest !== CORE_DIGESTS[name]) {
      throw new Error(`Digest mismatch refused before instantiation: ${name}`);
    }
    return WebAssembly.compile(bytes);
  };

  const started = performance.now();
  const shim = new WASIShim({
    sandbox: {
      preopens: {},
      env: {},
      args: ['witness-release-diagnostic', profileId],
      enableNetwork: false,
    },
  });

  const component = await instantiate(loadPinnedCore, shim.getImportObject());
  component.run.run();
  const durationMs = Math.max(0, Math.round((performance.now() - started) * 10) / 10);
  const captured = stdout.finish();
  const stderrCaptured = stderr.finish();
  if (stderrCaptured.text.trim()) {
    throw new Error(`Included diagnostic wrote to stderr: ${stderrCaptured.text.trim()}`);
  }

  let report: DiagnosticReport;
  try {
    report = JSON.parse(captured.text.trim()) as DiagnosticReport;
  } catch {
    throw new Error('Included diagnostic returned invalid JSON.');
  }
  if (report.schemaVersion !== 'witness.diagnostic/v1' || report.profileId !== profileId) {
    throw new Error('Included diagnostic returned an unexpected report envelope.');
  }

  const evidenceId = randomHex(16);
  const receiptWithoutDigest = {
    schemaVersion: 'witness.receipt/v1' as const,
    evidenceId,
    source,
    createdAt: new Date().toISOString(),
    componentId: COMPONENT_ID,
    profileId,
    enforcementGrade: 'CLOSED_AND_PINNED' as const,
    configuredAndEnforced: {
      closedProfileAllowlist: Object.keys(PROFILES) as ProfileId[],
      digestGate: 'sha256-before-instantiation' as const,
      filesystemPreopens: 0 as const,
      environmentVariables: 0 as const,
      guestNetwork: 'disabled' as const,
      outputCaptureLimitBytes: OUTPUT_LIMIT_BYTES,
    },
    hostObserved: {
      coreDigests: observedDigests,
      allDigestsMatched: Object.entries(CORE_DIGESTS).every(([name, digest]) => observedDigests[name as CoreModuleName] === digest),
      termination: 'completed' as const,
      durationMs,
      stdoutCapturedBytes: captured.capturedBytes,
      stdoutWrittenBytes: captured.writtenBytes,
      stdoutTruncated: captured.truncated,
    },
    componentReported: report,
    independentAttestation: {
      present: false as const,
      note: 'No independent signer or remote attester verified this browser-hosted execution.',
    },
  };
  const evidenceDigest = await sha256(new TextEncoder().encode(JSON.stringify(receiptWithoutDigest)));
  const receipt: ExecutionReceipt = { ...receiptWithoutDigest, evidenceDigest };
  evidenceStore.set(evidenceId, receipt);
  return receipt;
}

export function getEvidence(evidenceId: unknown): ExecutionReceipt {
  if (typeof evidenceId !== 'string' || !/^[0-9a-f]{32}$/.test(evidenceId)) {
    throw new Error('Evidence ID must be 32 lowercase hexadecimal characters.');
  }
  const receipt = evidenceStore.get(evidenceId);
  if (!receipt) throw new Error('Evidence is session-local and this ID was not found.');
  return receipt;
}
