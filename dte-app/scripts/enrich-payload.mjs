// One-off enrichment: add all_gaps and all_contradictions per account from the
// CSV reports so the React UI can show the full lists, not just top N.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..', '..')

const PAYLOAD_PATH = path.join(REPO_ROOT, 'dte-app', 'src', 'data', 'payload.json')
const GAP_CSV      = path.join(REPO_ROOT, 'outputs', 'gap_report.csv')
const CONTRA_CSV   = path.join(REPO_ROOT, 'outputs', 'contradiction_report.csv')

function parseCSVLine(line) {
  const out = []
  let buf = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { buf += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      out.push(buf); buf = ''
    } else {
      buf += ch
    }
  }
  out.push(buf)
  return out
}

function parseCSV(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/﻿/g, '')
  const lines = text.split(/\r?\n/).filter(l => l.length > 0)
  const headers = parseCSVLine(lines[0])
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const row = {}
    headers.forEach((h, i) => { row[h] = values[i] })
    return row
  })
}

function fixMojibake(s) {
  if (!s) return s
  // CSVs were UTF-8 with em-dash mojibake — strip the common patterns
  return s
    .replace(/â€”/g, '—')
    .replace(/â€“/g, '–')
    .replace(/â€™/g, '’')
    .replace(/â€œ/g, '“')
    .replace(/â€/g, '”')
}

console.log('Loading payload from', PAYLOAD_PATH)
const payload = JSON.parse(fs.readFileSync(PAYLOAD_PATH, 'utf8'))
console.log(`  ${payload.accounts.length} accounts in payload`)

console.log('Parsing gap_report.csv')
const gapRows = parseCSV(GAP_CSV)
console.log(`  ${gapRows.length} gap rows`)

console.log('Parsing contradiction_report.csv')
const contraRows = parseCSV(CONTRA_CSV)
console.log(`  ${contraRows.length} contradiction rows`)

// Group gaps by account_id
const gapsByAccount = new Map()
for (const r of gapRows) {
  const aid = r.account_id
  if (!gapsByAccount.has(aid)) gapsByAccount.set(aid, [])
  gapsByAccount.get(aid).push({
    source:   r.gap_source,
    field:    r.gap_field,
    label:    fixMojibake(r.gap_label),
    severity: r.severity,
    weight:   Number(r.weight) || 0,
    context:  fixMojibake(r.context),
  })
}

// Group contradictions by account_id
const contraByAccount = new Map()
for (const r of contraRows) {
  const aid = r.account_id
  if (!contraByAccount.has(aid)) contraByAccount.set(aid, [])
  contraByAccount.get(aid).push({
    label:    fixMojibake(r.label),
    detail:   fixMojibake(r.detail),
    severity: r.severity,
  })
}

// Enrich
let enrichedAccounts = 0
for (const a of payload.accounts) {
  const aid = a.account_id
  const allGaps = gapsByAccount.get(aid) || []
  const allContras = contraByAccount.get(aid) || []
  if (allGaps.length || allContras.length) enrichedAccounts++
  a.gaps = a.gaps || {}
  a.gaps.all_gaps = allGaps
  a.gaps.all_contradictions = allContras
}

console.log(`Enriched ${enrichedAccounts} / ${payload.accounts.length} accounts`)

fs.writeFileSync(PAYLOAD_PATH, JSON.stringify(payload))
console.log('Wrote', PAYLOAD_PATH)
console.log(`  new size: ${(fs.statSync(PAYLOAD_PATH).size / 1024).toFixed(1)} KB`)
