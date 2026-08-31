# Build Week evidence

This file records verifiable project provenance without exposing private session
content or secrets.

| Date/time (UTC) | Evidence | Work completed | Codex contribution | Exact-model status | Human decision |
|---|---|---|---|---|---|
| 2026-08-31 19:25 | Codex task `01a049d6-70c3-7f81-8652-89ffca040c41`; session-local receipt `bf1cec91656c6af2367ab27c44c93748` | Real agent-originated `run_release_diagnostic` call; 3/3 executable digests matched; deterministic 5/5 PASS; visible `via WebMCP` timeline | Built, invoked, and browser-verified the closed WebMCP/WASI path | Exact model not independently recorded in this repo | Frank required WASI-only public scope and honest attestation language |
| 2026-08-31 | Commit `f5098c8be28fce550f370066641f8ba51604c5c3` | Sites UI, diagnostic source, digest manifest, CI gate, security audit, architecture and submission docs | Implemented and validated the repository | Confirm from Codex task metadata before Devpost claim | Frank selected release/security teams as the target user |
| 2026-08-31 20:05 | Production receipt `51ea6d1b28d6e128ec3dd4c23e364932` and `evidence/production-webmcp-receipt.json` | Deployed URL, agent-originated WebMCP PASS, final viewport captures, zero browser warnings/errors | Discovered and called the deployed page-defined tool, then captured the resulting UI | Exact model not independently recorded in this repo | Frank required the visible timeline to say `via WebMCP`, not `via human` |
| 2026-08-31 20:59 | Commit `a3a5e58514dd1a4e829a924be091219405813183`; Actions run `33439924214` | Public Witness-specific gate passed and became the strict required branch context; actions pinned to exact supported release commits | Diagnosed cross-host Rust byte variance, separated source testing from artifact reproducibility, and verified the public gate | Exact model not independently recorded in this repo | Frank required a clean required gate while retaining honest inherited-failure disclosure |
| 2026-08-31 22:15 | Local production WebMCP receipt `e3a5aa99-e96a-4f81-beac-3202637e16fa`; handoff `08205752-8413-4f00-ba91-06a65f50d1ef` | Reframed the product as UNIV Deploy; planned one manifest, created an integrity-bound handoff, executed `browser-wasi` and `sites-edge-wasi`, and matched output SHA-256 `a928646501fcc69ed8af413859d43d4b887f3be150c452696700e393d8e338f5` | Designed, implemented, and browser-tested the two-runtime deployment contract and honest target evidence | Exact model not independently recorded in this repo | Frank required the entry to demonstrate universal deployment rather than two diagnostic profiles |

The earlier Witness rows document the superseded diagnostic iteration. The current
submission is the UNIV Deploy architecture described in the README; its public
deployment, CI, screenshots, and receipt are recorded separately after promotion.

## Prior work boundary

The pre-existing UNIV codebase and its native Wasmtime Witness prototype are prior
work. This repository begins with the clean browser-hosted WebMCP/WASI submission
surface described in the README. Its Git history is the authoritative new-work
boundary.

## Primary Codex session

Codex task: `01a049d6-70c3-7f81-8652-89ffca040c41`

`/feedback` Session ID: not yet captured. Enter the real value in Devpost when the
guided workflow provides it; do not substitute the task ID above unless Devpost
explicitly accepts it.
