import {
  COMPONENT_ID,
  CORE_DIGESTS,
  EVIDENCE_CLAIMS,
  EXPECTED_WORKLOAD_RESULT,
  MANIFESTS,
  OUTPUT_LIMIT_BYTES,
  WORKLOAD_ID,
  planDeployment,
  sha256Bytes,
  sha256Object,
  validateDeploymentHandoff,
  type DeploymentReceipt,
  type TargetId,
  type TargetReceipt,
} from './deployment-contract';

export interface ReceiptVerification {
  schemaVersion: 'univ.receipt-verification/v1';
  verified: true;
  verifier: 'sites-edge-deterministic';
  checks: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort((left, right) =>
    left.localeCompare(right),
  );
  const expected = [...keys].sort((left, right) => left.localeCompare(right));
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function recordsMatch(
  actual: unknown,
  expected: Record<string, string>,
): boolean {
  if (!isRecord(actual) || !hasExactKeys(actual, Object.keys(expected)))
    return false;
  return Object.entries(expected).every(
    ([key, value]) => actual[key] === value,
  );
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function assertTargetReceipt(
  value: unknown,
  targetId: TargetId,
  handoffId: string,
  capsuleDigest: string,
): Promise<void> {
  assert(isRecord(value), `Malformed ${targetId} receipt refused.`);
  assert(
    hasExactKeys(value, [
      'schemaVersion',
      'targetId',
      'environment',
      'execution',
      'handoffId',
      'capsuleDigest',
      'manifestId',
      'componentId',
      'configuredAndEnforced',
      'hostObserved',
      'artifactVerification',
      'componentReported',
    ]),
    `Unexpected ${targetId} receipt fields refused.`,
  );
  assert(
    value.schemaVersion === 'univ.target-receipt/v2' &&
      value.targetId === targetId,
    `Unknown ${targetId} receipt contract refused.`,
  );
  assert(
    value.execution === 'actual' &&
      value.handoffId === handoffId &&
      value.capsuleDigest === capsuleDigest,
    `${targetId} execution binding mismatch refused.`,
  );
  assert(
    value.manifestId === 'portable-release-v1' &&
      value.componentId === COMPONENT_ID,
    `${targetId} release identity mismatch refused.`,
  );
  const expectedEnvironment =
    targetId === 'browser-wasi'
      ? 'browser main thread + WebAssembly'
      : 'OpenAI Sites / Cloudflare Workers edge';
  assert(
    value.environment === expectedEnvironment,
    `${targetId} runtime identity mismatch refused.`,
  );

  const enforced = value.configuredAndEnforced;
  assert(isRecord(enforced), `${targetId} enforcement record missing.`);
  assert(
    enforced.guestNetwork === 'disabled' &&
      enforced.filesystemPreopens === 0 &&
      enforced.environmentVariables === 0 &&
      enforced.outputCaptureLimitBytes === OUTPUT_LIMIT_BYTES,
    `${targetId} enforcement boundary mismatch refused.`,
  );

  const observed = value.hostObserved;
  assert(isRecord(observed), `${targetId} host observation missing.`);
  assert(
    observed.termination === 'completed' &&
      observed.timingSource === 'performance.now',
    `${targetId} termination evidence missing.`,
  );
  assert(
    typeof observed.durationMs === 'number' && observed.durationMs >= 0,
    `${targetId} duration is invalid.`,
  );
  assert(
    typeof observed.stdoutCapturedBytes === 'number' &&
      observed.stdoutCapturedBytes >= 0 &&
      observed.stdoutCapturedBytes <= OUTPUT_LIMIT_BYTES,
    `${targetId} captured output exceeded its bound.`,
  );
  assert(
    typeof observed.stdoutWrittenBytes === 'number' &&
      observed.stdoutWrittenBytes >= observed.stdoutCapturedBytes,
    `${targetId} output accounting is invalid.`,
  );
  assert(
    observed.stdoutTruncated === false &&
      isSha256(observed.workloadOutputSha256),
    `${targetId} output observation is incomplete.`,
  );

  const component = value.componentReported;
  assert(isRecord(component), `${targetId} component report missing.`);
  assert(
    component.schemaVersion === 'univ.workload-result/v1' &&
      component.manifestId === 'portable-release-v1' &&
      component.workloadId === WORKLOAD_ID &&
      component.status === 'HEALTHY',
    `${targetId} component result refused.`,
  );
  assert(
    typeof component.summary === 'string' && Array.isArray(component.records),
    `${targetId} component output shape refused.`,
  );
  assert(
    JSON.stringify(component) === JSON.stringify(EXPECTED_WORKLOAD_RESULT),
    `${targetId} component output does not match the pinned workload.`,
  );
  const expectedOutputText = JSON.stringify(EXPECTED_WORKLOAD_RESULT);
  const expectedCapturedOutput = new TextEncoder().encode(
    `${expectedOutputText}\n`,
  );
  assert(
    observed.stdoutCapturedBytes === expectedCapturedOutput.byteLength &&
      observed.stdoutWrittenBytes === expectedCapturedOutput.byteLength &&
      observed.workloadOutputSha256 ===
        (await sha256Bytes(new TextEncoder().encode(expectedOutputText))),
    `${targetId} workload output evidence mismatch refused.`,
  );

  const artifact = value.artifactVerification;
  assert(isRecord(artifact), `${targetId} artifact verification missing.`);
  assert(
    recordsMatch(artifact.expectedCoreDigests, CORE_DIGESTS),
    `${targetId} expected artifact digests changed.`,
  );
  if (targetId === 'browser-wasi') {
    assert(
      artifact.runtimeSha256Observed === true &&
        artifact.binding === 'sha256-before-instantiation' &&
        artifact.allRuntimeDigestsMatched === true,
      'Browser runtime digest observation refused.',
    );
    assert(
      recordsMatch(artifact.observedCoreDigests, CORE_DIGESTS),
      'Browser observed artifact digests mismatch.',
    );
  } else {
    assert(
      artifact.runtimeSha256Observed === false &&
        artifact.binding === 'static-compiled-module-import',
      'Edge build-pinned artifact binding changed.',
    );
  }
}

export async function verifyDeploymentReceipt(
  value: unknown,
): Promise<{ receipt: DeploymentReceipt; verification: ReceiptVerification }> {
  assert(isRecord(value), 'Malformed deployment receipt refused.');
  assert(
    hasExactKeys(value, [
      'schemaVersion',
      'evidenceId',
      'evidenceDigest',
      'source',
      'createdAt',
      'manifestId',
      'release',
      'manifestDigest',
      'programDigest',
      'handoffId',
      'handoffDigest',
      'handoff',
      'capsuleDigests',
      'enforcementGrade',
      'targetReceipts',
      'portability',
      'runtimeWitness',
      'evidenceClaims',
    ]),
    'Unexpected deployment receipt fields refused.',
  );
  assert(
    value.schemaVersion === 'univ.deployment-receipt/v3',
    'Unknown deployment receipt contract refused.',
  );
  assert(
    typeof value.evidenceId === 'string' &&
      /^[0-9a-f-]{36}$/.test(value.evidenceId),
    'Invalid evidence ID refused.',
  );
  assert(
    isSha256(value.evidenceDigest) &&
      isSha256(value.manifestDigest) &&
      isSha256(value.programDigest) &&
      isSha256(value.handoffDigest),
    'Invalid receipt digest refused.',
  );
  assert(
    value.source === 'human' || value.source === 'WebMCP',
    'Unknown invocation source refused.',
  );
  assert(
    typeof value.createdAt === 'string' &&
      Number.isFinite(Date.parse(value.createdAt)),
    'Invalid receipt time refused.',
  );
  assert(
    value.manifestId === 'portable-release-v1' &&
      value.enforcementGrade === 'CLOSED_MANIFEST_PINNED_ARTIFACTS',
    'Unknown release or enforcement grade refused.',
  );
  const release = value.release;
  const expectedRelease = MANIFESTS['portable-release-v1'].release;
  assert(
    isRecord(release) &&
      hasExactKeys(release, [
        'organization',
        'repository',
        'candidate',
        'change',
      ]) &&
      release.organization === expectedRelease.organization &&
      release.repository === expectedRelease.repository &&
      release.candidate === expectedRelease.candidate &&
      release.change === expectedRelease.change,
    'Receipt release identity mismatch refused.',
  );
  assert(
    value.manifestDigest ===
      (await sha256Object(MANIFESTS['portable-release-v1'])),
    'Receipt manifest digest mismatch refused.',
  );
  const expectedPlan = await planDeployment('portable-release-v1');
  assert(
    value.programDigest === expectedPlan.programDigest,
    'Receipt compiled-program digest mismatch refused.',
  );
  assert(
    typeof value.handoffId === 'string' &&
      /^[0-9a-f-]{36}$/.test(value.handoffId),
    'Invalid handoff ID refused.',
  );
  const verifiedHandoff = await validateDeploymentHandoff(
    value.handoff,
    undefined,
    { allowExpired: true },
  );
  assert(
    verifiedHandoff.handoffId === value.handoffId &&
      verifiedHandoff.handoffDigest === value.handoffDigest &&
      verifiedHandoff.manifestDigest === value.manifestDigest &&
      verifiedHandoff.programDigest === value.programDigest,
    'Receipt handoff binding mismatch refused.',
  );
  assert(
    Date.parse(value.createdAt as string) >=
      Date.parse(verifiedHandoff.createdAt) &&
      Date.parse(value.createdAt as string) <=
        Date.parse(verifiedHandoff.expiresAt),
    'Receipt time falls outside the executed handoff window.',
  );

  const capsuleDigests = value.capsuleDigests;
  assert(
    isRecord(capsuleDigests) &&
      hasExactKeys(capsuleDigests, ['browser-wasi', 'sites-edge-wasi']),
    'Receipt capsule set refused.',
  );
  assert(
    isSha256(capsuleDigests['browser-wasi']) &&
      isSha256(capsuleDigests['sites-edge-wasi']),
    'Receipt capsule digest refused.',
  );
  for (const target of expectedPlan.targets) {
    assert(
      target.capsule &&
        capsuleDigests[target.targetId] === target.capsule.capsuleDigest,
      `${target.targetId} capsule does not follow from the compiled release intent.`,
    );
  }
  assert(
    Array.isArray(value.targetReceipts) && value.targetReceipts.length === 2,
    'Exactly two target receipts are required.',
  );
  const receiptByTarget = new Map(
    (value.targetReceipts as unknown[]).map((item) => [
      isRecord(item) ? item.targetId : undefined,
      item,
    ]),
  );
  assert(
    receiptByTarget.size === 2,
    'Duplicate or unknown target receipts refused.',
  );
  await assertTargetReceipt(
    receiptByTarget.get('browser-wasi'),
    'browser-wasi',
    value.handoffId,
    capsuleDigests['browser-wasi'],
  );
  await assertTargetReceipt(
    receiptByTarget.get('sites-edge-wasi'),
    'sites-edge-wasi',
    value.handoffId,
    capsuleDigests['sites-edge-wasi'],
  );
  const browserReceipt = receiptByTarget.get('browser-wasi') as TargetReceipt;
  const edgeReceipt = receiptByTarget.get('sites-edge-wasi') as TargetReceipt;
  assert(
    browserReceipt.hostObserved.workloadOutputSha256 ===
      edgeReceipt.hostObserved.workloadOutputSha256,
    'Runtime outputs do not match.',
  );
  assert(
    JSON.stringify(browserReceipt.componentReported) ===
      JSON.stringify(edgeReceipt.componentReported),
    'Component reports do not match.',
  );

  const portability = value.portability;
  assert(
    isRecord(portability) &&
      portability.actualTargetsExecuted === 2 &&
      portability.sameManifest === true &&
      portability.sameComponent === true &&
      portability.sameWorkloadOutput === true &&
      portability.portableAcrossExecutedTargets === true,
    'Portability verdict is not supported.',
  );
  assert(
    portability.workloadOutputSha256 ===
      browserReceipt.hostObserved.workloadOutputSha256,
    'Portability output digest mismatch refused.',
  );

  const witness = value.runtimeWitness;
  assert(
    isRecord(witness) &&
      witness.schemaVersion === 'univ.runtime-portability-witness/v1' &&
      witness.programDigest === value.programDigest &&
      witness.equivalentOverDeclaredObservations === true,
    'Runtime witness mismatch refused.',
  );
  assert(
    Array.isArray(witness.requiredObservations) &&
      JSON.stringify(witness.requiredObservations) ===
        JSON.stringify([
          'componentId',
          'manifestId',
          'outputSha256',
          'status',
          'workloadId',
        ]),
    'Runtime witness observation contract changed.',
  );
  assert(
    Array.isArray(witness.actualTargets) &&
      JSON.stringify(witness.actualTargets) ===
        JSON.stringify(['browser-wasi', 'sites-edge-wasi']),
    'Runtime witness target set refused.',
  );
  assert(
    isRecord(witness.sharedObservation) &&
      witness.sharedObservation.componentId === COMPONENT_ID &&
      witness.sharedObservation.manifestId === 'portable-release-v1' &&
      witness.sharedObservation.workloadId === WORKLOAD_ID &&
      witness.sharedObservation.status === 'HEALTHY' &&
      witness.sharedObservation.outputSha256 ===
        browserReceipt.hostObserved.workloadOutputSha256,
    'Runtime witness observation mismatch refused.',
  );

  const claims = value.evidenceClaims;
  assert(
    isRecord(claims) &&
      hasExactKeys(claims, [
        'configuredAndEnforced',
        'activelyObserved',
        'buildPinned',
        'independentAttestation',
      ]),
    'Evidence claim taxonomy changed.',
  );
  assert(
    isRecord(claims.independentAttestation) &&
      claims.independentAttestation.present === false &&
      typeof claims.independentAttestation.note === 'string',
    'Independent attestation may not be inferred from this receipt.',
  );
  assert(
    JSON.stringify(claims) === JSON.stringify(EVIDENCE_CLAIMS),
    'Evidence claim language mismatch refused.',
  );
  const { evidenceDigest, ...withoutDigest } = value;
  assert(
    (await sha256Object(withoutDigest)) === evidenceDigest,
    'Deployment receipt integrity digest mismatch refused.',
  );

  return {
    receipt: value as unknown as DeploymentReceipt,
    verification: {
      schemaVersion: 'univ.receipt-verification/v1',
      verified: true,
      verifier: 'sites-edge-deterministic',
      checks: [
        'receipt-integrity-digest',
        'closed-manifest-binding',
        'two-target-capsule-binding',
        'bounded-runtime-observations',
        'byte-identical-workload-output',
        'honest-attestation-boundary',
      ],
    },
  };
}
