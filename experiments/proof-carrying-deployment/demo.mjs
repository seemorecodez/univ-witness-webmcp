import {
  browserWasi,
  networkBoundRelease,
  portableRelease,
  sitesEdgeWasi,
} from "./model.mjs";
import { compileDeploymentIntent } from "./compiler.mjs";
import { readFile } from "node:fs/promises";
import { buildRuntimePortabilityWitness } from "./receipt-witness.mjs";

const portableProgram = compileDeploymentIntent(portableRelease, [
  browserWasi,
  sitesEdgeWasi,
]);
const productionReceipt = JSON.parse(
  await readFile(
    new URL("../../evidence/production-webmcp-receipt.json", import.meta.url),
    "utf8",
  ),
);

const demonstration = {
  schema: "univ.universal-deployment-compiler-demo/v0",
  classification: "EXPERIMENT_NOT_SUBMISSION_BASELINE",
  generatedFrom: "closed deterministic models; no mock runtime receipt",
  portableProgram,
  runtimeWitness: buildRuntimePortabilityWitness(
    portableProgram,
    portableRelease,
    productionReceipt,
  ),
  refusedProgram: compileDeploymentIntent(networkBoundRelease, [
    browserWasi,
    sitesEdgeWasi,
  ]),
};

process.stdout.write(`${JSON.stringify(demonstration, null, 2)}\n`);
