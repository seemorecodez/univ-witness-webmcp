# UNIV Deploy

[![UNIV Deploy required gate](https://github.com/seemorecodez/univ-witness-webmcp/actions/workflows/univ-deploy-ci.yml/badge.svg)](https://github.com/seemorecodez/univ-witness-webmcp/actions/workflows/univ-deploy-ci.yml)

UNIV Deploy is a manifest-driven universal deployment demonstration for WebMCP.
A browser agent can plan one closed deployment, create a controlled handoff, run
the same included WASI workload on two real runtimes, and compare their receipts.

The target user is a platform, release, or security team that wants agent-driven
portability without granting arbitrary code execution.

## What the demonstration proves

1. `portable-release-v1` models one workload and two explicit targets:
   `browser-wasi` and `sites-edge-wasi`.
2. A five-minute, digest-bound handoff fixes the manifest, component, core modules,
   target set, and runtime constraints before execution.
3. The browser target fetches the included modules, observes each SHA-256 digest,
   and compiles only after all digests match.
4. The OpenAI Sites edge target executes statically imported compiled-Wasm modules
   pinned by the repository manifest and CI gate.
5. A portability receipt is issued only when both real executions complete with
   the same manifest, component, and deterministic workload output.

`network-bound-release-v1` is a manifest-level negative control. Planning returns
`BLOCK`, and no handoff can be created, because every public target disables guest
networking.

## WebMCP surface

The page registers five tools:

- `get_univ_capabilities`
- `plan_univ_deployment`
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

1. Call `plan_univ_deployment` with `portable-release-v1`.
2. Call `create_deployment_handoff` with the same manifest ID.
3. Pass the returned `handoffId` and `handoffDigest` to `deploy_univ_manifest`.

No API key, account, credential, uploaded file, or external sample data is required.

## Public demo and source

- Demo: <https://univ-witness-proof.seemoreas0-0.chatgpt.site>
- Source: <https://github.com/seemorecodez/univ-witness-webmcp>
- Architecture and evidence boundary: [ARCHITECTURE.md](ARCHITECTURE.md)
- Reproducible production evidence: [evidence/](evidence/README.md)

## Validation

```bash
rustup target add wasm32-wasip2
cargo test --manifest-path diagnostic/Cargo.toml
npm run build:diagnostic
npm run verify
npm run lint
npm run build
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high
```

The public `UNIV Deploy required gate` tests the Rust workload, verifies the
committed source-component digest, retranspiles it with pinned
`@bytecodealliance/jco@1.17.9`, compares the resulting module set and SHA-256
digests, lints, builds the deployable edge application, and audits dependencies.
Rust compiler output is not claimed to be bit-reproducible across host operating
systems; the committed component is the reproducibility input.

## Evidence language

| Category | Claim |
|---|---|
| Configured and enforced | Closed manifests and targets, pinned artifacts, no arbitrary inputs, disabled guest network, zero preopens/env, bounded output, expiring handoff |
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
application, two-target WASI execution path, closed manifest and handoff contract,
portability comparison, deterministic component, digest manifest, claim taxonomy,
and submission-specific CI gate. Unrelated role-adaptive-agent files and inherited
execution adapters are not included. The broad inherited failures are not
represented as passing here.

Codex accelerated repository auditing, architecture experiments, WASI component
work, WebMCP integration, UI implementation, browser testing, CI design, and Sites
deployment. Frank made the controlling product, security, and scope decisions.
See [BUILD_WEEK_EVIDENCE.md](BUILD_WEEK_EVIDENCE.md) for dated provenance.

## License and governance

MIT © SeemoreCodez. See [LICENSE](LICENSE) and
[README-LICENSING.md](README-LICENSING.md).
