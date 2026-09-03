'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  COMPONENT_ID,
  MANIFESTS,
  getCapabilities,
  planDeployment,
  type DeploymentHandoff,
  type DeploymentPlan,
  type DeploymentReceipt,
  type InvocationSource,
  type ManifestId,
  type TargetId,
} from './lib/deployment-contract';
import { createStoredHandoff, deployStoredHandoff, getDeploymentEvidence } from './lib/deployment';

type TimelineState = 'STARTED' | 'COMPLETE' | 'REFUSED';
type TimelineItem = {
  id: string;
  at: string;
  operation: string;
  source: InvocationSource | 'page';
  state: TimelineState;
  detail?: string;
};

const TOOL_NAMES = [
  'get_univ_capabilities',
  'compile_univ_deployment',
  'create_deployment_handoff',
  'deploy_univ_manifest',
  'get_deployment_evidence',
] as const;

function shortDigest(value?: string) {
  return value ? `${value.slice(0, 12)}…${value.slice(-8)}` : 'not created';
}

function errorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : 'Unknown failure';
}

export default function Home() {
  const [manifestId, setManifestId] = useState<ManifestId>('portable-release-v1');
  const [plan, setPlan] = useState<DeploymentPlan | null>(null);
  const [handoff, setHandoff] = useState<DeploymentHandoff | null>(null);
  const [receipt, setReceipt] = useState<DeploymentReceipt | null>(null);
  const [busy, setBusy] = useState<'plan' | 'handoff' | 'deploy' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [webMcpStatus, setWebMcpStatus] = useState<'checking' | 'ready' | 'unavailable' | 'failed'>('checking');
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);

  const addTimeline = useCallback((operation: string, source: TimelineItem['source'], state: TimelineState, detail?: string) => {
    setTimeline((items) => [{
      id: crypto.randomUUID(),
      at: new Date().toLocaleTimeString([], { hour12: false }),
      operation,
      source,
      state,
      detail,
    }, ...items].slice(0, 16));
  }, []);

  const invoke = useCallback(async <T,>(operation: string, source: InvocationSource, task: () => Promise<T> | T): Promise<T> => {
    addTimeline(operation, source, 'STARTED');
    setError(null);
    try {
      const value = await task();
      addTimeline(operation, source, 'COMPLETE');
      return value;
    } catch (caught) {
      const message = errorMessage(caught);
      setError(message);
      addTimeline(operation, source, 'REFUSED', message);
      throw caught;
    }
  }, [addTimeline]);

  const runPlan = useCallback(async (selected: unknown, source: InvocationSource) => {
    const next = await invoke(TOOL_NAMES[1], source, () => planDeployment(selected));
    setPlan(next);
    setManifestId(next.manifestId);
    setHandoff(null);
    setReceipt(null);
    return next;
  }, [invoke]);

  const makeHandoff = useCallback(async (selected: unknown, source: InvocationSource) => {
    const next = await invoke(TOOL_NAMES[2], source, async () => {
      const selectedPlan = await planDeployment(selected);
      const selectedHandoff = await createStoredHandoff(selected);
      return { selectedPlan, selectedHandoff };
    });
    setManifestId(next.selectedHandoff.manifestId);
    setPlan(next.selectedPlan);
    setHandoff(next.selectedHandoff);
    setReceipt(null);
    return next.selectedHandoff;
  }, [invoke]);

  const runDeployment = useCallback(async (handoffId: unknown, handoffDigest: unknown, source: InvocationSource) => {
    const next = await invoke(TOOL_NAMES[3], source, () => deployStoredHandoff(handoffId, handoffDigest, source));
    const receiptPlan = await planDeployment(next.manifestId);
    setManifestId(next.manifestId);
    setPlan(receiptPlan);
    setReceipt(next);
    return next;
  }, [invoke]);

  useEffect(() => {
    void planDeployment('portable-release-v1').then(setPlan);
  }, []);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) {
      queueMicrotask(() => setWebMcpStatus('unavailable'));
      return;
    }
    const manifestSchema = {
      type: 'object',
      additionalProperties: false,
      required: ['manifestId'],
      properties: { manifestId: { type: 'string', enum: Object.keys(MANIFESTS) } },
    };
    const tools: WebMcpToolDefinition[] = [
      {
        name: TOOL_NAMES[0],
        description: 'Return UNIV Deploy manifests, actual WASI targets, executable boundary, and assurance limits.',
        inputSchema: { type: 'object', additionalProperties: false },
        execute: () => invoke(TOOL_NAMES[0], 'WebMCP', () => getCapabilities()),
      },
      {
        name: TOOL_NAMES[1],
        description: 'Compile one included deployment intent against registered target passports and return its finite portability frontier, proof certificates, and execution capsules without running them.',
        inputSchema: manifestSchema,
        execute: (input) => runPlan(input.manifestId, 'WebMCP'),
      },
      {
        name: TOOL_NAMES[2],
        description: 'Create a five-minute integrity-bound handoff for one permitted manifest. This is not identity authorization.',
        inputSchema: manifestSchema,
        execute: (input) => makeHandoff(input.manifestId, 'WebMCP'),
      },
      {
        name: TOOL_NAMES[3],
        description: 'Execute an existing session-local handoff on browser-wasi and sites-edge-wasi and compare the actual receipts.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['handoffId', 'handoffDigest'],
          properties: {
            handoffId: { type: 'string', pattern: '^[0-9a-f-]{36}$' },
            handoffDigest: { type: 'string', pattern: '^[0-9a-f]{64}$' },
          },
        },
        execute: (input) => runDeployment(input.handoffId, input.handoffDigest, 'WebMCP'),
      },
      {
        name: TOOL_NAMES[4],
        description: 'Retrieve one bounded deployment receipt created in this browser session by its exact evidence ID.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['evidenceId'],
          properties: { evidenceId: { type: 'string', pattern: '^[0-9a-f-]{36}$' } },
        },
        execute: (input) => invoke(TOOL_NAMES[4], 'WebMCP', () => getDeploymentEvidence(input.evidenceId)),
      },
    ];
    Promise.all(tools.map((tool) => Promise.resolve(context.registerTool(tool))))
      .then(() => {
        setWebMcpStatus('ready');
        addTimeline('WebMCP registration', 'page', 'COMPLETE', `${tools.length} tools registered`);
      })
      .catch((caught) => {
        setWebMcpStatus('failed');
        addTimeline('WebMCP registration', 'page', 'REFUSED', errorMessage(caught));
      });
    return () => {
      if (context.unregisterTool) for (const name of TOOL_NAMES) void context.unregisterTool(name);
    };
  }, [addTimeline, invoke, makeHandoff, runDeployment, runPlan]);

  const exactJson = useMemo(() => JSON.stringify({ plan, handoff, receipt }, null, 2), [handoff, plan, receipt]);
  const permitted = plan?.decision === 'PERMIT';
  const targetReceipts = new Map(receipt?.targetReceipts.map((item) => [item.targetId, item]));

  const selectManifest = (next: ManifestId) => {
    setManifestId(next);
    setHandoff(null);
    setReceipt(null);
    setError(null);
    void planDeployment(next).then(setPlan);
  };

  const onPlan = async () => {
    setBusy('plan');
    try { await runPlan(manifestId, 'human'); } catch {} finally { setBusy(null); }
  };

  const onHandoff = async () => {
    setBusy('handoff');
    try { await makeHandoff(manifestId, 'human'); } catch {} finally { setBusy(null); }
  };

  const onDeploy = async () => {
    if (!handoff) return;
    setBusy('deploy');
    try { await runDeployment(handoff.handoffId, handoff.handoffDigest, 'human'); } catch {} finally { setBusy(null); }
  };

  return (
    <main className="min-h-screen bg-[#070b0a] text-[#edf5ed]">
      <header className="border-b border-white/10 bg-[#0a100e]/95">
        <div className="mx-auto flex max-w-[1540px] items-center justify-between gap-5 px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md border border-[#9ef7bf]/40 bg-[#9ef7bf]/10 font-mono text-xs font-black text-[#9ef7bf]">UD</div>
            <div><p className="font-semibold tracking-tight">UNIV Deploy</p><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">Proof-carrying WASI deployment</p></div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`status-pill ${webMcpStatus === 'ready' ? 'status-ready' : webMcpStatus === 'failed' ? 'status-danger' : ''}`}>
              <span className="status-dot" />{webMcpStatus === 'ready' ? '5 WebMCP tools ready' : webMcpStatus === 'checking' ? 'Checking WebMCP' : webMcpStatus === 'failed' ? 'WebMCP registration failed' : 'Human fallback mode'}
            </span>
            <a className="hidden text-xs text-white/55 transition hover:text-white sm:block" href="https://github.com/seemorecodez/univ-witness-webmcp" target="_blank" rel="noreferrer">Public source ↗</a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1540px] px-5 py-7 lg:px-8">
        <section className="mb-6 grid gap-5 border-b border-white/10 pb-6 lg:grid-cols-[1.45fr_1fr]">
          <div>
            <p className="eyebrow">Compile deployment, then prove what happened</p>
            <h1 className="mt-2 max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">One deployment intent. Two execution capsules. One observed outcome.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/58">A browser agent compiles one digest-pinned WASI intent against unrelated target passports, binds only verified capsules into the handoff, executes both hosts, and returns a bounded portability witness.</p>
          </div>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10">
            <Metric value={String(plan?.portabilityFrontier.length ?? '—')} label="frontier targets" />
            <Metric value={String(plan?.targets.filter((target) => target.capsule).length ?? '—')} label="verified capsules" />
            <Metric value="0" label="arbitrary code" />
          </div>
        </section>

        <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-4">
          <FlowStep index="01" label="deployment intent" state="BOUND" />
          <FlowStep index="02" label="target passports" state={plan ? 'DISCOVERED' : 'PENDING'} />
          <FlowStep index="03" label="execution capsules" state={plan?.decision === 'PERMIT' ? 'VERIFIED' : plan ? 'REFUSED' : 'PENDING'} />
          <FlowStep index="04" label="runtime witness" state={receipt ? 'OBSERVED' : 'PENDING'} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[350px_minmax(0,1fr)_390px]">
          <section className="panel">
            <div className="panel-heading"><div><p className="eyebrow">01 / Intent</p><h2>Closed deployment intent</h2></div><span className="mono-tag">target neutral</span></div>
            <div className="space-y-3 p-4">
              {(Object.entries(MANIFESTS) as Array<[ManifestId, (typeof MANIFESTS)[ManifestId]]>).map(([id, manifest]) => {
                const decision = manifest.requirements.guestNetwork === 'disabled' ? 'PERMIT' : 'BLOCK';
                return (
                  <button key={id} type="button" onClick={() => selectManifest(id)} className={`profile-card ${manifestId === id ? 'profile-card-active' : ''}`}>
                    <span className="flex items-center justify-between gap-3"><strong>{manifest.label}</strong><span className={decision === 'PERMIT' ? 'verdict-pass' : 'verdict-block'}>{decision}</span></span>
                    <span>{manifest.description}</span><code>{id}</code>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-white/10 p-4">
              <div className="mb-2 flex items-center justify-between text-xs"><span className="text-white/45">Included workload</span><span className="mono-tag">digest pinned</span></div>
              <code className="block break-all rounded bg-black/35 p-3 text-[11px] text-[#b8c6bd]">{COMPONENT_ID}</code>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button className="button-secondary" type="button" disabled={busy !== null} onClick={onPlan}>{busy === 'plan' ? 'Compiling…' : 'Compile intent'}</button>
                <button className="button-secondary" type="button" disabled={busy !== null || !permitted} onClick={onHandoff}>{busy === 'handoff' ? 'Binding…' : 'Create handoff'}</button>
                <button className="button-primary col-span-2" type="button" disabled={busy !== null || !handoff || Boolean(receipt)} onClick={onDeploy}>{busy === 'deploy' ? 'Deploying two targets…' : receipt ? 'Deployment complete' : 'Deploy both targets'}</button>
              </div>
              {error && <p className="mt-3 rounded border border-[#ff7b6d]/20 bg-[#ff7b6d]/5 p-2 text-[10px] leading-4 text-[#ff9d91]">{error}</p>}
            </div>
          </section>

          <section className="panel min-w-0">
            <div className="panel-heading"><div><p className="eyebrow">02 / Compile → execute → witness</p><h2>{receipt ? 'Runtime portability witness' : handoff ? 'Verified capsules bound to handoff' : plan?.decision === 'BLOCK' ? 'Empty portability frontier' : 'Portability frontier compiled'}</h2></div><span className={plan?.decision === 'BLOCK' ? 'verdict-block' : 'verdict-pass'}>{receipt ? 'WITNESSED' : plan?.decision === 'PERMIT' ? 'COMPILED' : plan ? 'EMPTY' : 'LOADING'}</span></div>
            <div className="p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <EvidenceCard label="Deployment intent" value={manifestId} />
                <EvidenceCard label="Intent sha256" value={shortDigest(plan?.manifestDigest)} />
                <EvidenceCard label="Compiled program" value={shortDigest(plan?.programDigest)} tone={plan?.decision === 'PERMIT' ? 'green' : undefined} />
                <EvidenceCard label="Handoff" value={handoff ? 'integrity-bound' : permitted ? 'available' : 'refused'} tone={handoff ? 'green' : undefined} />
              </div>

              <div className="my-5 grid gap-3 lg:grid-cols-2">
                {(['browser-wasi', 'sites-edge-wasi'] as TargetId[]).map((targetId) => {
                  const targetPlan = plan?.targets.find((item) => item.targetId === targetId);
                  const targetReceipt = targetReceipts.get(targetId);
                  return (
                    <article key={targetId} className="rounded-lg border border-white/10 bg-black/25 p-4">
                      <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Target passport</p><h3 className="mt-1 font-mono text-xs text-white/85">{targetId}</h3></div><span className={targetReceipt || targetPlan?.status === 'READY' ? 'verdict-pass' : targetPlan?.status === 'BLOCKED' ? 'verdict-block' : 'mono-tag'}>{targetReceipt ? 'EXECUTED' : targetPlan?.status === 'READY' ? 'CAPSULE READY' : targetPlan?.status ?? 'DISCOVERING'}</span></div>
                      <p className="mt-3 text-[11px] leading-5 text-white/48">{targetReceipt?.environment ?? targetPlan?.runtime}</p>
                      <div className="mt-3 border-t border-white/8 pt-3 font-mono text-[9px] leading-5 text-white/38">
                        <p>binding / {targetReceipt?.artifactVerification.binding ?? targetPlan?.artifactBinding}</p>
                        <p>passport / {shortDigest(targetPlan?.passportDigest)}</p>
                        <p>certificate / {shortDigest(targetPlan?.certificate.certificateDigest)}</p>
                        <p>capsule / {shortDigest(targetReceipt?.capsuleDigest ?? targetPlan?.capsule?.capsuleDigest)}</p>
                        <p>runtime hash / {targetReceipt ? (targetReceipt.artifactVerification.runtimeSha256Observed ? 'observed' : 'not exposed') : 'pending'}</p>
                        <p>output / {targetReceipt ? shortDigest(targetReceipt.hostObserved.workloadOutputSha256) : 'pending'}</p>
                        {targetPlan?.counterexamples.map((counterexample) => <p key={counterexample} className="text-[#ff9d91]">counterexample / {counterexample}</p>)}
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className={`rounded-lg border p-4 ${receipt ? 'border-[#9ef7bf]/25 bg-[#9ef7bf]/[0.045]' : 'border-dashed border-white/15 bg-black/15'}`}>
                <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Portability frontier + runtime witness</p><p className="mt-1 text-sm text-white/68">{receipt ? 'Both compiled capsules executed, and both receipts agree over the intent’s declared observation contract.' : plan?.decision === 'BLOCK' ? 'The intent has no compatible registered target. No execution capsule or handoff can be produced.' : `${plan?.portabilityFrontier.length ?? 0} target passports satisfy the finite compile-time proof. Runtime equivalence is withheld until both execute.`}</p></div><span className={receipt ? 'verdict-pass' : plan?.decision === 'BLOCK' ? 'verdict-block' : 'mono-tag'}>{receipt ? '2 / 2 MATCH' : plan ? `${plan.portabilityFrontier.length} / ${plan.targets.length} READY` : 'PENDING'}</span></div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <ComparisonCheck label="proof clauses" pass={plan?.decision === 'PERMIT'} />
                  <ComparisonCheck label="capsules bound" pass={Boolean(handoff)} />
                  <ComparisonCheck label="same output" pass={Boolean(receipt)} />
                  <ComparisonCheck label="actual targets" pass={Boolean(receipt)} />
                </div>
              </div>

              {handoff && <div className="mt-4 grid gap-1 rounded-lg border border-white/10 bg-black/35 p-4 font-mono text-[10px] leading-5 text-white/48"><span>handoff / {handoff.handoffId}</span><span>sha256 / {shortDigest(handoff.handoffDigest)}</span><span>program / {shortDigest(handoff.programDigest)}</span><span>capsules / {handoff.executionCapsules.map((capsule) => `${capsule.targetId}:${shortDigest(capsule.capsuleDigest)}`).join(' · ')}</span><span>expires / {new Date(handoff.expiresAt).toLocaleTimeString()}</span><span className="text-[#ffd37b]">integrity bound / yes · identity authorized / no</span></div>}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <ClaimCard title="Compiled + enforced" text="One closed intent is checked against target passports. Only verified, digest-bound execution capsules enter the five-minute handoff." />
                <ClaimCard title="Actively observed" text={receipt ? 'Two target terminations and byte-identical workload output were observed. Browser module hashes were also observed before compilation.' : 'Reserved for facts emitted by real target executions; no portability claim is made yet.'} />
                <ClaimCard title="Build-pinned edge binding" text="The edge receives static compiled-module imports pinned by CI. The edge receipt does not claim runtime byte hashing because Workers do not expose those module bytes." />
                <ClaimCard title="Independent attestation / not claimed" text="No independent signer or outside attester is part of this demo. Handoff integrity is not caller authentication or third-party attestation." caution />
              </div>

              {receipt && <div className="mt-4 font-mono text-[10px] leading-5 text-white/45"><p>evidence / {receipt.evidenceId}</p><p>receipt sha256 / {shortDigest(receipt.evidenceDigest)}</p><p>invocation / via {receipt.source}</p></div>}
              <details className="mt-4"><summary className="cursor-pointer text-xs text-white/45 hover:text-white/70">View exact intent → capsules → receipt JSON</summary><pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-white/10 bg-[#030504] p-4 text-[10px] leading-5 text-[#9eb0a5]">{exactJson}</pre></details>
            </div>
          </section>

          <section className="panel flex min-h-[620px] flex-col">
            <div className="panel-heading"><div><p className="eyebrow">03 / Agent handoff</p><h2>Deployment activity</h2></div><span className="mono-tag">session local</span></div>
            <div className="border-b border-white/10 p-4 text-xs leading-5 text-white/52">A call is labeled <strong className="text-[#9ef7bf]">via WebMCP</strong> only when a registered tool callback invokes it. Human controls remain labeled <strong className="text-white/75">via human</strong>.</div>
            <ol className="flex-1 divide-y divide-white/8">
              {timeline.length === 0 ? <li className="p-5 text-sm text-white/38">Waiting for WebMCP registration or a deployment action…</li> : timeline.map((item) => (
                <li key={item.id} className="grid grid-cols-[58px_minmax(0,1fr)_auto] gap-3 p-4 text-xs">
                  <time className="font-mono text-white/35">{item.at}</time>
                  <div className="min-w-0"><p className="truncate font-mono text-white/75">{item.operation}</p><p className={item.source === 'WebMCP' ? 'mt-1 text-[#9ef7bf]' : 'mt-1 text-white/38'}>via {item.source}</p>{item.detail && <p className={`mt-1 truncate ${item.state === 'REFUSED' ? 'text-[#ff9d91]' : item.state === 'COMPLETE' ? 'text-[#9ef7bf]/75' : 'text-white/45'}`} title={item.detail}>{item.detail}</p>}</div>
                  <span className={`timeline-state ${item.state === 'REFUSED' ? 'timeline-refused' : item.state === 'STARTED' ? 'timeline-started' : ''}`}>{item.state}</span>
                </li>
              ))}
            </ol>
            <div className="border-t border-white/10 p-4"><p className="eyebrow mb-2">Not exposed</p><p className="font-mono text-[10px] leading-5 text-white/38">upload · shell · native · OCI · worker · daemon · QEMU · arbitrary URL · arbitrary bytes</p></div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div className="bg-[#0c1210] px-3 py-5 text-center"><strong className="block font-mono text-lg text-[#9ef7bf]">{value}</strong><span className="mt-1 block text-[10px] uppercase tracking-[0.12em] text-white/35">{label}</span></div>;
}

function FlowStep({ index, label, state }: { index: string; label: string; state: string }) {
  const active = !['PENDING', 'REFUSED'].includes(state);
  return <div className="flex items-center justify-between gap-3 bg-[#0c1210] px-4 py-3"><div><span className="font-mono text-[9px] text-white/25">{index}</span><p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/55">{label}</p></div><span className={state === 'REFUSED' ? 'verdict-block' : active ? 'verdict-pass' : 'mono-tag'}>{state}</span></div>;
}

function EvidenceCard({ label, value, tone }: { label: string; value: string; tone?: 'green' }) {
  return <div className="rounded-lg border border-white/10 bg-[#0b100e] p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-white/35">{label}</p><p className={`mt-2 break-words font-mono text-xs ${tone === 'green' ? 'text-[#9ef7bf]' : 'text-white/72'}`}>{value}</p></div>;
}

function ComparisonCheck({ label, pass }: { label: string; pass: boolean }) {
  return <div className="rounded border border-white/8 bg-black/20 px-2 py-2 text-center font-mono text-[9px] text-white/48"><span className={pass ? 'text-[#9ef7bf]' : 'text-white/24'}>{pass ? '✓' : '○'}</span> {label}</div>;
}

function ClaimCard({ title, text, caution }: { title: string; text: string; caution?: boolean }) {
  return <div className={`rounded-lg border p-3 ${caution ? 'border-[#ffd37b]/20 bg-[#ffd37b]/[0.045]' : 'border-white/10 bg-white/[0.02]'}`}><p className={`text-xs font-semibold ${caution ? 'text-[#ffd37b]' : 'text-white/80'}`}>{title}</p><p className="mt-1.5 text-[11px] leading-5 text-white/45">{text}</p></div>;
}
