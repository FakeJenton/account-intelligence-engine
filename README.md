# Account Intelligence Engine

CRM health auditor and gap-targeted intelligence brief generator. Audits every account across four health dimensions, synthesizes external signals to fill specific CRM gaps, and generates account readiness packages with confidence-rated intel and first-move drafts.

**Live dashboard:** https://account-intelligence-engine.vercel.app

---

## What it does

Most enrichment tools dump a generic company profile on every account. This system does the opposite: it runs a structured audit to find exactly what is missing, then goes specifically to fill those gaps.

**Phase 1 — Data generation** (`generate_data.py`)
- 200 CRM accounts, 88 fields, deliberately messy
- 200 external intelligence records (news, job postings, inferred champions, competitor signals, G2, funding events)
- ~45% null rate on contact fields, mixed date formats, ~3% duplicate rows

**Phase 2 — CRM Health Auditor** (`health_auditor.py`)
Four scoring dimensions:
- Completeness: field presence weighted by deal stage and ACV
- Freshness: activity cadence vs. expected for stage, zombie deal detection
- Consistency: cross-field contradiction detection (e.g. Commit forecast with zero exec meetings)
- Forecast Reliability: composite score with non-linear penalty for critical contradictions

Results on 200 accounts: avg health 74.7/100, 1,263 gaps identified, 196 contradictions flagged, 32 Commit deals rated unreliable, $8.4M ACV in critical/at-risk accounts.

**Phase 3 — Intelligence Brief Generator** (`brief_generator.py`)
Every brief section anchors to a specific CRM gap, not a generic profile:
- `champion_blank` — surface inferred champions from job postings and LinkedIn signals
- `economic_buyer_blank` — surface likely execs from external signals
- `competitive_blank` — synthesize competitor signals from job posting analysis
- `use_case_vague` — infer from hiring patterns and tech stack signals
- `timing` — funding events, leadership changes, modernization signals

Confidence ratings per section: crm-confirmed / inferred-strong / inferred-weak / unverified.

**Phase 4 — Package Generator** (`package_generator.py`)
Merges Phases 2 and 3 into unified readiness packages and an executive summary. Priority score = (100 - health) x 0.5 + (100 - intel_readiness) x 0.2 + log(ACV/50K) x 6 + funding bonus. Dashboard payload embedded in the React app at build time.

---

## Run the pipeline

```bash
pip install pandas numpy scipy scikit-learn faker requests openpyxl
python generate_data.py
python health_auditor.py
python brief_generator.py
python package_generator.py
```

---

## Run the dashboard locally

```bash
cd dte-app
npm install
npm run dev
```

Tech stack: Vite + React, Recharts, lucide-react. No backend — all data embedded in `src/data/payload.json` at build time. Dark mode via CSS variables.

---

## Design decisions

**Stage-aware completeness:** missing `legal_contact` on Prospecting carries no penalty; the same blank on Negotiation is an important gap. Field weights scale with stage and ACV.

**Gap-targeted enrichment:** Phase 2's gap list is the research brief for Phase 3. It does not produce a generic company profile — it goes specifically to find what is missing per account.

**Confidence transparency:** every synthesized piece gets a confidence tag. Reps see what to trust vs. what to verify.

**Contradiction detection:** fields that should agree are cross-referenced programmatically. Most common finding: Commit forecast with no exec meetings, IC champion on high-ACV deals.

---

Author: Jacob Fenton | jacobsfenton@gmail.com | Pittsburgh, PA
