import type { DeploymentManifest } from './deployment-contract';
import type {
  CompatibilityCertificate,
  ExecutionCapsule,
  ProofClause,
  TargetPassport,
} from './deployment-compiler';

const LIMITATIONS = [
  'Finite capability and observation compatibility only; runtime success requires target receipts.',
  'No identity authorization, signature, or independent attestation is claimed.',
] as const;

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

function expectedClauses(manifest: DeploymentManifest, passport: TargetPassport): ProofClause[] {
  const requestedAuthorities = manifest.requirements.guestNetwork === 'required' ? ['guest-network'] : [];
  const allowedAuthorities: string[] = [];
  const requiredFeatures = ['bounded-output', 'pinned-artifact', 'wasi-preview2'];
  const requiredObservations = ['componentId', 'manifestId', 'outputSha256', 'status', 'workloadId'];
  const inputs = [
    {
      id: 'required-features-subset' as const,
      relation: 'intent.requiredFeatures subset-of passport.providedFeatures',
      counterexample: difference(requiredFeatures, passport.providedFeatures),
    },
    {
      id: 'requested-authorities-subset' as const,
      relation: 'intent.requestedAuthorities subset-of intent.allowedAuthorities',
      counterexample: difference(requestedAuthorities, allowedAuthorities),
    },
    {
      id: 'target-grants-subset' as const,
      relation: 'passport.grantedAuthorities subset-of intent.allowedAuthorities',
      counterexample: difference(passport.grantedAuthorities, allowedAuthorities),
    },
    {
      id: 'required-observations-subset' as const,
      relation: 'intent.requiredObservations subset-of passport.providedObservations',
      counterexample: difference(requiredObservations, passport.providedObservations),
    },
  ];
  return inputs.map((item) => ({
    ...item,
    satisfied: item.counterexample.length === 0,
  }));
}

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (canonicalize(actual) !== canonicalize(expected)) throw new Error(message);
}

export async function verifyCompatibilityCertificate(
  certificate: CompatibilityCertificate,
  manifest: DeploymentManifest,
  passport: TargetPassport,
) {
  if (certificate.schemaVersion !== 'univ.compatibility-certificate/v1') {
    throw new Error('Unknown compatibility certificate refused.');
  }
  if (certificate.manifestId !== manifest.manifestId || certificate.targetId !== passport.targetId) {
    throw new Error('Compatibility certificate identity mismatch refused.');
  }
  if (certificate.manifestDigest !== await digest(manifest)) {
    throw new Error('Compatibility certificate manifest digest mismatch refused.');
  }
  if (certificate.targetPassportDigest !== await digest(passport)) {
    throw new Error('Compatibility certificate target-passport digest mismatch refused.');
  }
  if (certificate.artifactDigest !== manifest.workload.sourceComponentSha256) {
    throw new Error('Compatibility certificate artifact digest mismatch refused.');
  }

  const clauses = expectedClauses(manifest, passport);
  assertEqual(certificate.clauses, clauses, 'Compatibility proof clauses do not verify.');
  const verdict = clauses.every((clause) => clause.satisfied) ? 'PASS' : 'BLOCK';
  if (certificate.verdict !== verdict) throw new Error('Compatibility verdict does not follow from its clauses.');
  assertEqual(certificate.limitations, LIMITATIONS, 'Compatibility limitations were altered.');
  const { certificateDigest, ...body } = certificate;
  if (certificateDigest !== await digest(body)) throw new Error('Compatibility certificate digest mismatch refused.');

  return {
    verified: true as const,
    verdict,
    counterexamples: clauses.flatMap((clause) => clause.counterexample),
  };
}

export async function verifyExecutionCapsule(
  capsule: ExecutionCapsule,
  certificate: CompatibilityCertificate,
  manifest: DeploymentManifest,
  passport: TargetPassport,
) {
  const proof = await verifyCompatibilityCertificate(certificate, manifest, passport);
  if (proof.verdict !== 'PASS') throw new Error('Blocked compatibility proof cannot produce an execution capsule.');
  if (capsule.schemaVersion !== 'univ.execution-capsule/v1') throw new Error('Unknown execution capsule refused.');

  const expectedBody = {
    schemaVersion: 'univ.execution-capsule/v1' as const,
    manifestId: manifest.manifestId,
    manifestDigest: certificate.manifestDigest,
    targetId: passport.targetId,
    targetPassportDigest: certificate.targetPassportDigest,
    artifactDigest: manifest.workload.sourceComponentSha256,
    compatibilityCertificateDigest: certificate.certificateDigest,
    executionBinding: passport.executionBinding,
    requiredObservations: ['componentId', 'manifestId', 'outputSha256', 'status', 'workloadId'],
    authorityCeiling: [] as string[],
  };
  const { capsuleDigest, ...body } = capsule;
  assertEqual(body, expectedBody, 'Execution capsule does not match its verified intent and passport.');
  if (capsuleDigest !== await digest(expectedBody)) throw new Error('Execution capsule digest mismatch refused.');

  return { verified: true as const, targetId: passport.targetId, capsuleDigest };
}
