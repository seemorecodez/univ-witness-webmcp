import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { compileDeploymentIntent } from "./compiler.mjs";
import { browserWasi, portableRelease, sitesEdgeWasi } from "./model.mjs";
import { buildRuntimePortabilityWitness } from "./receipt-witness.mjs";

async function productionReceipt() {
  return JSON.parse(
    await readFile(
      new URL("../../evidence/production-webmcp-receipt.json", import.meta.url),
      "utf8",
    ),
  );
}

test("the compiled frontier is witnessed by the existing real WebMCP deployment", async () => {
  const program = compileDeploymentIntent(portableRelease, [
    browserWasi,
    sitesEdgeWasi,
  ]);
  const witness = buildRuntimePortabilityWitness(
    program,
    portableRelease,
    await productionReceipt(),
  );

  assert.equal(witness.source, "WebMCP");
  assert.deepEqual(witness.actualTargets, ["browser-wasi", "sites-edge-wasi"]);
  assert.equal(witness.equivalentOverDeclaredObservations, true);
  assert.equal(
    witness.sharedObservationVector.outputSha256,
    "a928646501fcc69ed8af413859d43d4b887f3be150c452696700e393d8e338f5",
  );
});

test("a divergent real-target observation falsifies the portability witness", async () => {
  const program = compileDeploymentIntent(portableRelease, [
    browserWasi,
    sitesEdgeWasi,
  ]);
  const receipt = await productionReceipt();
  receipt.targetReceipts[1].hostObserved.workloadOutputSha256 = "different-output";

  assert.throws(
    () => buildRuntimePortabilityWitness(program, portableRelease, receipt),
    /violates the declared observation contract/,
  );
});
