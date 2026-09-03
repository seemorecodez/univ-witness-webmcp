# UNIV deployment compiler: theory-to-reality experiment

> Classification: bounded research claim implemented in UNIV Deploy v2. The
> immutable `univ-deploy-v1.0.0` tag preserves the earlier baseline. Claims about
> unregistered hosts and adapter composition remain research directions only.

## The theoretical option

**Compile deployment instead of scripting platforms.**

UNIV treats deployment as a translation problem between two machine-readable
contracts:

1. a **deployment intent** says what a pinned workload requires, what authority it
   may receive, and which observable behavior must survive deployment; and
2. a **target passport** says what a host provides, what it would grant, how it
   binds the artifact, and which evidence it can actually observe.

The compiler calculates the intent's **portability frontier**: the set of target
passports for which it can produce a verified execution capsule. Each capsule is a
closed, target-specific handoff. After real execution, target receipts are reduced
to the intent's observation contract and compared.

```text
                  target passport: browser
                 /                          \
deployment intent                            execution capsule -> real receipt
                 \                          /
                  target passport: edge

        compile-time compatibility proof
                         +
          runtime observational witness
```

The idea can be stated precisely for the finite model:

```text
compatible(intent, target) :=
  intent.requiredFeatures subset-of target.providedFeatures
  and intent.requestedAuthorities subset-of intent.allowedAuthorities
  and target.grantedAuthorities subset-of intent.allowedAuthorities
  and target.observations covers intent.requiredObservations

frontier(intent, targets) :=
  { target | verify(compile(intent, target)) = true }

portable(intent, selectedTargets) :=
  every selected target is in frontier(intent, targets)
  and every target actually completed
  and every receipt agrees on intent.requiredObservations
```

This is not a proof that arbitrary programs behave identically. It is a bounded
claim over an explicit capability model and an explicit set of observations.

## Why this is still an open, useful problem

WebAssembly provides a portable code format, but does not define host APIs; the
[official portability notes](https://webassembly.org/docs/portability/) explicitly
leave imports to the host. WASI's own
[design principles](https://github.com/WebAssembly/WASI/blob/main/docs/DesignPrinciples.md)
say portability is API-specific and hosts need not implement every interface. WIT
worlds describe imports and exports, and component tooling can compose known
implementations, but that does not by itself select deployment targets, enforce a
release policy, or prove what actually ran.

[wasmCloud](https://wasmcloud.com/docs/v1/concepts/applications/) already has
declarative application manifests and distributed Wasm hosts. UNIV must not claim
that manifests, capabilities, Wasm portability, or orchestration are new. Its
narrow research distinction is:

- the targets are unrelated hosts, not members of one required runtime lattice;
- each target self-describes through a portable passport;
- a browser agent uses
  [WebMCP](https://github.com/webmachinelearning/webmcp) to compile one intent into
  reviewable target-specific capsules;
- compile-time compatibility and post-run equivalence remain separate evidence;
- an incompatible target yields a useful counterexample, not a failed rollout.

That distinction is a hypothesis until another unrelated target can implement the
passport and capsule contract without changing the intent compiler.

## What exists physically today

The frozen app already supplies the physical lower half of the experiment:

- one digest-pinned WASI Preview 2 component;
- one closed portable manifest and one network-bound negative control;
- two actual and meaningfully different execution bindings:
  `browser-wasi` and `sites-edge-wasi`;
- integrity-bound handoffs;
- actual receipts with honest differences in observation strength; and
- output equality over deterministic component output.

The research branch adds the missing upper half:

- a target-neutral deployment intent;
- machine-readable passports for the two real targets;
- a compiler that derives the portability frontier and target capsules;
- a compatibility certificate checked by a separately implemented verifier; and
- counterexamples and mutation tests that can falsify the compiler's claim.

## The judge-visible moment

The agent says: **“Deploy this intent everywhere it is valid.”**

UNIV discovers two target passports. The compiler visibly derives two different
capsules from one intent, verifies both, then releases their controlled handoffs.
The browser and edge execute. Their receipts differ in runtime and evidence method
but converge on the declared output. The agent then tries the network-bound intent.
The portability frontier becomes empty, the handoff remains closed, and
`guest-network` is shown as the exact counterexample.

That single sequence demonstrates WebMCP agency, universal-deployment ambition,
real execution, and refusal—not just a dashboard describing two targets.

## Reality ladder

### Level 1: finite compiler experiment

Use a closed adapter registry and the two existing targets. Produce deterministic
capsules, independently checked compatibility certificates, and an empty-frontier
negative case. This can be completed and tested without touching the frozen site.

### Level 2: product integration — implemented

Expose deployment compilation through `compile_univ_deployment`. The UI shows intent,
passports, portability frontier, capsule differences, verification result, real
receipts, and the bounded equivalence verdict in one causal timeline.

### Level 3: external falsification

Implement the passport/capsule contract on a third WASI host without changing the
compiler or intent. If compiler changes are required for every host, UNIV is still
a collection of integrations rather than a universal deployment protocol.

### Level 4: adapter composition

When an intent imports a WIT interface that a target lacks, select an included,
digest-pinned component adapter and compose a new closed artifact. Prove the
interface graph closes before handoff. This is the deeper research direction; it
is not required for the current hackathon claim.

## Promotion criteria

The experiment earns integration only when:

- one intent deterministically compiles to distinct capsules for both real hosts;
- an independent verifier accepts every allowed capsule and rejects every defined
  mutation;
- the network-bound intent produces an empty frontier and no executable capsule;
- the existing target executors consume the derived capsule data without a hidden
  second source of truth;
- actual receipts still satisfy the declared observation contract;
- the entire agent-visible causal chain is understandable in under 45 seconds; and
- the submission says “finite portability frontier over registered passports,”
  not “runs everywhere.”
