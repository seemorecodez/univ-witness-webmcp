'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  COMPONENT_ID,
  PROFILES,
  getCapabilities,
  getEvidence,
  planDiagnostic,
  runDiagnostic,
  type DiagnosticPlan,
  type ExecutionReceipt,
  type InvocationSource,
  type ProfileId,
} from './lib/witness';

type Result = DiagnosticPlan | ExecutionReceipt;
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
  'plan_release_diagnostic',
  'run_release_diagnostic',
  'get_execution_evidence',
] as const;

function shortDigest(value: string) {
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}

export default function Home() {
  const [profileId, setProfileId] = useState<ProfileId>('approved-release-v1');
  const [result, setResult] = useState<Result>(() => planDiagnostic('approved-release-v1'));
  const [busy, setBusy] = useState(false);
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
    }, ...items].slice(0, 12));
  }, []);

  const invoke = useCallback(async <T extends Result | ReturnType<typeof getCapabilities>>(
    operation: string,
    source: InvocationSource,
    task: () => T | Promise<T>,
  ): Promise<T> => {
    addTimeline(operation, source, 'STARTED');
    try {
      const value = await task();
      if ('componentId' in value) setResult(value as Result);
      addTimeline(operation, source, 'COMPLETE');
      return value;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unknown failure';
      addTimeline(operation, source, 'REFUSED', message);
      throw caught;
    }
  }, [addTimeline]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) {
      queueMicrotask(() => setWebMcpStatus('unavailable'));
      return;
    }

    const profileSchema = {
      type: 'object',
      additionalProperties: false,
      required: ['profileId'],
      properties: { profileId: { type: 'string', enum: Object.keys(PROFILES) } },
    };
    const tools: WebMcpToolDefinition[] = [
      {
        name: TOOL_NAMES[0],
        description: 'Return the exact WASI-only public boundary, included diagnostics, and evidence-claim categories for UNIV Witness.',
        inputSchema: { type: 'object', additionalProperties: false },
        execute: () => invoke(TOOL_NAMES[0], 'WebMCP', () => getCapabilities()),
      },
      {
        name: TOOL_NAMES[1],
        description: 'Plan one pre-approved release diagnostic without executing it. No arbitrary path, URL, code, image, or arguments are accepted.',
        inputSchema: profileSchema,
        execute: (input) => invoke(TOOL_NAMES[1], 'WebMCP', () => planDiagnostic(input.profileId)),
      },
      {
        name: TOOL_NAMES[2],
        description: 'Run one included digest-pinned WASI release diagnostic and return a reviewable browser-session receipt.',
        inputSchema: profileSchema,
        execute: (input) => invoke(TOOL_NAMES[2], 'WebMCP', () => runDiagnostic(input.profileId, 'WebMCP')),
      },
      {
        name: TOOL_NAMES[3],
        description: 'Retrieve one bounded receipt created in this browser session by its exact evidence ID.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['evidenceId'],
          properties: { evidenceId: { type: 'string', pattern: '^[0-9a-f]{32}$' } },
        },
        execute: (input) => invoke(TOOL_NAMES[3], 'WebMCP', () => getEvidence(input.evidenceId)),
      },
    ];

    Promise.all(tools.map((tool) => Promise.resolve(context.registerTool(tool))))
      .then(() => {
        setWebMcpStatus('ready');
        addTimeline('WebMCP registration', 'page', 'COMPLETE', `${tools.length} tools registered`);
      })
      .catch((caught) => {
        setWebMcpStatus('failed');
        addTimeline('WebMCP registration', 'page', 'REFUSED', caught instanceof Error ? caught.message : 'Registration failed');
      });

    return () => {
      if (context.unregisterTool) {
        for (const name of TOOL_NAMES) void context.unregisterTool(name);
      }
    };
  }, [addTimeline, invoke]);

  const receipt = 'evidenceId' in result ? result : null;
  const plan: DiagnosticPlan | null = 'evidenceId' in result ? null : result;
  const report = receipt?.componentReported;
  const output = useMemo(() => JSON.stringify(result, null, 2), [result]);

  const onPlan = async () => {
    setBusy(true);
    try { await invoke(TOOL_NAMES[1], 'human', () => planDiagnostic(profileId)); }
    finally { setBusy(false); }
  };

  const onRun = async () => {
    setBusy(true);
    try { await invoke(TOOL_NAMES[2], 'human', () => runDiagnostic(profileId, 'human')); }
    finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-[#070b0a] text-[#edf5ed]">
      <header className="border-b border-white/10 bg-[#0a100e]/95">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-5 px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md border border-[#9ef7bf]/40 bg-[#9ef7bf]/10 font-mono text-sm font-black text-[#9ef7bf]">UW</div>
            <div>
              <p className="font-semibold tracking-tight">UNIV Witness</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">WASI release diagnostic console</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`status-pill ${webMcpStatus === 'ready' ? 'status-ready' : webMcpStatus === 'failed' ? 'status-danger' : ''}`}>
              <span className="status-dot" />
              {webMcpStatus === 'ready' ? '4 WebMCP tools ready' : webMcpStatus === 'checking' ? 'Checking WebMCP' : webMcpStatus === 'failed' ? 'WebMCP registration failed' : 'Human fallback mode'}
            </span>
            <a className="hidden text-xs text-white/55 transition hover:text-white sm:block" href="https://github.com/seemorecodez/univ-witness" target="_blank" rel="noreferrer">Public source ↗</a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
        <section className="mb-6 grid gap-5 border-b border-white/10 pb-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="eyebrow">For release + security teams</p>
            <h1 className="mt-2 max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">Pre-approved diagnostics in. Reviewable execution receipts out.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/58">Release and security teams can let browser agents run only pre-approved diagnostics and return reviewable execution receipts without granting arbitrary code execution.</p>
          </div>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10">
            <Metric value="WASI" label="only surface" />
            <Metric value="3/3" label="digests pinned" />
            <Metric value="0" label="uploads / shells" />
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)_390px]">
          <section className="panel">
            <div className="panel-heading">
              <div><p className="eyebrow">01 / Select</p><h2>Included diagnostic profile</h2></div>
              <span className="mono-tag">closed enum</span>
            </div>
            <div className="space-y-3 p-4">
              {(Object.entries(PROFILES) as Array<[ProfileId, (typeof PROFILES)[ProfileId]]>).map(([id, profile]) => (
                <button key={id} type="button" onClick={() => { setProfileId(id); setResult(planDiagnostic(id)); }} className={`profile-card ${profileId === id ? 'profile-card-active' : ''}`}>
                  <span className="flex items-center justify-between gap-3"><strong>{profile.label}</strong><span className={profile.expectedVerdict === 'PASS' ? 'verdict-pass' : 'verdict-block'}>{profile.expectedVerdict}</span></span>
                  <span>{profile.description}</span>
                  <code>{id}</code>
                </button>
              ))}
            </div>
            <div className="border-t border-white/10 p-4">
              <div className="mb-3 flex items-center justify-between text-xs"><span className="text-white/45">Executable component</span><span className="mono-tag">included</span></div>
              <code className="block break-all rounded bg-black/35 p-3 text-[11px] text-[#b8c6bd]">{COMPONENT_ID}</code>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button className="button-secondary" type="button" disabled={busy} onClick={onPlan}>Inspect plan</button>
                <button className="button-primary" type="button" disabled={busy} onClick={onRun}>{busy ? 'Running…' : 'Run WASI'}</button>
              </div>
            </div>
          </section>

          <section className="panel min-w-0">
            <div className="panel-heading">
              <div><p className="eyebrow">02 / Review</p><h2>{receipt ? 'Execution receipt' : 'Pre-execution plan'}</h2></div>
              <span className={report?.verdict === 'BLOCK' ? 'verdict-block' : 'verdict-pass'}>{report?.verdict ?? 'READY'}</span>
            </div>

            <div className="p-4 sm:p-5">
              <div className="mb-5 grid gap-3 sm:grid-cols-3">
                <EvidenceCard label="Enforcement grade" value={result.enforcementGrade} tone="green" />
                <EvidenceCard label="Profile" value={result.profileId} />
                <EvidenceCard label={receipt ? 'Invocation source' : 'Execution'} value={receipt ? `via ${receipt.source}` : 'not started'} tone={receipt?.source === 'WebMCP' ? 'green' : undefined} />
              </div>

              {report ? (
                <div className="mb-5 rounded-lg border border-white/10 bg-black/25 p-4">
                  <div className="mb-3 flex items-start justify-between gap-4"><div><p className="eyebrow">Deterministic component output</p><p className="mt-1 text-sm text-white/65">{report.summary}</p></div><span className={report.verdict === 'PASS' ? 'verdict-pass' : 'verdict-block'}>{report.verdict}</span></div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {report.checks.map((check) => <div key={check.id} className="check-row"><span>{check.observed ? '✓' : '×'}</span><code>{check.id}</code></div>)}
                  </div>
                </div>
              ) : (
                <div className="mb-5 rounded-lg border border-dashed border-white/15 bg-black/20 p-4">
                  <p className="eyebrow">Planned boundaries</p>
                  <ul className="mt-3 space-y-2 text-sm text-white/62">{plan?.configuredBoundaries.map((item) => <li key={item} className="flex gap-2"><span className="text-[#9ef7bf]">→</span><span>{item}</span></li>)}</ul>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <ClaimCard title="Configured + enforced" text="Closed profile allowlist; SHA-256 gate before instantiation; no preopens, environment, or guest network; 4,096-byte capture ceiling." />
                <ClaimCard title="Actively observed" text={receipt ? `${Object.keys(receipt.hostObserved.coreDigests).length} module digests matched; ${receipt.hostObserved.stdoutCapturedBytes} stdout bytes; ${receipt.hostObserved.durationMs} ms.` : 'Populated only after a real run: loaded digests, stdout bytes, termination, and duration.'} />
                <ClaimCard title="Component-reported" text="The included WASI diagnostic reports its checks and verdict. These are distinct from host observations." />
                <ClaimCard title="Independent attestation" text="Not present. No outside signer or remote attester verified this browser-hosted execution." danger />
              </div>

              {receipt && <div className="mt-5 grid gap-2 rounded-lg border border-white/10 bg-black/35 p-4 font-mono text-[11px] text-white/55"><span>evidence / {receipt.evidenceId}</span><span>sha256 / {shortDigest(receipt.evidenceDigest)}</span><span>runtime / {receipt.hostObserved.durationMs} ms · {receipt.hostObserved.stdoutCapturedBytes}/{receipt.configuredAndEnforced.outputCaptureLimitBytes} B captured</span></div>}
              <details className="mt-4"><summary className="cursor-pointer text-xs text-white/45 hover:text-white/70">View exact JSON</summary><pre className="mt-3 max-h-72 overflow-auto rounded-lg border border-white/10 bg-[#030504] p-4 text-[10px] leading-5 text-[#9eb0a5]">{output}</pre></details>
            </div>
          </section>

          <section className="panel flex min-h-[560px] flex-col">
            <div className="panel-heading">
              <div><p className="eyebrow">03 / Prove</p><h2>Agent activity</h2></div>
              <span className="mono-tag">session local</span>
            </div>
            <div className="border-b border-white/10 p-4 text-xs leading-5 text-white/52">An agent call is labeled <strong className="text-[#9ef7bf]">via WebMCP</strong> only when the registered tool callback is invoked. Human buttons remain labeled <strong className="text-white/75">via human</strong>.</div>
            <ol className="flex-1 divide-y divide-white/8">
              {timeline.length === 0 ? <li className="p-5 text-sm text-white/38">Waiting for a page registration or tool call…</li> : timeline.map((item) => (
                <li key={item.id} className="grid grid-cols-[58px_minmax(0,1fr)_auto] gap-3 p-4 text-xs">
                  <time className="font-mono text-white/35">{item.at}</time>
                  <div className="min-w-0"><p className="truncate font-mono text-white/75">{item.operation}</p><p className={item.source === 'WebMCP' ? 'mt-1 text-[#9ef7bf]' : 'mt-1 text-white/38'}>via {item.source}</p>{item.detail && <p className="mt-1 truncate text-[#ff9d91]" title={item.detail}>{item.detail}</p>}</div>
                  <span className={`timeline-state ${item.state === 'REFUSED' ? 'timeline-refused' : item.state === 'STARTED' ? 'timeline-started' : ''}`}>{item.state}</span>
                </li>
              ))}
            </ol>
            <div className="border-t border-white/10 p-4">
              <p className="eyebrow mb-2">Not exposed</p>
              <p className="font-mono text-[10px] leading-5 text-white/38">upload · shell · native · OCI · worker · daemon · QEMU · arbitrary URL · arbitrary bytes</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div className="bg-[#0c1210] px-3 py-5 text-center"><strong className="block font-mono text-lg text-[#9ef7bf]">{value}</strong><span className="mt-1 block text-[10px] uppercase tracking-[0.12em] text-white/35">{label}</span></div>;
}

function EvidenceCard({ label, value, tone }: { label: string; value: string; tone?: 'green' }) {
  return <div className="rounded-lg border border-white/10 bg-[#0b100e] p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-white/35">{label}</p><p className={`mt-2 break-words font-mono text-xs ${tone === 'green' ? 'text-[#9ef7bf]' : 'text-white/72'}`}>{value}</p></div>;
}

function ClaimCard({ title, text, danger }: { title: string; text: string; danger?: boolean }) {
  return <div className={`rounded-lg border p-3 ${danger ? 'border-[#ff7b6d]/20 bg-[#ff7b6d]/5' : 'border-white/10 bg-white/[0.02]'}`}><p className={`text-xs font-semibold ${danger ? 'text-[#ff9d91]' : 'text-white/80'}`}>{title}</p><p className="mt-1.5 text-[11px] leading-5 text-white/45">{text}</p></div>;
}
