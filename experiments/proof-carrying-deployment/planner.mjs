import { createHash } from "node:crypto";

const LIMITATIONS = Object.freeze([
  "This certificate proves finite capability-set compatibility only.",
  "It does not prove runtime success, output equivalence, identity, authorization, or independent attestation.",
]);

function canonicalize(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  throw new TypeError(`Unsupported canonical value: ${typeof value}`);
}

function digest(value) {
  return `sha256:${createHash("sha256").update(canonicalize(value)).digest("hex")}`;
}

function sortedUnique(values, field) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) {
    throw new TypeError(`${field} must be an array of strings`);
  }
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function difference(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

function clause(id, relation, counterexample) {
  return {
    id,
    relation,
    satisfied: counterexample.length === 0,
    counterexample,
  };
}

export function compileCompatibilityCertificate(manifest, target) {
  if (!manifest?.artifact?.digest || !manifest?.policy || !target?.id) {
    throw new TypeError("Manifest and target must contain the closed compatibility model");
  }

  const required = sortedUnique(manifest.requiredFeatures, "requiredFeatures");
  const provided = sortedUnique(target.providedFeatures, "providedFeatures");
  const requested = sortedUnique(
    manifest.requestedAuthorities,
    "requestedAuthorities",
  );
  const allowed = sortedUnique(
    manifest.policy.allowedAuthorities,
    "policy.allowedAuthorities",
  );
  const granted = sortedUnique(target.grantedAuthorities, "grantedAuthorities");
  const requiredObservations = sortedUnique(
    manifest.requiredObservations,
    "requiredObservations",
  );
  const providedObservations = sortedUnique(
    target.providedObservations,
    "providedObservations",
  );

  const clauses = [
    clause(
      "required-features-subset",
      "manifest.requiredFeatures subset-of target.providedFeatures",
      difference(required, provided),
    ),
    clause(
      "requested-authorities-subset",
      "manifest.requestedAuthorities subset-of manifest.policy.allowedAuthorities",
      difference(requested, allowed),
    ),
    clause(
      "target-grants-subset",
      "target.grantedAuthorities subset-of manifest.policy.allowedAuthorities",
      difference(granted, allowed),
    ),
    clause(
      "required-observations-subset",
      "manifest.requiredObservations subset-of target.providedObservations",
      difference(requiredObservations, providedObservations),
    ),
  ];

  const body = {
    schema: "univ.compatibility-certificate/v0",
    claim: "The pinned workload is compatible with the named target under the manifest policy.",
    manifest: {
      id: manifest.id,
      modelDigest: digest(manifest),
    },
    target: {
      id: target.id,
      modelDigest: digest(target),
    },
    artifactDigest: manifest.artifact.digest,
    clauses,
    verdict: clauses.every((item) => item.satisfied) ? "PASS" : "BLOCK",
    limitations: [...LIMITATIONS],
  };

  return {
    ...body,
    certificateDigest: digest(body),
  };
}
