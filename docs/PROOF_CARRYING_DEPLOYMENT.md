# Proof-carrying deployment

> Classification: the bounded finite-model claim is integrated into UNIV Deploy
> v2. The isolated experiment remains supporting falsification evidence. The
> `univ-deploy-v1.0.0` tag preserves the earlier public baseline.

This is one compiler pass inside the broader
[UNIV deployment compiler](./UNIVERSAL_DEPLOYMENT_THEORY.md), not a replacement
identity for the universal-deployment project.

## The theory made testable

UNIV's current deployment receipts answer: **what ran, where, and what came back?**
This experiment asks a different question before execution: **can the workload fit
inside the target and policy boundaries at all?**

The proposed concept is proof-carrying deployment. A manifest-driven workload
carries a deterministic compatibility certificate for a named target. A separate
verifier accepts the certificate only when all four finite relations hold:

```text
manifest.requiredFeatures     subset-of target.providedFeatures
manifest.requestedAuthorities subset-of manifest.policy.allowedAuthorities
target.grantedAuthorities     subset-of manifest.policy.allowedAuthorities
manifest.requiredObservations subset-of target.providedObservations
```

If a relation does not hold, the certificate is `BLOCK` and names the minimal set
difference as its counterexample. The deployment handoff remains closed. A `PASS`
is not permission and is not proof that execution occurred; it is a checkable
precondition that can be attached to the handoff and followed by a real receipt.

## User and workflow

Release and security teams can let browser agents prepare portable deployments
only when a pinned workload has a verifiable fit with an approved target. The
agent receives either a certificate it can present for review or a concrete
counterexample it can use to repair the manifest. Approved execution still
returns the existing bounded, target-specific deployment receipt.

```text
WebMCP agent
    |
    v
closed manifest + target model
    |
    v
certificate compiler -----> compatibility certificate
                                  |
                                  v
                         independent verifier
                           |              |
                        BLOCK           verified PASS
                   + counterexample        |
                                          v
                                 controlled handoff
                                          |
                                          v
                                  real target receipt
```

## Architecture decision

| Alternative | What it adds | Main weakness | Decision |
| --- | --- | --- | --- |
| Empirical receipts only | Strong evidence after execution | Cannot explain incompatibility before handoff | Preserve as runtime evidence |
| Proof-carrying compatibility | Checkable precondition and useful counterexample | Closed model is narrower than a formal proof of all runtime behavior | **Experiment first** |
| Predictive digital twin | Visually compelling simulated outcomes | Simulation can be mistaken for deployment truth | Reject for this deadline |
| Zero-knowledge proof or TEE attestation | Stronger privacy or hardware-rooted claims | New infrastructure, trust, cost, and failure modes; not needed for the stated user | Reject for this release |

This is intentionally a finite, machine-checkable capability proof—not formal
verification of arbitrary programs, a signature, authentication, authorization,
runtime equivalence, or independent attestation.

## Why it could matter to the judges

- **WebMCP leverage:** the browser agent receives actionable proof data before it
  requests a controlled deployment handoff, instead of wrapping a generic button.
- **Execution:** the proof does not replace the working product. A verified
  certificate must lead into the existing real browser and edge WASI paths and
  their bounded receipts.
- **Potential impact:** release and security teams get a reviewable reason to
  permit or block an agent-prepared deployment without granting arbitrary code
  execution.
- **Creativity and ambition:** the submission connects proof-carrying systems to
  browser-agent deployment while keeping the claim small enough to demonstrate.

## Cheapest credible falsification test

Use the current pinned portable workload and the two implemented target models:
`browser-wasi` and `sites-edge-wasi`. Both must independently verify as `PASS`.
Then change one thing at a time:

1. Request forbidden `guest-network`; compilation must return `BLOCK` with exactly
   `guest-network` as the counterexample.
2. Change the certificate verdict; verification must reject it.
3. Add a target authority after certification; verification must reject the stale
   target digest.
4. Substitute the artifact digest after certification; verification must reject
   the stale manifest digest.
5. Recompile the same inputs; the certificate must be byte-for-byte deterministic.
6. Change a capsule's target binding; verification must reject it.
7. Change one target receipt's output observation; the runtime witness must fail.

The independent verifier must not import the planner. The local research branch
now also binds verified capsules into the app's v2 handoff and receipt contracts.
These tests are necessary, but not enough to promote the concept into the frozen
public submission.

## Promotion gate

Promote this experiment only if all of the following are true:

- every positive and negative test passes reproducibly;
- every planned mutation is rejected (100% of this defined mutation matrix);
- a judge can understand the claim, limitation, pass case, and counterexample in
  under 30 seconds;
- the certificate appears in a real agent-originated WebMCP flow;
- a verified pass is followed by the existing controlled handoff and real receipt;
- the browser and edge output-equivalence evidence still passes;
- public language preserves the distinction between configured boundaries,
  observed runtime evidence, and independent attestation.

Do not promote it if the certificate merely hashes the planner's own assertion,
if verifier and planner share their decision implementation, if the flow stops at
the proof instead of running, or if the user-facing explanation requires formal
methods expertise.
