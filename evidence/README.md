# Production evidence

Verified on 2026-09-03 against
<https://univ-witness-proof.seemoreas0-0.chatgpt.site>.

## External deployment proof

- Page loaded with title `UNIV Deploy — Proof-carrying WebMCP deployment`.
- The browser discovered all five page-defined WebMCP tools at the public origin.
- Browser console warnings/errors after the final deployment: none.
- OpenAI Sites version 7 was built from implementation commit
  `811a66cf6172df2cbd63b6d82476774728892d37` and deployed successfully.

## Manifest policy proof

The public WebMCP tool `compile_univ_deployment` was invoked with both included
manifests:

- `portable-release-v1`: `PERMIT`; two verified execution capsules emitted.
- `network-bound-release-v1`: `BLOCK`; empty portability frontier, no capsules,
  and the machine-readable counterexample `guest-network`.

## Real agent-originated universal deployment

The Codex in-app browser invoked the public WebMCP flow: challenge the compiler
with the blocked intent, compile the permitted intent, create its handoff, deploy
both capsules, and retrieve the evidence. The v2 receipt is stored verbatim in
[production-webmcp-receipt-v2.json](production-webmcp-receipt-v2.json).

- Evidence ID: `b304eb6e-d9d7-4054-9342-f78e6f069beb`
- Evidence digest:
  `e206f01b8d5a05d56ea8f7d052eb0d634c1ab9794b95a7e463d2687fe50c181a`
- Source: `WebMCP`
- Actual targets: `browser-wasi`, `sites-edge-wasi`
- Capsules: target-specific, independently verified, and digest-bound into the
  v2 handoff.
- Runtime witness: `equivalentOverDeclaredObservations: true` across the two
  executed registered targets.
- Matching output SHA-256:
  `a928646501fcc69ed8af413859d43d4b887f3be150c452696700e393d8e338f5`
- Browser artifact binding: runtime SHA-256 observed before compilation.
- Edge artifact binding: statically imported compiled modules pinned by manifest
  and CI; runtime module-byte SHA-256 not claimed.
- Edge timing: the Workers clock returned zero and the receipt explicitly warns
  that sub-millisecond elapsed time is not claimed. Termination and output were
  observed.
- Independent attestation: absent.

The IDs are session-local. The handoff is integrity-bound but is not caller
authentication, identity authorization, a digital signature, or outside
attestation.

## Required submission CI

- Implementation commit:
  `811a66cf6172df2cbd63b6d82476774728892d37`
- Public run: [UNIV Deploy required gate 33783787273](https://github.com/seemorecodez/univ-witness-webmcp/actions/runs/33783787273), succeeded
- Branch protection: strict required context `UNIV Deploy required gate`
- Force pushes and branch deletion: disabled
- Administrator enforcement: disabled so the solo maintainer can push the commit
  that creates its own status; pull requests cannot merge without the required
  context

The inherited UNIV repository's unrelated cross-platform failures remain
historical and are not represented as this submission's passing gate.

## Viewport screenshots

1. [Overview](screenshots/01-overview.png) — one intent, two verified capsules,
   and the observed witness at the public origin.
2. [Agent portability receipt](screenshots/02-webmcp-portability.png) — both actual
   targets executed, portable result, and visible `via WebMCP` activity.
3. [Blocked manifest](screenshots/03-webmcp-blocked-manifest.png) — guest-network
   manifest refused before handoff through an agent-originated plan call.
4. [Exact receipt JSON](screenshots/04-exact-receipt-json.png) — the v2 schema,
   evidence ID, `WebMCP` source, and digest-bound handoff are visible in-page.

The previous diagnostic-only captures remain recoverable from Git history and are
not presented as evidence for the current architecture.
