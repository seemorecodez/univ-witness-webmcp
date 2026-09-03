# Proof-carrying deployment experiment

This isolated experiment is the finite first slice of the
[UNIV deployment compiler](../../docs/UNIVERSAL_DEPLOYMENT_THEORY.md). It asks
whether one target-neutral intent can compile into distinct, separately checked
execution capsules for different target bindings. Its finite-model result is
integrated into UNIV Deploy v2; the immutable `univ-deploy-v1.0.0` tag preserves
the earlier baseline.

The planner compiles four finite set relations into a deterministic certificate.
The verifier, implemented separately and without importing the planner, recomputes
the models, clauses, verdict, and digest. A valid certificate means only that the
closed manifest and target model satisfy those relations. The existing UNIV
deployment receipt remains the evidence that execution actually happened.

Run the experiment:

```powershell
npm run experiment:proof-carrying
npm run demo:proof-carrying
```

The negative case asks for `guest-network` while policy permits no guest
authorities. Its certificate must say `BLOCK` and expose `guest-network` as the
counterexample and an empty portability frontier. Mutation tests must reject a
changed verdict, target grant, artifact digest, and execution binding.

The demo also consumes the frozen, agent-originated production receipt. It emits
a runtime portability witness only when both actual target receipts agree on every
observation required by the intent. Changing one target's output hash must
falsify that witness.
