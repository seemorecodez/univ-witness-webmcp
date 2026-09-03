# Architecture and evidence boundary

UNIV Deploy v2 demonstrates a narrow proof-carrying deployment primitive: a closed
intent is compiled against registered target passports, verified target-specific
capsules are handed off under fixed constraints, and actual executions on two
different WASI hosts are compared over a declared observation contract. The
immutable `univ-deploy-v1.0.0` tag preserves the earlier manifest-driven baseline.

```text
browser agent or human control
              │ closed deployment intent
              ▼
 target-passport intent compiler
              │
              ├── compatibility certificates
              ├── finite portability frontier
              └── target execution capsules
              │ verified capsules only
              ▼
 expiring capsule-bound handoff
       ┌──────┴─────────┐
       ▼                ▼
 browser-wasi      sites-edge-wasi
 runtime SHA-256   static compiled modules
 before compile    pinned by manifest + CI
       │                │
       └──────┬─────────┘
              ▼
 declared-observation equality
       + portability witness
```

The compiler does not claim target-independent execution by itself. It produces
target-specific capsules from one intent, and the runtime witness is withheld
until the actual target receipts agree over the declared observations.

## Target passports and execution capsules

Each closed target passport describes its provided finite feature set, granted
authorities, observable receipt fields, runtime label, and target-specific binding.
The compiler accepts a target only when required features and observations are
provided and all requested or granted authorities remain under the intent's
authority ceiling.

The separately implemented verifier recomputes the manifest digest,
target-passport digest, four set-relation clauses, certificate verdict, and
execution capsule. It is an internal deterministic verifier, not an outside
attester. A v2
handoff binds the compiled program digest and both verified capsule digests. Each
v2 target receipt reports the capsule digest it consumed.

The passports are currently included, checked-in models rather than remotely
signed or live-discovered host statements. A third unrelated host has not yet
implemented this protocol. Those are explicit research limitations.

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

The v2 handoff fixes the manifest digest, source and core digests, target set,
constraints, creation time, five-minute expiry, compiled program, and verified
execution capsules. Its
SHA-256 digest covers the canonicalized envelope. Each target validates the
contract, known manifest, target membership, capsule, expiry, constraints, and
digest before running.

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
The Workers clock can remain at zero during an invocation, so the edge receipt also
labels that timing limitation; termination and output are observed, but
sub-millisecond elapsed time is not claimed.

Both hosts instantiate the same generated component adapter with the Preview 2
shim, empty environment, zero preopens, disabled guest network, and bounded output
capture. Edge executions are serialized inside each isolate because the shim's
stdout binding is module-global.

## Portability verdict

A deployment is marked portable only after both target receipts report actual
completion and the host compares the declared observation contract:

- manifest ID;
- component ID;
- deterministic component output; and
- SHA-256 of the exact captured output.

The receipt records two actual targets. Merely modeling a target, compiling a
certificate, or producing an execution capsule is never counted as runtime
portability evidence.

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
