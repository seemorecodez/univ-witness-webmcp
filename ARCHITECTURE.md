# Architecture and evidence boundary

UNIV Witness exposes four page-defined WebMCP tools. They accept only two included
profile IDs and never accept executable bytes, paths, URLs, shell text, container
images, or host configuration.

```text
browser agent
    │ WebMCP: capabilities / plan / run / evidence
    ▼
closed TypeScript service
    │ profile enum + SHA-256 gate
    ▼
included WASI Preview 2 diagnostic
    │ empty env + zero preopens + guest network disabled
    ▼
bounded stdout → session-local receipt
```

## Executable identity

The committed WASI component and every jco-produced core module are listed in
`diagnostic/manifest.json`. The browser hashes each core module before compilation
and refuses a mismatch. CI compiles and tests the Rust source, then independently
retranspiles the exact committed component with pinned
`@bytecodealliance/jco@1.17.9` and compares the resulting executable digests. The
manifest records that the Rust compiler output is not claimed to be bit-reproducible
across host operating systems.

## Claim taxonomy

- **Configured and enforced by this host:** closed profile allowlist, exact SHA-256
  module gate, zero filesystem preopens, empty guest environment, disabled guest
  networking, and a 4,096-byte stdout capture ceiling.
- **Actively observed by this host:** hashes of bytes actually loaded, component
  termination, duration, and captured/written byte counts.
- **Component-reported:** the five release-policy check results and PASS/BLOCK
  verdict emitted by the included diagnostic.
- **Independent attestation:** absent. No external signer, TEE, or remote verifier
  attests to the browser host, runtime, candidate facts, or receipt.

The Bytecode Alliance preview2 shim describes browser support as experimental. This
submission is a bounded hackathon demonstration, not a claim that the browser shim
is production-ready isolation.
