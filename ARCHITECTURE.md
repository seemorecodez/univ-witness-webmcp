# Architecture and evidence boundary

UNIV Deploy demonstrates a narrow universal-deployment primitive: a closed
manifest can be planned once, handed off under fixed constraints, executed on two
different WASI hosts, and compared from their actual target receipts.

```text
browser agent or human control
              │
              │ closed manifest ID
              ▼
       deterministic planner
              │ PERMIT / BLOCK
              ▼
 expiring integrity-bound handoff
       ┌──────┴─────────┐
       ▼                ▼
 browser-wasi      sites-edge-wasi
 runtime SHA-256   static compiled modules
 before compile    pinned by manifest + CI
       │                │
       └──────┬─────────┘
              ▼
  output equality + portability receipt
```

## Manifest and policy model

`portable-release-v1` is the only executable manifest. It binds:

- component `univ-portable-workload-v1`;
- workload `release-inspector-v1`;
- source-component and generated-core SHA-256 digests;
- exactly `browser-wasi` and `sites-edge-wasi`;
- one-shot execution, zero filesystem preopens, empty guest environment, disabled
  guest networking, and a 4,096-byte stdout capture ceiling;
- refusal of arbitrary code, arguments, URLs, and bytes.

`network-bound-release-v1` is a planning negative control, not a second diagnostic
profile. It requires guest networking, so planning blocks it before handoff.

## Controlled handoff

The handoff fixes the manifest digest, source and core digests, target set,
constraints, creation time, and five-minute expiry. Its SHA-256 digest covers the
canonicalized envelope. Each target validates the contract, known manifest,
target membership, expiry, constraints, and digest before running.

This protects against accidental or unobserved envelope mutation inside the demo.
It does **not** authenticate the caller, authorize an identity, provide a digital
signature, or constitute independent attestation.

## Target execution

### `browser-wasi`

The browser fetches the three included core modules from the same origin, computes
their SHA-256 digests with Web Crypto, compares them to the manifest, and only then
calls `WebAssembly.compile`. The receipt may truthfully state that runtime module
hashes were observed.

### `sites-edge-wasi`

OpenAI Sites runs on Cloudflare Workers. Workers accept statically bound
`WebAssembly.Module` imports but disallow runtime Wasm code generation. The build
therefore imports the three compiled modules with `?module`; the public CI gate
pins their source files to `diagnostic/manifest.json`.

The edge runtime does not expose the original compiled-module bytes for hashing.
Its receipt therefore says `runtimeSha256Observed: false` and describes a
build-pinned static binding. It never re-labels expected digests as observed facts.

Both hosts instantiate the same generated component adapter with the Preview 2
shim, empty environment, zero preopens, disabled guest network, and bounded output
capture. Edge executions are serialized inside each isolate because the shim's
stdout binding is module-global.

## Portability verdict

A deployment is marked portable only after both target receipts report actual
completion and the host compares:

- manifest ID;
- component ID;
- deterministic component output; and
- SHA-256 of the exact captured output.

The receipt records two actual targets. Merely modeling a target or producing a
plan is never counted as portability evidence.

## Claim taxonomy

- **Configured and enforced:** closed manifests/targets, pinned artifacts, handoff
  validation and expiry, zero preopens/env, disabled guest network, bounded output.
- **Actively observed:** both terminations, durations, byte counts, output hashes,
  and the browser's loaded-module hashes.
- **Build-pinned:** the edge's static module inputs as checked by the public CI gate.
- **Component-reported:** deterministic workload status and inventory records.
- **Independent attestation:** absent.

## Deliberately excluded

The service exposes no daemon, worker, native, OCI, upload, shell, QEMU, arbitrary
URL, arbitrary byte, or user-supplied component path. OCI remains outside the
public design until the inherited Docker-client environment separation is fixed.
QEMU remains outside until its implementation and explicit ignored-test gate are
repaired. Those exclusions are product boundaries, not hidden capabilities.
