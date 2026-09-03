import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  browserWasi,
  networkBoundRelease,
  portableRelease,
  sitesEdgeWasi,
} from "./model.mjs";
import { compileCompatibilityCertificate } from "./planner.mjs";
import { verifyCompatibilityCertificate } from "./verifier.mjs";

function clone(value) {
  return structuredClone(value);
}

test("portable workload carries a verifiable PASS certificate for both real targets", () => {
  for (const target of [browserWasi, sitesEdgeWasi]) {
    const certificate = compileCompatibilityCertificate(portableRelease, target);
    const result = verifyCompatibilityCertificate(
      certificate,
      portableRelease,
      target,
    );

    assert.equal(certificate.verdict, "PASS");
    assert.deepEqual(result, {
      verified: true,
      verdict: "PASS",
      counterexamples: [],
      certificateDigest: certificate.certificateDigest,
    });
  }
});

test("a forbidden network request produces a minimal, agent-readable counterexample", () => {
  const certificate = compileCompatibilityCertificate(
    networkBoundRelease,
    browserWasi,
  );
  const result = verifyCompatibilityCertificate(
    certificate,
    networkBoundRelease,
    browserWasi,
  );

  assert.equal(certificate.verdict, "BLOCK");
  assert.deepEqual(result.counterexamples, ["guest-network"]);
  assert.deepEqual(certificate.clauses[1].counterexample, ["guest-network"]);
});

test("the verifier rejects a certificate whose verdict was changed after compilation", () => {
  const certificate = clone(
    compileCompatibilityCertificate(networkBoundRelease, browserWasi),
  );
  certificate.verdict = "PASS";

  assert.throws(
    () =>
      verifyCompatibilityCertificate(
        certificate,
        networkBoundRelease,
        browserWasi,
      ),
    /verdict does not follow/,
  );
});

test("the verifier rejects an authority grant added after certification", () => {
  const certificate = compileCompatibilityCertificate(portableRelease, browserWasi);
  const changedTarget = clone(browserWasi);
  changedTarget.grantedAuthorities.push("guest-network");

  assert.throws(
    () =>
      verifyCompatibilityCertificate(certificate, portableRelease, changedTarget),
    /target model digest mismatch/,
  );
});

test("the verifier rejects a manifest artifact substituted after certification", () => {
  const certificate = compileCompatibilityCertificate(portableRelease, browserWasi);
  const changedManifest = clone(portableRelease);
  changedManifest.artifact.digest = `sha256:${"0".repeat(64)}`;

  assert.throws(
    () =>
      verifyCompatibilityCertificate(certificate, changedManifest, browserWasi),
    /manifest model digest mismatch/,
  );
});

test("the same closed models produce byte-for-byte deterministic certificates", () => {
  const first = compileCompatibilityCertificate(portableRelease, sitesEdgeWasi);
  const second = compileCompatibilityCertificate(portableRelease, sitesEdgeWasi);

  assert.deepEqual(first, second);
});

test("the independent verifier does not import the planner", async () => {
  const verifierSource = await readFile(
    new URL("./verifier.mjs", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(verifierSource, /from\s+["']\.\/planner\.mjs["']/);
});
