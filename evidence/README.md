# Production evidence

Verified on 2026-08-31 against
<https://univ-witness-proof.seemoreas0-0.chatgpt.site>.

## External URL proof

- Page: HTTP 200, title `UNIV Witness — WebMCP WASI release diagnostics`
- Main WASI module: HTTP 200, 61,026 bytes
- Observed SHA-256:
  `d68feaf63019279c72af748a29527c74ac7a44023bea812a1e880712bcc5203c`
- Browser console warnings/errors after the final run: none

## Real agent-originated session

The Codex in-app browser discovered the four page-defined tools from the deployed
origin and called `run_release_diagnostic` through its WebMCP capability with
`approved-release-v1`.

- Evidence ID: `51ea6d1b28d6e128ec3dd4c23e364932`
- Evidence digest:
  `00e2709998068f55c8c44a5c9e3ad62e56705df637d5cf3fd53512f56af72903`
- Source: `WebMCP`
- Verdict: `PASS`
- Core digests matched: `true`
- Deterministic stdout: 434 bytes, not truncated

The exact returned object is in [production-webmcp-receipt.json](production-webmcp-receipt.json).
The ID is session-local by design and is not a remotely attested identifier.

## Required submission CI

- Implementation commit: `a3a5e58514dd1a4e829a924be091219405813183`
- Public run: [Witness required gate 33439924214](https://github.com/seemorecodez/univ-witness-webmcp/actions/runs/33439924214), succeeded
- Branch protection: strict required context `Witness required gate`
- Force pushes and branch deletion: disabled
- Administrator enforcement: disabled so the solo maintainer can push a commit that
  creates its own status; pull requests cannot merge without the required context

The inherited UNIV repository's unrelated cross-platform jobs remain historical
failures and are not represented as this submission's passing gate.

## Viewport screenshots

1. [Overview](screenshots/01-overview.png) — audience, workflow, closed profiles,
   and pre-execution boundaries.
2. [Agent PASS receipt](screenshots/02-webmcp-pass.png) — `via WebMCP`, deterministic
   5/5 output, and agent activity timeline.
3. [Agent negative control](screenshots/03-webmcp-negative-control.png) — selected
   blocked profile, deterministic BLOCK result, and `via WebMCP` timeline.
4. [Evidence JSON](screenshots/04-evidence-json.png) — exact receipt payload,
   configured boundary, and explicit absence of independent attestation.
