import assert from "node:assert/strict";
import test from "node:test";

import { compileDeploymentIntent } from "./compiler.mjs";
import {
  browserWasi,
  networkBoundRelease,
  portableRelease,
  sitesEdgeWasi,
} from "./model.mjs";
import { verifyExecutionCapsule } from "./verifier.mjs";

function clone(value) {
  return structuredClone(value);
}

test("one intent compiles into distinct, independently verified capsules for both hosts", () => {
  const program = compileDeploymentIntent(portableRelease, [
    browserWasi,
    sitesEdgeWasi,
  ]);

  assert.equal(program.verdict, "COMPILED");
  assert.deepEqual(program.portabilityFrontier, [
    "browser-wasi",
    "sites-edge-wasi",
  ]);
  assert.equal(program.targets.every((target) => target.status === "READY"), true);

  for (const compiled of program.targets) {
    const passport =
      compiled.targetId === "browser-wasi" ? browserWasi : sitesEdgeWasi;
    assert.equal(
      verifyExecutionCapsule(
        compiled.capsule,
        compiled.certificate,
        portableRelease,
        passport,
      ).verified,
      true,
    );
  }

  assert.notDeepEqual(
    program.targets[0].capsule.binding,
    program.targets[1].capsule.binding,
  );
});

test("the forbidden network intent has an empty frontier and emits no capsules", () => {
  const program = compileDeploymentIntent(networkBoundRelease, [
    browserWasi,
    sitesEdgeWasi,
  ]);

  assert.equal(program.verdict, "EMPTY_FRONTIER");
  assert.deepEqual(program.portabilityFrontier, []);
  for (const compiled of program.targets) {
    assert.equal(compiled.status, "BLOCKED");
    assert.equal(compiled.capsule, null);
    assert.deepEqual(compiled.counterexamples, ["guest-network"]);
  }
});

test("a passport missing a required observation is outside the frontier", () => {
  const incompletePassport = clone(browserWasi);
  incompletePassport.id = "browser-without-output-hash";
  incompletePassport.providedObservations = incompletePassport.providedObservations.filter(
    (item) => item !== "outputSha256",
  );

  const program = compileDeploymentIntent(portableRelease, [incompletePassport]);

  assert.equal(program.verdict, "EMPTY_FRONTIER");
  assert.deepEqual(program.targets[0].counterexamples, ["outputSha256"]);
  assert.equal(program.targets[0].capsule, null);
});

test("the capsule verifier rejects a target binding changed after compilation", () => {
  const program = compileDeploymentIntent(portableRelease, [browserWasi]);
  const compiled = program.targets[0];
  const changedCapsule = clone(compiled.capsule);
  changedCapsule.binding.adapterId = "arbitrary-adapter";

  assert.throws(
    () =>
      verifyExecutionCapsule(
        changedCapsule,
        compiled.certificate,
        portableRelease,
        browserWasi,
      ),
    /does not match the verified models/,
  );
});

test("deployment program compilation is deterministic", () => {
  const first = compileDeploymentIntent(portableRelease, [
    sitesEdgeWasi,
    browserWasi,
  ]);
  const second = compileDeploymentIntent(portableRelease, [
    browserWasi,
    sitesEdgeWasi,
  ]);

  assert.deepEqual(first, second);
});
