import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const actions = new Set(['snapshot','snapshot-handoff-recovery','snapshot-handoff-signup','snapshot-handoff-contracts','snapshot-handoff-support','assert-fresh','disconnect','reconnect','wait-expiry-tick','revoke-b','disable-document-b','restore-document-b','assert-invoice-pdf-a','assert-invoice-pdf-b','assert-handoff-recovery','assert-handoff-signup','assert-handoff-contracts','assert-handoff-support','disconnect-market','reconnect-market']);
const outcomes = new Set(['started','passed','failed']);
/** Fixed public enums and timestamps only; never log a control body or header. */
export function recordControlObservation(action, outcome, directory = process.env.RUNNER_TEMP) {
 if (!actions.has(action) || !outcomes.has(outcome)) return;
 const path = join(directory, 'mobile-control-observations.json');
 const previous = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];
 const rows = previous.filter(r => actions.has(r?.action) && outcomes.has(r?.outcome)).map(r => ({ action:r.action, outcome:r.outcome, timestamp:Number.isSafeInteger(r.timestamp) && r.timestamp >= 0 ? r.timestamp : 0 }));
 rows.push({ action, outcome, timestamp:Date.now() });
 writeFileSync(path, JSON.stringify(rows), { mode:0o600 });
}
