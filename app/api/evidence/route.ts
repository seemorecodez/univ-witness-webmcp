import { getEvidenceDatabase } from '@/db';
import { verifyDeploymentReceipt } from '@/app/lib/deployment-receipt-verifier';

export const runtime = 'edge';

const MAX_EVIDENCE_BYTES = 64 * 1024;

export async function POST(request: Request) {
  try {
    if (
      !request.headers
        .get('content-type')
        ?.toLowerCase()
        .startsWith('application/json')
    )
      return Response.json(
        { error: 'Evidence must use application/json.' },
        { status: 415 },
      );
    const declaredLength = Number(request.headers.get('content-length') ?? '0');
    if (declaredLength > MAX_EVIDENCE_BYTES)
      return Response.json(
        { error: 'Evidence exceeds the 64 KiB storage boundary.' },
        { status: 413 },
      );
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_EVIDENCE_BYTES)
      return Response.json(
        { error: 'Evidence exceeds the 64 KiB storage boundary.' },
        { status: 413 },
      );
    const payload = JSON.parse(body) as unknown;
    const { receipt, verification } = await verifyDeploymentReceipt(payload);
    const storedAt = new Date().toISOString();
    const db = getEvidenceDatabase();
    await db
      .prepare(`
      INSERT OR IGNORE INTO deployment_evidence (
        evidence_id, evidence_digest, manifest_id, program_digest,
        invocation_source, verdict, payload_json, created_at, stored_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        receipt.evidenceId,
        receipt.evidenceDigest,
        receipt.manifestId,
        receipt.programDigest,
        receipt.source,
        'PORTABLE_ACROSS_EXECUTED_TARGETS',
        JSON.stringify(receipt),
        receipt.createdAt,
        storedAt,
      )
      .run();
    const existing = await db
      .prepare(
        'SELECT evidence_digest, stored_at FROM deployment_evidence WHERE evidence_id = ?',
      )
      .bind(receipt.evidenceId)
      .first<{ evidence_digest: string; stored_at: string }>();
    if (!existing || existing.evidence_digest !== receipt.evidenceDigest)
      return Response.json(
        { error: 'Evidence ID collision refused.' },
        { status: 409 },
      );
    return Response.json(
      {
        stored: true,
        durable: true,
        evidenceId: receipt.evidenceId,
        evidenceDigest: receipt.evidenceDigest,
        storedAt: existing.stored_at,
        sharePath: `/?evidence=${encodeURIComponent(receipt.evidenceId)}`,
        verification,
      },
      { status: 201, headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Evidence persistence failed.';
    return Response.json(
      { error: message },
      { status: 400, headers: { 'cache-control': 'no-store' } },
    );
  }
}
