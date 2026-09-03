import { createHash } from "node:crypto";

import { compileCompatibilityCertificate } from "./planner.mjs";
import {
  verifyCompatibilityCertificate,
  verifyExecutionCapsule,
} from "./verifier.mjs";

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

function createCapsule(intent, target, certificate) {
  const body = {
    schema: "univ.execution-capsule/v0",
    intent: {
      id: intent.id,
      modelDigest: certificate.manifest.modelDigest,
    },
    targetPassport: {
      id: target.id,
      modelDigest: certificate.target.modelDigest,
    },
    artifactDigest: intent.artifact.digest,
    compatibilityCertificateDigest: certificate.certificateDigest,
    binding: target.executionBinding,
    requiredObservations: [...new Set(intent.requiredObservations)].sort((left, right) =>
      left.localeCompare(right),
    ),
    authorityCeiling: [...new Set(intent.policy.allowedAuthorities)].sort((left, right) =>
      left.localeCompare(right),
    ),
  };

  return {
    ...body,
    capsuleDigest: digest(body),
  };
}

export function compileDeploymentIntent(intent, targetPassports) {
  if (!Array.isArray(targetPassports) || targetPassports.length === 0) {
    throw new TypeError("At least one target passport is required");
  }

  const targetIds = targetPassports.map((target) => target.id);
  if (new Set(targetIds).size !== targetIds.length) {
    throw new Error("Target passport IDs must be unique");
  }

  const targets = targetPassports
    .map((target) => {
      const certificate = compileCompatibilityCertificate(intent, target);
      const verification = verifyCompatibilityCertificate(
        certificate,
        intent,
        target,
      );

      if (verification.verdict === "BLOCK") {
        return {
          targetId: target.id,
          status: "BLOCKED",
          certificate,
          counterexamples: verification.counterexamples,
          capsule: null,
        };
      }

      const capsule = createCapsule(intent, target, certificate);
      verifyExecutionCapsule(capsule, certificate, intent, target);
      return {
        targetId: target.id,
        status: "READY",
        certificate,
        counterexamples: [],
        capsule,
      };
    })
    .sort((left, right) => left.targetId.localeCompare(right.targetId));

  const portabilityFrontier = targets
    .filter((target) => target.status === "READY")
    .map((target) => target.targetId);
  const body = {
    schema: "univ.compiled-deployment-program/v0",
    intentId: intent.id,
    intentModelDigest: targets[0].certificate.manifest.modelDigest,
    portabilityFrontier,
    verdict: portabilityFrontier.length === 0 ? "EMPTY_FRONTIER" : "COMPILED",
    targets,
  };

  return {
    ...body,
    programDigest: digest(body),
  };
}
