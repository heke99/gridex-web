import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
const contract = await readFile('lib/ops/contract.ts', 'utf8')
const manifest = JSON.parse(await readFile('supabase/migrations/manifest.json', 'utf8'))
const files = execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(file=>file&&!file.startsWith('quality/')&&!file.startsWith('supabase/.temp/')).sort()
const hash = createHash('sha256')
for (const file of files) { hash.update(file+'\0'); hash.update(await readFile(file)); hash.update('\0') }
const snapshot = {
  baseline_web_sha: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  working_tree_has_changes: Boolean(execFileSync('git',['status','--porcelain','--untracked-files=normal'],{encoding:'utf8'}).trim()),
  source_sha256: hash.digest('hex'),
  api_version: contract.match(/GRIDEX_API_CONTRACT_VERSION = ['"]([^'"]+)['"]/)?.[1],
  migrations_sha256: createHash('sha256').update(JSON.stringify(manifest.migrations)).digest('hex'),
  migration_count: manifest.migration_count,
  expected_database_project: 'ayiuxjlfazkjmmtlvhsl',
}
if (process.argv.includes('--snapshot')) { console.log(JSON.stringify(snapshot,null,2)); process.exit(0) }
const blockers = []
const required = ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','GRIDEX_API_KEY','CRON_SECRET','GRIDEX_SUPPORT_RECEIPT_RESEND_KEY','GRIDEX_SUPPORT_RECEIPT_FROM','GRIDEX_WEBSITE_STATE_SIGNING_SECRET','WEBSITE_RESULT_TOKEN_SECRET','GRIDEX_RELEASE_WEB_SHA','GRIDEX_RELEASE_E2E_EVIDENCE']
for (const name of required) if (!process.env[name]?.trim()) blockers.push(`configuration:${name}`)
if (snapshot.working_tree_has_changes) blockers.push('working_tree_not_committed')
if (process.env.GRIDEX_RELEASE_WEB_SHA && process.env.GRIDEX_RELEASE_WEB_SHA !== snapshot.baseline_web_sha) blockers.push('web_sha_mismatch')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
if (url && url.replace(/\/$/,'') !== 'https://ayiuxjlfazkjmmtlvhsl.supabase.co') blockers.push('database_target_mismatch')
if (!blockers.some(b=>/SUPABASE|database_target/.test(b))) {
  try {
    const db = createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(8000)})}})
    const {data,error} = await db.rpc('gridex_web_customer_readiness_v1')
    if (error || !data || data.schema_revision !== '2026-10-07-web-customer-1') blockers.push('database_readiness_unavailable')
    else if (!data.ready) blockers.push(...data.missing.map(value=>`database:${value}`))
  } catch { blockers.push('database_readiness_unavailable') }
}
// Evidence must be captured from the release target. A boolean environment flag is insufficient.
if (process.env.GRIDEX_RELEASE_E2E_EVIDENCE) {
  try {
    const evidence=JSON.parse(await readFile(process.env.GRIDEX_RELEASE_E2E_EVIDENCE,'utf8'))
    if (evidence.web_sha !== snapshot.baseline_web_sha || evidence.api_version !== snapshot.api_version || evidence.database_project !== snapshot.expected_database_project || evidence.migrations_sha256 !== snapshot.migrations_sha256) blockers.push('evidence_revision_mismatch')
    for(const name of ['customer_isolation','web_checkout','public_support','auth_smtp','verification_email_delivered','reset_email_delivered','leaked_password_policy','support_receipt_delivered']) if(evidence.checks?.[name]!==true) blockers.push(`evidence:${name}`)
  } catch { blockers.push('evidence_unreadable') }
}
console.log(JSON.stringify({...snapshot,ready:!blockers.length,blockers},null,2))
if (blockers.length) process.exitCode=1
