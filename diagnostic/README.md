# Included WASI diagnostic

`witness-release-diagnostic` is the only executable component exposed by the public demo.
It accepts one closed, included profile ID and prints a deterministic JSON release-policy
report. It has no upload, shell, native, OCI, worker, daemon, or QEMU path.

The browser verifies the compiled component's SHA-256 digest before instantiation. Runtime
imports are configured with zero filesystem preopens, an empty environment, and network
disabled. Those are host-enforced configuration claims, not independent attestation.

