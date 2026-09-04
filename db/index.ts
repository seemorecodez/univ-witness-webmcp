import { env } from 'cloudflare:workers';

export function getEvidenceDatabase(): D1Database {
  if (!env.DB) {
    throw new Error('Cloudflare D1 binding `DB` is unavailable.');
  }
  return env.DB;
}
