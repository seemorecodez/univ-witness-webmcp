# UNIV Witness

[![Witness required gate](https://github.com/seemorecodez/univ-witness-webmcp/actions/workflows/witness-ci.yml/badge.svg)](https://github.com/seemorecodez/univ-witness-webmcp/actions/workflows/witness-ci.yml)

UNIV Witness is a WebMCP demonstration for release and security teams: browser
agents can run only pre-approved WASI diagnostics and receive reviewable execution
receipts without being granted arbitrary code execution.

## What it does

- Registers four page-defined WebMCP tools for capabilities, planning, execution,
  and session-local evidence retrieval.
- Accepts only two included profile IDs: one positive release candidate and one
  meaningful negative control.
- Hashes every executable core module with SHA-256 before WebAssembly compilation.
- Runs the included WASI Preview 2 diagnostic with zero filesystem preopens, an
  empty environment, and guest networking disabled.
- Caps stdout capture at 4,096 bytes and returns a receipt that distinguishes host
  enforcement, host observations, component claims, and independent attestation.
- Exposes no upload, shell, native, OCI, worker, daemon, QEMU, arbitrary-URL, or
  arbitrary-byte execution path.

The intended workflow is:

> Release and security teams can let browser agents run only pre-approved
> diagnostics and return reviewable execution receipts without granting arbitrary
> code execution.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the execution and evidence boundary.

## Installation

Prerequisites:

- Node.js 22.13.0 or newer
- npm 10 or newer
- Rust stable with `wasm32-wasip2` only when rebuilding the diagnostic

```bash
npm ci
```

No API key, account, test credential, uploaded file, or external sample data is
required.

## Supported platforms

- Tested locally on Windows 11 with Node.js 22 and Rust 1.96.
- CI runs on GitHub-hosted Ubuntu with Node.js 22 and Rust stable.
- The deployed application targets OpenAI Sites/Cloudflare Workers.
- Human controls work in modern browsers with WebAssembly and Web Crypto.
- Agent tools require a browser exposing the page-defined WebMCP
  `document.modelContext` API.

The Bytecode Alliance preview2 shim labels browser support experimental. This is a
bounded hackathon demonstration, not a production-isolation claim.

## Run

```bash
npm run dev
```

Open `http://localhost:3000`. Select either included profile, inspect its plan, or
run the WASI diagnostic. In a WebMCP-capable agent browser, ask the agent to call
`run_release_diagnostic` with `approved-release-v1`; the activity timeline and
receipt will visibly say `via WebMCP`.

## Sample data

No external data is required. Both diagnostic profiles are compiled into the
included component so the positive and negative results are deterministic and
safe for public judging.

## Test it without rebuilding

The public OpenAI Sites URL is added here immediately after the first verified
deployment. Until then, `npm ci && npm run dev` is the exact local judge path; no
credentials are required.

Public source: <https://github.com/seemorecodez/univ-witness-webmcp>

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

`Witness required gate` repeats the same checks in public GitHub Actions and
retranspiles the component with pinned `@bytecodealliance/jco@1.17.9` to prove the
checked-in executable digests are reproducible.

## Evidence language

| Category | What this project claims |
|---|---|
| Configured and enforced | Closed profile enum, SHA-256 gate before instantiation, zero preopens/env, disabled guest network, bounded capture |
| Actively observed | Loaded module digests, stdout bytes, termination, and duration |
| Component-reported | Five release-policy checks and a deterministic PASS/BLOCK verdict |
| Independent attestation | **Absent** — no external signer or remote attester verifies the browser host or receipt |

## Built with Codex and GPT-5.6

Codex accelerated repository auditing, WebMCP integration, WASI component work,
UI implementation, dependency remediation, browser testing, CI design, and
deployment preparation. The primary session produced a real agent-originated
WebMCP call and validated the visible receipt in the browser.

Frank made the controlling product and security decisions: public WASI only,
included digest-pinned components, no inherited native/container/emulator paths,
the release-and-security-team framing, deterministic diagnostic output, and honest
separation of enforcement from attestation.

The repository itself does not independently attest the exact underlying model
version. The Devpost submission should name GPT-5.6 only after the task metadata or
required `/feedback` record confirms it. This avoids fabricating model provenance.

See [BUILD_WEEK_EVIDENCE.md](BUILD_WEEK_EVIDENCE.md) for dated evidence.

## Prior work and Build Week work

The concept was derived from the pre-existing UNIV repository and an earlier native
Rust/Wasmtime Witness prototype. That inherited repository also contains daemon,
worker, native, OCI, QEMU, and unrelated project material, and its broad CI has
known cross-platform failures.

This clean repository contains the new submission surface built during the current
hackathon work: the OpenAI Sites application, closed WebMCP contract, browser-hosted
WASI diagnostic, deterministic profiles, digest manifest, bounded receipts,
claim-taxonomy UI, reproducibility gate, and deployment configuration. None of the
unrelated role-adaptive-agent files or inherited execution adapters are included.

The earlier broad repository remains historical evidence; its failing jobs are not
represented as passing. This clean repo's `Witness required gate` is the required
submission-specific signal.

## License and governance

MIT © SeemoreCodez. See [LICENSE](LICENSE) and
[README-LICENSING.md](README-LICENSING.md).
