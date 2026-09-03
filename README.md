# UNIV Deploy

[![UNIV Deploy required gate](https://github.com/seemorecodez/univ-witness-webmcp/actions/workflows/univ-deploy-ci.yml/badge.svg)](https://github.com/seemorecodez/univ-witness-webmcp/actions/workflows/univ-deploy-ci.yml)

UNIV Deploy is a proof-carrying deployment demonstration for WebMCP. A browser
agent compiles one closed deployment intent against machine-readable target
passports, creates a controlled handoff from verified execution capsules, runs
the same included WASI workload on two real runtimes, and compares their receipts
over an explicit observation contract.

The target user is a platform, release, or security team that wants agent-driven
portability without granting arbitrary code execution.

## Compile deployment, then prove what ran

UNIV treats deployment as a translation between one target-neutral intent and
machine-readable target passports. The compiler derives
a finite portability frontier, emits a compatibility certificate and distinct
execution capsule for each compatible target, then binds those capsules into the
existing controlled handoff. Actual target receipts reduce to the intent's named
observation fields and produce a bounded runtime portability witness.

The v2 application physically implements that contract for the browser and OpenAI
Sites edge paths. A separately implemented verifier recomputes the finite proof
and capsule; it is not an outside attester. The negative network intent compiles
to an empty frontier and no capsule. Fourteen focused tests cover pass, refusal,
determinism, mutations, and comparison with a real v1 production receipt. See
[the theory and novelty boundary](docs/UNIVERSAL_DEPLOYMENT_THEORY.md) and the
[proof experiment](experiments/proof-carrying-deployment/README.md).

The honest boundary: target passports are still closed, checked-in models; a
third party has not yet implemented the passport/capsule protocol. The current
claim is a finite portability frontier over registered passports followed by real
execution—not “runs everywhere.”

## What the demonstration proves

1. `portable-release-v1` expresses one target-neutral intent for one pinned
   workload and two registered target passports.
2. The compiler checks required features, requested and granted authorities, and
   required observations before emitting a target-specific capsule.
3. A five-minute, digest-bound handoff fixes the compiled program, verified
   capsules, component, core modules, target set, and runtime constraints.
4. The browser target fetches the included modules, observes each SHA-256 digest,
   and compiles only after all digests match.
5. The OpenAI Sites edge target executes statically imported compiled-Wasm modules
   pinned by the repository manifest and CI gate.
6. A runtime portability witness is issued only when both real executions complete
   and agree over the intent's declared observation fields.

`network-bound-release-v1` is a manifest-level negative control. Planning returns
`BLOCK`, emits `guest-network` as the counterexample, and creates no capsule or
handoff because every public target disables guest
networking.

## WebMCP surface

The page registers five tools:

- `get_univ_capabilities`
- `compile_univ_deployment`
- `create_deployment_handoff`
- `deploy_univ_manifest`
- `get_deployment_evidence`

All inputs are closed schemas. The service accepts no uploaded component, arbitrary
bytes, path, URL, shell text, native executable, container image, host configuration,
or free-form guest arguments. The inherited daemon, worker, native, OCI, upload,
shell, and QEMU paths are not exposed.

## Run locally

Prerequisites are Node.js 22.13.0 or newer and npm 10 or newer. Rust stable plus
the `wasm32-wasip2` target is needed only when rebuilding the included workload.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. Human controls run the same implementation, but the
activity timeline says `via WebMCP` only for an actual page-defined tool callback.

In a WebMCP-capable browser, the agent flow is:

1. Call `compile_univ_deployment` with `portable-release-v1`.
2. Call `create_deployment_handoff` with the same manifest ID.
3. Pass the returned `handoffId` and `handoffDigest` to `deploy_univ_manifest`.

No API key, account, credential, uploaded file, or external sample data is required.

## Public demo and source

- Demo: <https://univ-witness-proof.seemoreas0-0.chatgpt.site>
- Source: <https://github.com/seemorecodez/univ-witness-webmcp>
- Architecture and evidence boundary: [ARCHITECTURE.md](ARCHITECTURE.md)
- Reproducible production evidence: [evidence/](evidence/README.md)

The immutable `univ-deploy-v1.0.0` tag preserves the earlier manifest-driven
baseline. Public `main` contains the proof-carrying v2 implementation.

## Validation

```bash
npm run experiment:proof-carrying
npm run demo:proof-carrying
rustup target add wasm32-wasip2
cargo test --manifest-path diagnostic/Cargo.toml
npm run build:diagnostic
npm run verify
npm run lint
npm run build
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high
```

The public `UNIV Deploy required gate` tests the compiler's proofs and mutation
matrix, tests the Rust workload, verifies the
committed source-component digest, retranspiles it with pinned
`@bytecodealliance/jco@1.17.9`, compares the resulting module set and SHA-256
digests, lints, builds the deployable edge application, and audits dependencies.
Rust compiler output is not claimed to be bit-reproducible across host operating
systems; the committed component is the reproducibility input.

## Evidence language

| Category | Claim |
|---|---|
| Configured and enforced | Closed intents and passports, verified capsules, pinned artifacts, no arbitrary inputs, disabled guest network, zero preopens/env, bounded output, expiring handoff |
| Actively observed | Both target terminations, their deterministic output hashes, and browser-loaded module hashes |
| Build-pinned | CI verifies the edge's static compiled-module imports; the edge runtime does not expose module bytes for runtime re-hashing |
| Component-reported | Included workload status and five deterministic release-inventory records |
| Independent attestation | **Absent** — no outside signer, TEE, hardware root, or third party attests this deployment |

The handoff is integrity-bound, not identity-authenticated or cryptographically
signed. The Bytecode Alliance preview2 browser shim is experimental. This is a
bounded hackathon demonstration, not a production isolation or universal cloud
orchestrator claim.

## Build Week and prior work

The concept derives from Frank's pre-existing UNIV repository and earlier native
Rust/Wasmtime work. Those inherited sources include daemon, worker, native, OCI,
QEMU, and unrelated material with known cross-platform failures.

This clean submission repository contains the new WebMCP surface, OpenAI Sites
application, deployment-intent compiler, target passports, proof certificates,
verified execution capsules, two-target WASI execution path, closed handoff,
runtime portability witness, deterministic component, digest manifest, claim
taxonomy, and submission-specific CI gate. Unrelated role-adaptive-agent files and inherited
execution adapters are not included. The broad inherited failures are not
represented as passing here.

Codex accelerated repository auditing, architecture experiments, WASI component
work, WebMCP integration, UI implementation, browser testing, CI design, and Sites
deployment. Frank made the controlling product, security, and scope decisions.
See [BUILD_WEEK_EVIDENCE.md](BUILD_WEEK_EVIDENCE.md) for dated provenance.

## License and governance

MIT © SeemoreCodez. See [LICENSE](LICENSE) and
[README-LICENSING.md](README-LICENSING.md).
