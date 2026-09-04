import { getEvidenceDatabase } from '@/db';
import { verifyDeploymentReceipt } from '@/app/lib/deployment-receipt-verifier';

export const runtime = 'edge';

export async function GET(
  _request: Request,
  context: { params: Promise<{ evidenceId: string }> },
) {
  try {
    const { evidenceId } = await context.params;
    if (!/^[0-9a-f-]{36}$/.test(evidenceId))
      return Response.json(
        { error: 'Evidence ID must be a UUID.' },
        { status: 400 },
      );
    const record = await getEvidenceDatabase()
      .prepare(`
      SELECT evidence_digest, payload_json, stored_at
      FROM deployment_evidence
      WHERE evidence_id = ?
    `)
      .bind(evidenceId)
      .first<{
        evidence_digest: string;
        payload_json: string;
        stored_at: string;
      }>();
    if (!record)
      return Response.json(
        { error: 'Durable evidence was not found.' },
        { status: 404, headers: { 'cache-control': 'no-store' } },
      );
    const verified = await verifyDeploymentReceipt(
      JSON.parse(record.payload_json) as unknown,
    );
    if (verified.receipt.evidenceDigest !== record.evidence_digest)
      throw new Error('Stored evidence digest mismatch refused.');
    return Response.json(
      {
        stored: true,
        durable: true,
        storedAt: record.stored_at,
        sharePath: `/?evidence=${encodeURIComponent(evidenceId)}`,
        ...verified,
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Evidence retrieval failed.';
    return Response.json(
      { error: message },
      { status: 400, headers: { 'cache-control': 'no-store' } },
    );
  }
}
