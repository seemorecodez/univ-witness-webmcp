# Included portable WASI workload

`univ-portable-workload` is the only executable component exposed by the public demo.
It accepts only `portable-release-v1` and prints a deterministic release-inventory
result. `network-bound-release-v1` and arbitrary references are refused by the
component as defense in depth. There is no upload, shell, native, OCI, worker,
daemon, or QEMU path.

The browser verifies every generated module's SHA-256 digest before compilation. The
OpenAI Sites edge imports the same generated modules statically because Workers
disallow runtime Wasm compilation; CI pins those files to `manifest.json`. Cross-host
Rust builds are not claimed to be byte-identical. Both runtime imports use zero
filesystem preopens, an empty environment, and disabled guest networking. Those are
configured or observed claims, not independent attestation.
