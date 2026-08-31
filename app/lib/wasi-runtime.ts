import { WASIShim } from '@bytecodealliance/preview2-shim/instantiation';
import * as cli from '@bytecodealliance/preview2-shim/cli';
import { instantiate } from './generated/univ-portable-workload.js';
import {
  OUTPUT_LIMIT_BYTES,
  WORKLOAD_ID,
  sha256Bytes,
  type CoreModuleName,
  type RuntimeObservation,
  type WorkloadResult,
} from './deployment-contract';

function makeOutputCapture() {
  const decoder = new TextDecoder();
  let text = '';
  let writtenBytes = 0;
  let capturedBytes = 0;
  let truncated = false;
  return {
    handler: {
      write(contents: Uint8Array) {
        writtenBytes += contents.byteLength;
        const remaining = OUTPUT_LIMIT_BYTES - capturedBytes;
        if (remaining <= 0) {
          truncated = true;
          return;
        }
        const accepted = contents.subarray(0, remaining);
        capturedBytes += accepted.byteLength;
        truncated ||= accepted.byteLength < contents.byteLength;
        text += decoder.decode(accepted, { stream: true });
      },
      blockingFlush() {},
    },
    finish() {
      text += decoder.decode();
      return { text, writtenBytes, capturedBytes, truncated };
    },
  };
}

export async function executePortableWorkload(
  loadCore: (path: CoreModuleName) => Promise<WebAssembly.Module>,
): Promise<{ componentReported: WorkloadResult; hostObserved: RuntimeObservation }> {
  const stdout = makeOutputCapture();
  const stderr = makeOutputCapture();
  cli._setStdout(stdout.handler);
  cli._setStderr(stderr.handler);
  const started = performance.now();
  const shim = new WASIShim({
    sandbox: {
      preopens: {},
      env: {},
      args: ['univ-portable-workload', 'portable-release-v1'],
      enableNetwork: false,
    },
  });
  const component = await instantiate((path: string) => loadCore(path as CoreModuleName), shim.getImportObject());
  component.run.run();
  const durationMs = Math.max(0, Math.round((performance.now() - started) * 10) / 10);
  const captured = stdout.finish();
  const errorOutput = stderr.finish();
  if (errorOutput.text.trim()) throw new Error(`Included workload wrote to stderr: ${errorOutput.text.trim()}`);
  let report: WorkloadResult;
  try {
    report = JSON.parse(captured.text.trim()) as WorkloadResult;
  } catch {
    throw new Error('Included workload returned invalid JSON.');
  }
  if (
    report.schemaVersion !== 'univ.workload-result/v1' ||
    report.manifestId !== 'portable-release-v1' ||
    report.workloadId !== WORKLOAD_ID ||
    report.status !== 'HEALTHY' ||
    !Array.isArray(report.records)
  ) {
    throw new Error('Included workload returned an unexpected result envelope.');
  }
  return {
    componentReported: report,
    hostObserved: {
      termination: 'completed',
      durationMs,
      timingSource: 'performance.now',
      stdoutCapturedBytes: captured.capturedBytes,
      stdoutWrittenBytes: captured.writtenBytes,
      stdoutTruncated: captured.truncated,
      workloadOutputSha256: await sha256Bytes(new TextEncoder().encode(captured.text.trim())),
    },
  };
}
