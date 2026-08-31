# Production evidence

The previous diagnostic-only screenshots and receipt were removed when the entry
became UNIV Deploy. They remain recoverable from Git history and are not presented
as evidence for the current architecture.

## Verified local production path

On 2026-08-31, the built application ran under the local OpenAI Sites/Cloudflare
Workers production runtime. The Codex in-app browser discovered the five page-defined
tools and invoked the complete flow through WebMCP:

1. `plan_univ_deployment` returned `PERMIT` for `portable-release-v1`.
2. `create_deployment_handoff` created handoff
   `08205752-8413-4f00-ba91-06a65f50d1ef`.
3. `deploy_univ_manifest` executed `browser-wasi` and `sites-edge-wasi`.
4. Both targets returned output SHA-256
   `a928646501fcc69ed8af413859d43d4b887f3be150c452696700e393d8e338f5`.
5. Deployment receipt `e3a5aa99-e96a-4f81-beac-3202637e16fa` recorded source
   `WebMCP`, two actual targets, and `portableAcrossExecutedTargets: true`.

The blocked manifest was also called through WebMCP and returned `BLOCK` before
handoff because guest networking is disabled on every exposed target.

The IDs are session-local, and none of this is represented as independent
attestation. Public deployment evidence, the exact public receipt, CI run, and four
new viewport screenshots are added here only after they are re-observed against the
updated public URL.
