const ARTIFACT_DIGEST =
  "sha256:99f1b53ecb4a3400d802dea49e733b2409d4b9c65c770645d2f54c8dac3cacb0";

export const portableRelease = Object.freeze({
  schema: "univ.deployment-manifest/v0",
  id: "portable-release-v1",
  artifact: Object.freeze({
    id: "univ-portable-workload",
    digest: ARTIFACT_DIGEST,
  }),
  requiredFeatures: Object.freeze([
    "bounded-output",
    "pinned-artifact",
    "wasi-preview2",
  ]),
  requestedAuthorities: Object.freeze([]),
  requiredObservations: Object.freeze([
    "componentId",
    "manifestId",
    "outputSha256",
    "status",
    "workloadId",
  ]),
  policy: Object.freeze({
    allowedAuthorities: Object.freeze([]),
  }),
});

export const networkBoundRelease = Object.freeze({
  schema: "univ.deployment-manifest/v0",
  id: "network-bound-release-v1",
  artifact: Object.freeze({
    id: "univ-portable-workload",
    digest: ARTIFACT_DIGEST,
  }),
  requiredFeatures: Object.freeze([
    "bounded-output",
    "pinned-artifact",
    "wasi-preview2",
  ]),
  requestedAuthorities: Object.freeze(["guest-network"]),
  requiredObservations: Object.freeze([
    "componentId",
    "manifestId",
    "outputSha256",
    "status",
    "workloadId",
  ]),
  policy: Object.freeze({
    allowedAuthorities: Object.freeze([]),
  }),
});

export const browserWasi = Object.freeze({
  schema: "univ.deployment-target/v0",
  id: "browser-wasi",
  providedFeatures: Object.freeze([
    "bounded-output",
    "pinned-artifact",
    "wasi-preview2",
  ]),
  grantedAuthorities: Object.freeze([]),
  providedObservations: Object.freeze([
    "componentId",
    "manifestId",
    "outputSha256",
    "status",
    "workloadId",
  ]),
  executionBinding: Object.freeze({
    adapterId: "jco-browser-esm-v1",
    artifactBinding: "runtime-sha256-before-compile",
    handoffTransport: "same-document",
  }),
});

export const sitesEdgeWasi = Object.freeze({
  schema: "univ.deployment-target/v0",
  id: "sites-edge-wasi",
  providedFeatures: Object.freeze([
    "bounded-output",
    "pinned-artifact",
    "wasi-preview2",
  ]),
  grantedAuthorities: Object.freeze([]),
  providedObservations: Object.freeze([
    "componentId",
    "manifestId",
    "outputSha256",
    "status",
    "workloadId",
  ]),
  executionBinding: Object.freeze({
    adapterId: "jco-cloudflare-static-wasm-v1",
    artifactBinding: "ci-pinned-static-module",
    handoffTransport: "same-origin-post",
  }),
});
