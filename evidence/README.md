# Production evidence

Verified on 2026-08-31 against
<https://univ-witness-proof.seemoreas0-0.chatgpt.site>.

## External deployment proof

- Page loaded with title `UNIV Deploy — Universal WebMCP WASI deployment`.
- The browser discovered all five page-defined WebMCP tools at the public origin.
- Browser console warnings/errors after the final deployment: none.
- OpenAI Sites version 5 was built from implementation commit
  `d1bead1a4d1e50a8e76eafba1a48a6559840bdce` and deployed successfully.

## Manifest policy proof

The public WebMCP tool `plan_univ_deployment` was invoked with both included
manifests:

- `portable-release-v1`: `PERMIT`; controlled handoff available.
- `network-bound-release-v1`: `BLOCK`; no handoff because guest networking is
  disabled on every exposed target.

## Real agent-originated universal deployment

The Codex in-app browser invoked the public WebMCP flow: plan, create handoff,
deploy. The returned receipt is stored verbatim in
[production-webmcp-receipt.json](production-webmcp-receipt.json).

- Evidence ID: `d014533e-c7ef-44ac-b96e-4297ca1317df`
- Evidence digest:
  `8ac90d9255b89d962383c4d32766350bd05a5d0c4336b13b793f19765844a630`
- Source: `WebMCP`
- Actual targets: `browser-wasi`, `sites-edge-wasi`
- Portability: `portableAcrossExecutedTargets: true`
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
  `d1bead1a4d1e50a8e76eafba1a48a6559840bdce`
- Public run: [UNIV Deploy required gate 33447301916](https://github.com/seemorecodez/univ-witness-webmcp/actions/runs/33447301916), succeeded
- Branch protection: strict required context `UNIV Deploy required gate`
- Force pushes and branch deletion: disabled
- Administrator enforcement: disabled so the solo maintainer can push the commit
  that creates its own status; pull requests cannot merge without the required
  context

The inherited UNIV repository's unrelated cross-platform failures remain
historical and are not represented as this submission's passing gate.

## Viewport screenshots

1. [Overview](screenshots/01-overview.png) — closed manifest, explicit browser and
   edge targets, and the withheld pre-execution portability verdict.
2. [Agent portability receipt](screenshots/02-webmcp-portability.png) — both actual
   targets executed, portable result, and visible `via WebMCP` activity.
3. [Blocked manifest](screenshots/03-webmcp-blocked-manifest.png) — guest-network
   manifest refused before handoff through an agent-originated plan call.
4. [Exact receipt JSON](screenshots/04-exact-receipt-json.png) — bounded target
   receipts, evidence digest, source, and explicit assurance limits.

The previous diagnostic-only captures remain recoverable from Git history and are
not presented as evidence for the current architecture.
