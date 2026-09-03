import type { DeploymentManifest, ManifestId, TargetId } from './deployment-contract';
import {
  verifyCompatibilityCertificate,
  verifyExecutionCapsule,
} from './deployment-capsule-verifier';

export type ProofClauseId =
  | 'required-features-subset'
  | 'requested-authorities-subset'
  | 'target-grants-subset'
  | 'required-observations-subset';

export interface ProofClause {
  id: ProofClauseId;
  relation: string;
  satisfied: boolean;
  counterexample: string[];
}

export interface TargetPassport {
  schemaVersion: 'univ.target-passport/v1';
  targetId: TargetId;
  runtime: string;
  providedFeatures: readonly string[];
  grantedAuthorities: readonly string[];
  providedObservations: readonly string[];
  executionBinding: {
    adapterId: string;
    artifactBinding: string;
    handoffTransport: string;
  };
}

export interface CompatibilityCertificate {
  schemaVersion: 'univ.compatibility-certificate/v1';
  manifestId: ManifestId;
  manifestDigest: string;
  targetId: TargetId;
  targetPassportDigest: string;
  artifactDigest: string;
  clauses: ProofClause[];
  verdict: 'PASS' | 'BLOCK';
  limitations: string[];
  certificateDigest: string;
}

export interface ExecutionCapsule {
  schemaVersion: 'univ.execution-capsule/v1';
  manifestId: ManifestId;
  manifestDigest: string;
  targetId: TargetId;
  targetPassportDigest: string;
  artifactDigest: string;
  compatibilityCertificateDigest: string;
  executionBinding: TargetPassport['executionBinding'];
  requiredObservations: string[];
  authorityCeiling: string[];
  capsuleDigest: string;
}

export interface CompiledTarget {
  targetId: TargetId;
  status: 'READY' | 'BLOCKED';
  passport: TargetPassport;
  passportDigest: string;
  certificate: CompatibilityCertificate;
  counterexamples: string[];
  capsule: ExecutionCapsule | null;
}

export interface CompiledDeploymentProgram {
  schemaVersion: 'univ.compiled-deployment-program/v1';
  manifestId: ManifestId;
  manifestDigest: string;
  portabilityFrontier: TargetId[];
  decision: 'PERMIT' | 'BLOCK';
  targets: CompiledTarget[];
  programDigest: string;
}

const SHARED_FEATURES = ['bounded-output', 'pinned-artifact', 'wasi-preview2'] as const;
const SHARED_OBSERVATIONS = ['componentId', 'manifestId', 'outputSha256', 'status', 'workloadId'] as const;
const LIMITATIONS = [
  'Finite capability and observation compatibility only; runtime success requires target receipts.',
  'No identity authorization, signature, or independent attestation is claimed.',
] as const;

export const TARGET_PASSPORTS: Record<TargetId, TargetPassport> = {
  'browser-wasi': {
    schemaVersion: 'univ.target-passport/v1',
    targetId: 'browser-wasi',
    runtime: 'browser main thread + WebAssembly',
    providedFeatures: SHARED_FEATURES,
    grantedAuthorities: [],
    providedObservations: SHARED_OBSERVATIONS,
    executionBinding: {
      adapterId: 'jco-browser-esm-v1',
      artifactBinding: 'runtime-sha256-before-compile',
      handoffTransport: 'same-document',
    },
  },
  'sites-edge-wasi': {
    schemaVersion: 'univ.target-passport/v1',
    targetId: 'sites-edge-wasi',
    runtime: 'OpenAI Sites / Cloudflare Workers edge',
    providedFeatures: SHARED_FEATURES,
    grantedAuthorities: [],
    providedObservations: SHARED_OBSERVATIONS,
    executionBinding: {
      adapterId: 'jco-cloudflare-static-wasm-v1',
      artifactBinding: 'ci-pinned-static-module',
      handoffTransport: 'same-origin-post',
    },
  },
};

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort((left, right) => left.localeCompare(right))
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(',')}}`;
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalize(value));
  return toHex(await crypto.subtle.digest('SHA-256', bytes));
}

function sorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function difference(left: readonly string[], right: readonly string[]): string[] {
  const rightSet = new Set(right);
  return sorted(left).filter((item) => !rightSet.has(item));
}

function clause(id: ProofClauseId, relation: string, counterexample: string[]): ProofClause {
  return { id, relation, satisfied: counterexample.length === 0, counterexample };
}

async function compileCertificate(
  manifest: DeploymentManifest,
  passport: TargetPassport,
): Promise<CompatibilityCertificate> {
  const requestedAuthorities = manifest.requirements.guestNetwork === 'required' ? ['guest-network'] : [];
  const allowedAuthorities: string[] = [];
  const manifestDigest = await digest(manifest);
  const targetPassportDigest = await digest(passport);
  const clauses = [
    clause(
      'required-features-subset',
      'intent.requiredFeatures subset-of passport.providedFeatures',
      difference(SHARED_FEATURES, passport.providedFeatures),
    ),
    clause(
      'requested-authorities-subset',
      'intent.requestedAuthorities subset-of intent.allowedAuthorities',
      difference(requestedAuthorities, allowedAuthorities),
    ),
    clause(
      'target-grants-subset',
      'passport.grantedAuthorities subset-of intent.allowedAuthorities',
      difference(passport.grantedAuthorities, allowedAuthorities),
    ),
    clause(
      'required-observations-subset',
      'intent.requiredObservations subset-of passport.providedObservations',
      difference(SHARED_OBSERVATIONS, passport.providedObservations),
    ),
  ];
  const body = {
    schemaVersion: 'univ.compatibility-certificate/v1' as const,
    manifestId: manifest.manifestId,
    manifestDigest,
    targetId: passport.targetId,
    targetPassportDigest,
    artifactDigest: manifest.workload.sourceComponentSha256,
    clauses,
    verdict: clauses.every((item) => item.satisfied) ? 'PASS' as const : 'BLOCK' as const,
    limitations: [...LIMITATIONS],
  };
  return { ...body, certificateDigest: await digest(body) };
}

async function createCapsule(
  manifest: DeploymentManifest,
  passport: TargetPassport,
  certificate: CompatibilityCertificate,
): Promise<ExecutionCapsule> {
  const body = {
    schemaVersion: 'univ.execution-capsule/v1' as const,
    manifestId: manifest.manifestId,
    manifestDigest: certificate.manifestDigest,
    targetId: passport.targetId,
    targetPassportDigest: certificate.targetPassportDigest,
    artifactDigest: manifest.workload.sourceComponentSha256,
    compatibilityCertificateDigest: certificate.certificateDigest,
    executionBinding: passport.executionBinding,
    requiredObservations: [...SHARED_OBSERVATIONS],
    authorityCeiling: [] as string[],
  };
  return { ...body, capsuleDigest: await digest(body) };
}

export async function compileDeploymentProgram(
  manifest: DeploymentManifest,
): Promise<CompiledDeploymentProgram> {
  const targets = await Promise.all(manifest.targets.map(async (targetId): Promise<CompiledTarget> => {
    const passport = TARGET_PASSPORTS[targetId];
    const certificate = await compileCertificate(manifest, passport);
    const verification = await verifyCompatibilityCertificate(certificate, manifest, passport);
    if (verification.verdict === 'BLOCK') {
      return {
        targetId,
        status: 'BLOCKED',
        passport,
        passportDigest: certificate.targetPassportDigest,
        certificate,
        counterexamples: verification.counterexamples,
        capsule: null,
      };
    }
    const capsule = await createCapsule(manifest, passport, certificate);
    await verifyExecutionCapsule(capsule, certificate, manifest, passport);
    return {
      targetId,
      status: 'READY',
      passport,
      passportDigest: certificate.targetPassportDigest,
      certificate,
      counterexamples: [],
      capsule,
    };
  }));
  const portabilityFrontier = targets
    .filter((target) => target.status === 'READY')
    .map((target) => target.targetId);
  const manifestDigest = await digest(manifest);
  const body = {
    schemaVersion: 'univ.compiled-deployment-program/v1' as const,
    manifestId: manifest.manifestId,
    manifestDigest,
    portabilityFrontier,
    decision: portabilityFrontier.length === manifest.targets.length ? 'PERMIT' as const : 'BLOCK' as const,
    targets,
  };
  return { ...body, programDigest: await digest(body) };
}
