import { createHash } from "node:crypto";

const TOP_LEVEL_KEYS = Object.freeze([
  "artifactDigest",
  "certificateDigest",
  "claim",
  "clauses",
  "limitations",
  "manifest",
  "schema",
  "target",
  "verdict",
]);

const LIMITATIONS = Object.freeze([
  "This certificate proves finite capability-set compatibility only.",
  "It does not prove runtime success, output equivalence, identity, authorization, or independent attestation.",
]);

const CLAIM =
  "The pinned workload is compatible with the named target under the manifest policy.";

function stableJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  throw new TypeError(`Cannot hash ${typeof value}`);
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

function orderedSet(values, field) {
  if (!Array.isArray(values) || !values.every((value) => typeof value === "string")) {
    throw new TypeError(`${field} must contain strings`);
  }
  return Array.from(new Set(values)).sort();
}

function subtract(left, right) {
  const allowed = new Set(right);
  return left.filter((item) => !allowed.has(item));
}

function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right));
  const wanted = [...expected].sort((left, right) => left.localeCompare(right));
  if (stableJson(actual) !== stableJson(wanted)) {
    throw new Error(`${label} has unexpected fields`);
  }
}

function expectedClause(id, relation, counterexample) {
  return {
    id,
    relation,
    satisfied: counterexample.length === 0,
    counterexample,
  };
}

function assertEqual(actual, expected, message) {
  if (stableJson(actual) !== stableJson(expected)) {
    throw new Error(message);
  }
}

export function verifyCompatibilityCertificate(certificate, manifest, target) {
  assertExactKeys(certificate, TOP_LEVEL_KEYS, "certificate");
  assertExactKeys(certificate.manifest, ["id", "modelDigest"], "certificate.manifest");
  assertExactKeys(certificate.target, ["id", "modelDigest"], "certificate.target");

  if (!Array.isArray(certificate.clauses) || certificate.clauses.length !== 4) {
    throw new Error("certificate must contain exactly four proof clauses");
  }
  certificate.clauses.forEach((item, index) =>
    assertExactKeys(
      item,
      ["counterexample", "id", "relation", "satisfied"],
      `certificate.clauses[${index}]`,
    ),
  );

  if (certificate.schema !== "univ.compatibility-certificate/v0") {
    throw new Error("unsupported certificate schema");
  }
  if (certificate.claim !== CLAIM) {
    throw new Error("certificate claim was altered");
  }
  if (certificate.manifest.id !== manifest?.id || certificate.target.id !== target?.id) {
    throw new Error("certificate identity does not match the supplied models");
  }
  if (certificate.manifest.modelDigest !== sha256(manifest)) {
    throw new Error("manifest model digest mismatch");
  }
  if (certificate.target.modelDigest !== sha256(target)) {
    throw new Error("target model digest mismatch");
  }
  if (certificate.artifactDigest !== manifest?.artifact?.digest) {
    throw new Error("artifact digest mismatch");
  }

  const required = orderedSet(manifest.requiredFeatures, "requiredFeatures");
  const provided = orderedSet(target.providedFeatures, "providedFeatures");
  const requested = orderedSet(
    manifest.requestedAuthorities,
    "requestedAuthorities",
  );
  const allowed = orderedSet(
    manifest.policy?.allowedAuthorities,
    "policy.allowedAuthorities",
  );
  const granted = orderedSet(target.grantedAuthorities, "grantedAuthorities");
  const requiredObservations = orderedSet(
    manifest.requiredObservations,
    "requiredObservations",
  );
  const providedObservations = orderedSet(
    target.providedObservations,
    "providedObservations",
  );

  const expectedClauses = [
    expectedClause(
      "required-features-subset",
      "manifest.requiredFeatures subset-of target.providedFeatures",
      subtract(required, provided),
    ),
    expectedClause(
      "requested-authorities-subset",
      "manifest.requestedAuthorities subset-of manifest.policy.allowedAuthorities",
      subtract(requested, allowed),
    ),
    expectedClause(
      "target-grants-subset",
      "target.grantedAuthorities subset-of manifest.policy.allowedAuthorities",
      subtract(granted, allowed),
    ),
    expectedClause(
      "required-observations-subset",
      "manifest.requiredObservations subset-of target.providedObservations",
      subtract(requiredObservations, providedObservations),
    ),
  ];
  assertEqual(certificate.clauses, expectedClauses, "proof clauses do not verify");

  const expectedVerdict = expectedClauses.every((item) => item.satisfied)
    ? "PASS"
    : "BLOCK";
  if (certificate.verdict !== expectedVerdict) {
    throw new Error("certificate verdict does not follow from the clauses");
  }
  assertEqual(certificate.limitations, LIMITATIONS, "certificate limitations were altered");

  const { certificateDigest, ...body } = certificate;
  if (certificateDigest !== sha256(body)) {
    throw new Error("certificate digest mismatch");
  }

  return {
    verified: true,
    verdict: expectedVerdict,
    counterexamples: expectedClauses.flatMap((item) => item.counterexample),
    certificateDigest,
  };
}

export function verifyExecutionCapsule(capsule, certificate, manifest, target) {
  assertExactKeys(
    capsule,
    [
      "artifactDigest",
      "authorityCeiling",
      "binding",
      "capsuleDigest",
      "compatibilityCertificateDigest",
      "intent",
      "requiredObservations",
      "schema",
      "targetPassport",
    ],
    "execution capsule",
  );
  assertExactKeys(capsule.intent, ["id", "modelDigest"], "capsule.intent");
  assertExactKeys(
    capsule.targetPassport,
    ["id", "modelDigest"],
    "capsule.targetPassport",
  );

  const proof = verifyCompatibilityCertificate(
    certificate,
    manifest,
    target,
  );
  if (proof.verdict !== "PASS") {
    throw new Error("a blocked compatibility proof cannot authorize a capsule");
  }
  if (capsule.schema !== "univ.execution-capsule/v0") {
    throw new Error("unsupported execution capsule schema");
  }

  const expectedBody = {
    schema: "univ.execution-capsule/v0",
    intent: {
      id: manifest.id,
      modelDigest: certificate.manifest.modelDigest,
    },
    targetPassport: {
      id: target.id,
      modelDigest: certificate.target.modelDigest,
    },
    artifactDigest: manifest.artifact.digest,
    compatibilityCertificateDigest: certificate.certificateDigest,
    binding: target.executionBinding,
    requiredObservations: orderedSet(
      manifest.requiredObservations,
      "requiredObservations",
    ),
    authorityCeiling: orderedSet(
      manifest.policy.allowedAuthorities,
      "policy.allowedAuthorities",
    ),
  };
  const { capsuleDigest, ...actualBody } = capsule;
  assertEqual(actualBody, expectedBody, "execution capsule does not match the verified models");
  if (capsuleDigest !== sha256(expectedBody)) {
    throw new Error("execution capsule digest mismatch");
  }

  return {
    verified: true,
    intentId: manifest.id,
    targetId: target.id,
    capsuleDigest,
  };
}
