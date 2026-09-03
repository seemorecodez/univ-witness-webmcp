import { createHash } from "node:crypto";

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
      .sort((left, right) => left.localeCompare(right))
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  throw new TypeError(`Unsupported canonical value: ${typeof value}`);
}

function digest(value) {
  return `sha256:${createHash("sha256").update(canonicalize(value)).digest("hex")}`;
}

function observationVector(receipt) {
  return {
    componentId: receipt.componentId,
    manifestId: receipt.manifestId,
    outputSha256: receipt.hostObserved?.workloadOutputSha256,
    status: receipt.componentReported?.status,
    workloadId: receipt.componentReported?.workloadId,
  };
}

function assertNonemptyStrings(vector, fields, targetId) {
  for (const field of fields) {
    if (typeof vector[field] !== "string" || vector[field].length === 0) {
      throw new Error(`${targetId} did not observe required field ${field}`);
    }
  }
}

export function buildRuntimePortabilityWitness(program, intent, deploymentReceipt) {
  if (program?.verdict !== "COMPILED" || program.portabilityFrontier.length < 2) {
    throw new Error("runtime portability requires a compiled frontier of at least two targets");
  }
  if (deploymentReceipt?.schemaVersion !== "univ.deployment-receipt/v1") {
    throw new Error("unsupported deployment receipt schema");
  }
  if (deploymentReceipt.manifestId !== intent.id) {
    throw new Error("deployment receipt does not belong to the compiled intent");
  }

  const expectedTargets = [...program.portabilityFrontier].sort((left, right) =>
    left.localeCompare(right),
  );
  const receipts = [...deploymentReceipt.targetReceipts].sort((left, right) =>
    left.targetId.localeCompare(right.targetId),
  );
  const actualTargets = receipts.map((receipt) => receipt.targetId);
  if (canonicalize(actualTargets) !== canonicalize(expectedTargets)) {
    throw new Error("actual target receipts do not match the compiled frontier");
  }

  const requiredObservations = [...intent.requiredObservations].sort((left, right) =>
    left.localeCompare(right),
  );
  const observations = receipts.map((receipt) => {
    if (receipt.execution !== "actual" || receipt.hostObserved?.termination !== "completed") {
      throw new Error(`${receipt.targetId} did not report an actual completed execution`);
    }
    const vector = observationVector(receipt);
    assertNonemptyStrings(vector, requiredObservations, receipt.targetId);
    return {
      targetId: receipt.targetId,
      vector,
    };
  });

  const reference = observations[0].vector;
  for (const observed of observations.slice(1)) {
    if (canonicalize(observed.vector) !== canonicalize(reference)) {
      throw new Error(`${observed.targetId} violates the declared observation contract`);
    }
  }

  const body = {
    schema: "univ.runtime-portability-witness/v0",
    intentId: intent.id,
    compiledProgramDigest: program.programDigest,
    source: deploymentReceipt.source,
    sourceEvidenceDigest: deploymentReceipt.evidenceDigest,
    actualTargets,
    requiredObservations,
    sharedObservationVector: reference,
    equivalentOverDeclaredObservations: true,
    limitations: [
      "Equivalence is limited to the named observation fields and executed targets.",
      "This witness does not establish equivalence for unobserved behavior or unregistered hosts.",
    ],
  };

  return {
    ...body,
    witnessDigest: digest(body),
  };
}
