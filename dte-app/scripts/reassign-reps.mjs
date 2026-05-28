// Reassign accounts to a realistic rep book (22 reps, weighted distribution).
// In a real CRM each rep owns many accounts; 40 reps for 200 accounts implied
// a 5:1 ratio which is unrealistic. Target: 22 reps, ~9 accounts each, weighted
// so a few senior reps carry larger books.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PAYLOAD_PATH = path.resolve(__dirname, '..', 'src', 'data', 'payload.json')

// Deterministic PRNG so the script produces the same assignment every run.
function seededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}
const rand = seededRandom(42)

const payload = JSON.parse(fs.readFileSync(PAYLOAD_PATH, 'utf8'))
const allReps = [...new Set(payload.accounts.map(a => a.rep_name))]
// Filter out placeholders or invalid names
const currentReps = allReps.filter(r => r && r !== 'Unknown' && r.trim().length > 0 && /[A-Za-z]/.test(r))
console.log(`Before: ${allReps.length} reps (${currentReps.length} valid) across ${payload.accounts.length} accounts`)

// Shuffle deterministically, take first 22
const selectedReps = [...currentReps]
  .map(r => ({ rep: r, ord: rand() }))
  .sort((a, b) => a.ord - b.ord)
  .map(o => o.rep)
  .slice(0, 22)

// Weight tiers: 3 senior reps (1.5x), 12 middle reps (1.0x), 7 junior reps (0.55x)
// Math: 3*1.5 + 12*1.0 + 7*0.55 = 20.35 weight total
// Expected accounts: senior ~15, middle ~10, junior ~5.5
const repWeights = selectedReps.map((rep, i) => {
  if (i < 3) return { rep, weight: 1.5 }
  if (i < 15) return { rep, weight: 1.0 }
  return { rep, weight: 0.55 }
})
const totalWeight = repWeights.reduce((s, r) => s + r.weight, 0)

function pickRep() {
  const r = rand() * totalWeight
  let acc = 0
  for (const { rep, weight } of repWeights) {
    acc += weight
    if (r < acc) return rep
  }
  return repWeights[repWeights.length - 1].rep
}

for (const account of payload.accounts) {
  account.rep_name = pickRep()
}

// Recompute rep aggregates
const byRep = {}
for (const a of payload.accounts) {
  if (!byRep[a.rep_name]) byRep[a.rep_name] = []
  byRep[a.rep_name].push(a)
}

const repScorecard = []
const accountsByRep = {}

for (const [repName, accts] of Object.entries(byRep)) {
  const atRiskAccts = accts.filter(a => a.health.label === 'critical' || a.health.label === 'at-risk')
  const totalAcv   = accts.reduce((s, a) => s + (a.acv_usd || 0), 0)
  const acvAtRisk  = atRiskAccts.reduce((s, a) => s + (a.acv_usd || 0), 0)
  const avgHealth  = Math.round(accts.reduce((s, a) => s + a.health.overall_score, 0) / accts.length)

  // Dominant gap = most common top_gap among this rep's accounts
  const gapCounts = {}
  for (const a of accts) {
    const tg = (a.health.top_gap || 'unknown').toLowerCase().replace(/\s+/g, '_')
    gapCounts[tg] = (gapCounts[tg] || 0) + 1
  }
  const dominant = Object.entries(gapCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none'

  repScorecard.push({
    rep_name: repName,
    total_accounts: accts.length,
    at_risk_count: atRiskAccts.length,
    total_acv: totalAcv,
    avg_health_score: avgHealth,
    dominant_gap: dominant,
  })
  accountsByRep[repName] = { acv_at_risk: acvAtRisk }
}

// Sort by ACV at risk descending (matches "by at-risk exposure" title)
repScorecard.sort((a, b) =>
  accountsByRep[b.rep_name].acv_at_risk - accountsByRep[a.rep_name].acv_at_risk
)

payload.executive_summary.rep_scorecard = repScorecard
payload.executive_summary.accounts_by_rep = accountsByRep

console.log('\nNew distribution (sorted by account count):')
const sortedByCount = Object.entries(byRep).sort((a, b) => b[1].length - a[1].length)
for (const [rep, accts] of sortedByCount) {
  console.log(`  ${rep.padEnd(28)} ${String(accts.length).padStart(3)} accounts  $${(accts.reduce((s, a) => s + (a.acv_usd || 0), 0) / 1000).toFixed(0)}K`)
}

fs.writeFileSync(PAYLOAD_PATH, JSON.stringify(payload))
console.log(`\nWrote ${PAYLOAD_PATH}`)
console.log(`Size: ${(fs.statSync(PAYLOAD_PATH).size / 1024).toFixed(1)} KB`)
console.log(`Final: ${selectedReps.length} reps, ${payload.accounts.length} accounts`)
