"""
Account Intelligence Engine — Phase 3: Intelligence Brief Generator
====================================================================
Takes each account's gap list from Phase 2 and synthesizes a gap-targeted
intelligence brief using external signals from Phase 1.

Rather than generating a generic company overview, every section of the brief
is anchored to a specific CRM gap — so if the champion is blank, we surface
inferred champion candidates; if the competitive field is empty, we synthesize
competitor signals from job postings; if the use case is vague, we infer it
from the company's hiring patterns and tech stack.

Each piece of information gets a confidence rating:
  - crm-confirmed:   in the CRM and recently updated
  - inferred-strong: derived from 2+ agreeing external signals
  - inferred-weak:   single or indirect external signal
  - unverified:      synthesized from industry/segment patterns

Outputs
-------
  briefs/ACC-XXXX.json        — structured brief per account (all accounts)
  briefs/ACC-XXXX.md          — markdown card per account (top 30 by priority)
  account_readiness.csv       — one row per account, key brief fields flattened
  briefing_queue.json         — priority-sorted list for dashboard consumption
"""

import json
import re
import requests
import numpy as np
import pandas as pd
from datetime import datetime
from pathlib import Path

HEALTH_PATH  = Path("/home/claude/account-intelligence-engine/outputs/health_scores.csv")
GAP_PATH     = Path("/home/claude/account-intelligence-engine/outputs/gap_report.csv")
EXT_PATH     = Path("/home/claude/account-intelligence-engine/external_intelligence.csv")
CRM_PATH     = Path("/home/claude/account-intelligence-engine/crm_accounts.csv")
OUTPUT_DIR   = Path("/home/claude/account-intelligence-engine/outputs")
BRIEFS_DIR   = OUTPUT_DIR / "briefs"
BRIEFS_DIR.mkdir(parents=True, exist_ok=True)

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"


def safe_int(val, default=0):
    try:
        v = float(val)
        return default if (v != v) else int(v)  # NaN check: NaN != NaN
    except (TypeError, ValueError):
        return default

CONFIDENCE_ORDER = {"crm-confirmed": 0, "inferred-strong": 1, "inferred-weak": 2, "unverified": 3}
CONFIDENCE_LABELS = {
    "crm-confirmed":   "✓ CRM confirmed",
    "inferred-strong": "~ Strong signal",
    "inferred-weak":   "~ Weak signal",
    "unverified":      "? Unverified",
}


# ─────────────────────────────────────────────────────────────────────────────
# 1. LOAD ALL PHASE INPUTS
# ─────────────────────────────────────────────────────────────────────────────

def load_inputs():
    health_df = pd.read_csv(HEALTH_PATH, low_memory=False)
    gap_df    = pd.read_csv(GAP_PATH,    low_memory=False)
    ext_df    = pd.read_csv(EXT_PATH,    low_memory=False)
    crm_df    = pd.read_csv(CRM_PATH,    low_memory=False)

    # Drop dupes from CRM
    crm_df = crm_df[~crm_df["account_id"].astype(str).str.endswith("-DUP", na=False)].copy()

    # Parse JSON columns in external intel
    json_cols = ["news_items", "job_postings", "inferred_tech_stack",
                 "likely_champions", "likely_execs", "competitor_signals",
                 "use_case_inference", "g2_signals", "funding_event", "gaps_addressed"]
    for col in json_cols:
        if col in ext_df.columns:
            ext_df[col] = ext_df[col].apply(
                lambda x: json.loads(x) if isinstance(x, str) and x.strip() not in ("", "nan") else ([] if col in ["gaps_addressed","likely_champions","likely_execs","competitor_signals","news_items","job_postings"] else None)
            )

    print(f"[load] {len(health_df)} health scores, {len(gap_df)} gap rows, "
          f"{len(ext_df)} external intel records, {len(crm_df)} CRM accounts")
    return health_df, gap_df, ext_df, crm_df


# ─────────────────────────────────────────────────────────────────────────────
# 2. GAP-TARGETED SECTION BUILDERS
# Each function handles one gap type and returns a structured brief section.
# ─────────────────────────────────────────────────────────────────────────────

def build_champion_section(crm_row: dict, ext_row: dict, has_gap: bool) -> dict:
    """Champion intelligence — fills champion_blank or enriches existing champion."""
    section = {"title": "Champion Intelligence", "gap_addressed": has_gap}

    # What we know from CRM
    crm_data = {}
    if crm_row.get("champion_name") and str(crm_row["champion_name"]).strip() not in ("", "nan"):
        crm_data["name"]      = crm_row["champion_name"]
        crm_data["title"]     = crm_row.get("champion_title", "Unknown")
        crm_data["seniority"] = crm_row.get("champion_seniority", "Unknown")
        crm_data["tenure"]    = crm_row.get("champion_tenure_yrs")
        crm_data["linkedin"]  = crm_row.get("champion_linkedin")
        section["crm_champion"]   = crm_data
        section["crm_confidence"] = "crm-confirmed"
    else:
        section["crm_champion"]   = None
        section["crm_confidence"] = None

    # What we can infer externally
    candidates = ext_row.get("likely_champions") or []
    if candidates:
        section["inferred_candidates"] = candidates[:3]
        section["inference_confidence"] = candidates[0].get("confidence", "inferred-weak")
        if has_gap:
            section["recommendation"] = (
                f"Champion not logged. {len(candidates)} candidate(s) identified from "
                f"external signals. Top candidate: {candidates[0].get('inferred_name')} "
                f"({candidates[0].get('title')}) via {candidates[0].get('signal_source')}. "
                f"Verify on next call and log in CRM."
            )
    else:
        section["inferred_candidates"] = []
        section["inference_confidence"] = "unverified"
        if has_gap:
            section["recommendation"] = (
                "Champion not logged and no external signals found. "
                "Prioritize identifying and logging the technical champion before next outreach."
            )

    section["overall_confidence"] = (
        "crm-confirmed" if crm_data else
        (candidates[0].get("confidence", "unverified") if candidates else "unverified")
    )
    return section


def build_economic_buyer_section(crm_row: dict, ext_row: dict, has_gap: bool) -> dict:
    """Economic buyer / exec engagement — fills economic_buyer_blank or exec_not_engaged."""
    section = {"title": "Economic Buyer & Exec Engagement", "gap_addressed": has_gap}

    crm_eb = {}
    if crm_row.get("economic_buyer_name") and str(crm_row["economic_buyer_name"]).strip() not in ("", "nan"):
        crm_eb["name"]     = crm_row["economic_buyer_name"]
        crm_eb["title"]    = crm_row.get("economic_buyer_title", "Unknown")
        crm_eb["meetings"] = safe_int(crm_row.get("economic_buyer_meetings"))
        section["crm_economic_buyer"]  = crm_eb
        section["crm_confidence"]      = "crm-confirmed"
    else:
        section["crm_economic_buyer"]  = None
        section["crm_confidence"]      = None

    # Exec sponsor status
    exec_engaged = str(crm_row.get("exec_sponsor_engaged", "")).strip().lower() == "true"
    section["exec_sponsor_engaged"]   = exec_engaged
    section["economic_buyer_meetings"]= safe_int(crm_row.get("economic_buyer_meetings"))

    # External inference
    execs = ext_row.get("likely_execs") or []
    if execs:
        section["inferred_execs"]      = execs[:3]
        section["inference_confidence"]= execs[0].get("confidence", "inferred-weak")
    else:
        section["inferred_execs"]      = []
        section["inference_confidence"]= "unverified"

    acv = float(crm_row.get("acv_usd") or 0)
    stage = crm_row.get("current_stage", "")
    if has_gap:
        if execs:
            section["recommendation"] = (
                f"No economic buyer logged on a ${acv:,.0f} deal at {stage}. "
                f"Likely budget owner: {execs[0].get('inferred_name')} ({execs[0].get('title')}) "
                f"— {execs[0].get('signal_source')}. "
                f"Ask the champion: 'Who else needs to say yes for this to move forward?'"
            )
        else:
            section["recommendation"] = (
                f"No economic buyer identified. ${acv:,.0f} deal at {stage} cannot close "
                f"without budget authority engaged. Identifying the approver is the single "
                f"highest-leverage action on this account."
            )

    section["overall_confidence"] = (
        "crm-confirmed" if crm_eb else
        (execs[0].get("confidence", "unverified") if execs else "unverified")
    )
    return section


def build_competitive_section(crm_row: dict, ext_row: dict, has_gap: bool) -> dict:
    """Competitive landscape — fills competitive_blank or enriches thin competitive data."""
    section = {"title": "Competitive Landscape", "gap_addressed": has_gap}

    # CRM competitive data
    crm_comp = {}
    comp_primary = crm_row.get("competitor_primary")
    if comp_primary and str(comp_primary).strip() not in ("", "nan", "None / Greenfield"):
        crm_comp["primary"]    = comp_primary
        crm_comp["secondary"]  = crm_row.get("competitor_secondary")
        crm_comp["notes"]      = crm_row.get("competitive_notes")
        crm_comp["mentions"]   = int(crm_row.get("competitive_mentions_count") or 0)
        crm_comp["pricing_obj"]= crm_row.get("pricing_objection_raised")
        section["crm_competitive"] = crm_comp
        section["crm_confidence"]  = "crm-confirmed"
    else:
        section["crm_competitive"] = None
        section["crm_confidence"]  = None

    # External competitive signals
    comp_signals = ext_row.get("competitor_signals") or []
    if comp_signals:
        section["inferred_competitors"] = comp_signals[:3]
        section["inference_confidence"] = comp_signals[0].get("confidence", "inferred-weak")
    else:
        section["inferred_competitors"] = []
        section["inference_confidence"] = "unverified"

    pricing_pressure = str(crm_row.get("pricing_objection_raised", "")).strip().lower() == "true"
    section["pricing_pressure_detected"] = pricing_pressure

    if has_gap or (pricing_pressure and not crm_comp):
        if comp_signals:
            top = comp_signals[0]
            section["recommendation"] = (
                f"Competitive field blank{' despite pricing objection logged' if pricing_pressure else ''}. "
                f"External signal: {top.get('detail')} "
                f"({top.get('confidence')}). "
                f"Ask directly on next call: 'What other solutions are you evaluating?'"
            )
        else:
            section["recommendation"] = (
                f"No competitor logged{' despite pricing pressure' if pricing_pressure else ''}. "
                f"Pricing objections without a named competitor create a positioning blind spot. "
                f"Qualify the competitive situation before the next proposal discussion."
            )

    section["overall_confidence"] = (
        "crm-confirmed" if crm_comp else
        (comp_signals[0].get("confidence", "unverified") if comp_signals else "unverified")
    )
    return section


def build_use_case_section(crm_row: dict, ext_row: dict, has_gap: bool) -> dict:
    """Use case and pain point — fills use_case_vague or enriches thin qualification."""
    section = {"title": "Use Case & Pain Point", "gap_addressed": has_gap}

    # CRM data
    use_case    = crm_row.get("use_case")
    pain_point  = crm_row.get("pain_point_stated")
    use_case_blank = not use_case or str(use_case).strip().lower() in ("", "nan", "tbd", "none", "general data modernization")
    pain_blank  = not pain_point or str(pain_point).strip().lower() in ("", "nan")

    if not use_case_blank:
        section["crm_use_case"]    = use_case
        section["crm_pain_point"]  = pain_point
        section["crm_confidence"]  = "crm-confirmed"
    else:
        section["crm_use_case"]    = None
        section["crm_pain_point"]  = None
        section["crm_confidence"]  = None

    # External inference
    inference = ext_row.get("use_case_inference")
    inferred_stack = ext_row.get("inferred_tech_stack") or []
    job_postings   = ext_row.get("job_postings") or []

    if inference and isinstance(inference, dict):
        section["inferred_use_case"]   = inference.get("inferred_use_case")
        section["inference_confidence"]= inference.get("confidence", "inferred-weak")
        section["inference_sources"]   = inference.get("signal_sources", [])
    else:
        section["inferred_use_case"]   = None
        section["inference_confidence"]= "unverified"
        section["inference_sources"]   = []

    # Inferred tech stack
    section["inferred_tech_stack"] = inferred_stack
    section["tech_stack_confidence"] = ext_row.get("tech_stack_confidence", "unverified")

    # Top job postings as use case signals
    data_jobs = [j for j in job_postings if any(
        kw in j.get("title","").lower() for kw in ["data","analytics","engineer","ml","platform"]
    )][:3]
    section["relevant_job_postings"] = data_jobs

    if has_gap or use_case_blank:
        inferred = section.get("inferred_use_case")
        if inferred:
            section["recommendation"] = (
                f"Use case is vague or blank. Based on their hiring patterns and tech stack, "
                f"the most likely initiative is: '{inferred}'. "
                f"Lead with this hypothesis on the next call: "
                f"'We're seeing a lot of {crm_row.get('industry','similar')} companies working on [X] — "
                f"is that close to what you're solving?'"
            )
        else:
            section["recommendation"] = (
                "Use case not defined. Cannot personalize messaging, map case studies, "
                "or build a relevant business case without this. Make use case qualification "
                "the explicit goal of the next call."
            )

    section["overall_confidence"] = (
        "crm-confirmed" if not use_case_blank else
        (section["inference_confidence"] if section.get("inferred_use_case") else "unverified")
    )
    return section


def build_timing_section(crm_row: dict, ext_row: dict) -> dict:
    """Timing and trigger signals — funding, leadership changes, recent news."""
    section = {"title": "Timing & Trigger Signals"}

    # Funding event
    funding = ext_row.get("funding_event")
    if funding and isinstance(funding, dict):
        section["funding_event"]      = funding
        section["funding_confidence"] = "inferred-strong"
    else:
        section["funding_event"]      = None
        section["funding_confidence"] = None

    # Recent news
    news = ext_row.get("news_items") or []
    if news:
        section["recent_news"]    = news[:2]
        section["news_confidence"]= "inferred-strong"
    else:
        section["recent_news"]    = []
        section["news_confidence"]= None

    # Leadership change signal from news
    all_headlines = " ".join(n.get("headline","") for n in news).lower()
    section["leadership_change_detected"] = any(
        kw in all_headlines for kw in ["appoints", "new cto", "new cdo", "chief data", "joins as"]
    )
    section["funding_detected"] = bool(funding)

    # Urgency signal
    urgency_signals = []
    if funding:
        urgency_signals.append(f"Post-{funding.get('type','')} — infrastructure scaling pressure typical within 12–18 months")
    if section["leadership_change_detected"]:
        urgency_signals.append("New technology leadership — elevated openness to new vendor relationships")
    if any("migration" in n.get("headline","").lower() or "moderniz" in n.get("headline","").lower() for n in news):
        urgency_signals.append("Active modernization initiative detected in press — deal timing window is open")

    section["urgency_signals"]     = urgency_signals
    section["overall_confidence"]  = "inferred-strong" if urgency_signals else "unverified"
    return section


def build_pre_call_angle(crm_row: dict, ext_row: dict,
                          champion_section: dict, comp_section: dict,
                          use_case_section: dict, timing_section: dict) -> dict:
    """
    Synthesizes all sections into a specific, actionable pre-call angle.
    Prioritizes the most confident signal available.
    """
    angles = []
    confidence_pool = []

    # Timing trigger is the highest-quality opener when present
    for signal in timing_section.get("urgency_signals", []):
        angles.append({"angle": signal, "source": "timing_trigger", "confidence": "inferred-strong"})
        confidence_pool.append("inferred-strong")

    # Use case match
    inferred_use = use_case_section.get("inferred_use_case") or use_case_section.get("crm_use_case")
    if inferred_use:
        angles.append({
            "angle":      f"Lead with: '{inferred_use}' — frame around the specific outcome, not the product",
            "source":     "use_case_inference",
            "confidence": use_case_section.get("overall_confidence", "unverified"),
        })
        confidence_pool.append(use_case_section.get("overall_confidence", "unverified"))

    # Competitive angle
    comps = comp_section.get("inferred_competitors") or []
    if comp_section.get("crm_competitive"):
        primary = comp_section["crm_competitive"].get("primary", "the incumbent")
        angles.append({
            "angle":      f"Come prepared with differentiation against {primary} — pricing pressure already detected",
            "source":     "competitive_intel",
            "confidence": "crm-confirmed",
        })
        confidence_pool.append("crm-confirmed")
    elif comps:
        angles.append({
            "angle":      f"Likely evaluating {comps[0].get('competitor')} — prepare the differentiation story before the call",
            "source":     "competitive_inference",
            "confidence": comps[0].get("confidence", "inferred-weak"),
        })
        confidence_pool.append(comps[0].get("confidence", "inferred-weak"))

    # Exec vacuum angle
    if not crm_row.get("exec_sponsor_engaged") or str(crm_row.get("exec_sponsor_engaged","")).lower() == "false":
        acv = float(crm_row.get("acv_usd") or 0)
        if acv > 100000:
            angles.append({
                "angle":      "Ask the champion: 'Who else needs to say yes for this to happen?' — exec access is the critical path",
                "source":     "exec_gap",
                "confidence": "crm-confirmed",
            })
            confidence_pool.append("crm-confirmed")

    # Fallback from external pre-call angle
    if not angles:
        ext_angle = ext_row.get("pre_call_angle")
        if ext_angle and str(ext_angle).strip() not in ("", "nan"):
            angles.append({
                "angle":      ext_angle,
                "source":     "external_synthesis",
                "confidence": ext_row.get("pre_call_confidence", "unverified"),
            })
            confidence_pool.append(ext_row.get("pre_call_confidence", "unverified"))

    # Pick best angle — highest confidence first
    angles.sort(key=lambda x: CONFIDENCE_ORDER.get(x["confidence"], 3))
    top_angle = angles[0] if angles else {
        "angle": "Conduct discovery — no strong external signals available to personalize outreach",
        "source": "default", "confidence": "unverified"
    }

    # What NOT to do
    dont = _what_not_to_do(crm_row, comp_section, timing_section)

    return {
        "top_angle":      top_angle,
        "all_angles":     angles[:3],
        "what_not_to_do": dont,
        "overall_confidence": confidence_pool[0] if confidence_pool else "unverified",
    }


def _what_not_to_do(crm_row, comp_section, timing_section) -> str:
    """The most common mistake for this specific account profile."""
    pricing_pressure = str(crm_row.get("pricing_objection_raised","")).lower() == "true"
    has_funding      = timing_section.get("funding_detected")
    acv              = float(crm_row.get("acv_usd") or 0)
    stage            = crm_row.get("current_stage","")

    if pricing_pressure and comp_section.get("crm_competitive"):
        return "Don't discount under competitive pressure — recovered deals in this pattern competed on depth, not price. Lead with the technical differentiation story first."
    if has_funding:
        return "Don't open with features or pricing. They just raised — budget is not the constraint. Open with scale, reliability, and time-to-value."
    if acv > 200000 and str(crm_row.get("exec_sponsor_engaged","")).lower() == "false":
        return "Don't let the champion be your only thread. A deal this size requires exec visibility. Spending more time with the champion without unlocking exec access is activity, not progress."
    if stage in ("Proposal Sent", "Negotiation"):
        return "Don't renegotiate the deal scope at this stage. Focus on removing blockers and defining the final close steps — reopening the conversation invites delay."
    return "Don't lead with a product overview. They've already been through discovery. Recap the agreed problem, confirm the solution fit, and move toward a decision."


# ─────────────────────────────────────────────────────────────────────────────
# 3. ASSEMBLE FULL BRIEF PER ACCOUNT
# ─────────────────────────────────────────────────────────────────────────────

def build_account_brief(health_row: dict, crm_row: dict,
                         ext_row: dict, account_gaps: list) -> dict:
    """
    Assembles the full intelligence brief for one account.
    Gap list drives which sections are gap-targeted vs. enrichment-only.
    """
    gap_fields = set(g.get("gap_field","") for g in account_gaps)

    champion_has_gap  = "champion_name" in gap_fields or "champion_title" in gap_fields
    econ_has_gap      = "economic_buyer_name" in gap_fields or "exec_sponsor_engaged" in gap_fields
    comp_has_gap      = "competitive_notes" in gap_fields or "competitor_primary" in gap_fields
    use_case_has_gap  = "use_case" in gap_fields or "pain_point_stated" in gap_fields

    # Build each section
    champion  = build_champion_section(crm_row, ext_row, champion_has_gap)
    econ      = build_economic_buyer_section(crm_row, ext_row, econ_has_gap)
    comp      = build_competitive_section(crm_row, ext_row, comp_has_gap)
    use_case  = build_use_case_section(crm_row, ext_row, use_case_has_gap)
    timing    = build_timing_section(crm_row, ext_row)
    pre_call  = build_pre_call_angle(crm_row, ext_row, champion, comp, use_case, timing)

    # Compute brief-level readiness score
    # Higher = more complete intelligence, fewer gaps, higher confidence
    section_confidences = [
        CONFIDENCE_ORDER.get(champion.get("overall_confidence","unverified"), 3),
        CONFIDENCE_ORDER.get(econ.get("overall_confidence","unverified"), 3),
        CONFIDENCE_ORDER.get(comp.get("overall_confidence","unverified"), 3),
        CONFIDENCE_ORDER.get(use_case.get("overall_confidence","unverified"), 3),
    ]
    avg_conf = sum(section_confidences) / len(section_confidences)
    # 0 = all confirmed, 3 = all unverified; invert and scale to 0-100
    intelligence_readiness = round((1 - avg_conf / 3) * 100)

    # Active gaps still requiring human verification
    open_gaps = [g for g in account_gaps if g.get("severity") in ("critical","important")]
    filled_gaps = [g for g in account_gaps if g.get("gap_field","") in
                   (ext_row.get("gaps_addressed") or [])]

    return {
        "account_id":             health_row.get("account_id"),
        "company_name":           health_row.get("company_name"),
        "rep_name":               health_row.get("rep_name"),
        "segment":                health_row.get("segment"),
        "industry":               crm_row.get("industry"),
        "current_stage":          health_row.get("current_stage"),
        "acv_usd":                float(health_row.get("acv_usd") or 0),
        "health_score":           health_row.get("health_score"),
        "health_label":           health_row.get("health_label"),
        "forecast_category":      health_row.get("forecast_category"),
        "intelligence_readiness": intelligence_readiness,

        "gap_summary": {
            "total_gaps":       len(account_gaps),
            "critical_gaps":    sum(1 for g in account_gaps if g.get("severity") == "critical"),
            "open_gaps":        len(open_gaps),
            "filled_by_intel":  len(filled_gaps),
            "gap_types":        list(gap_fields),
        },

        "sections": {
            "champion":       champion,
            "economic_buyer": econ,
            "competitive":    comp,
            "use_case":       use_case,
            "timing":         timing,
        },

        "pre_call_angle":   pre_call,
        "generated_at":     datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. LLM-ENHANCED FIRST MOVE DRAFT
# ─────────────────────────────────────────────────────────────────────────────

def generate_first_move(brief: dict) -> str:
    """
    Call Claude to write a rep-specific first-move draft grounded in the brief.
    Falls back to a structured template if API is unavailable.
    """
    acv         = brief["acv_usd"]
    company     = brief["company_name"]
    rep         = (str(brief["rep_name"] or "")).split()[0] if brief.get("rep_name") and str(brief.get("rep_name","")) not in ("","nan") else "Rep"
    stage       = brief["current_stage"]
    segment     = brief["segment"]
    industry    = brief.get("industry","")
    top_angle   = brief["pre_call_angle"]["top_angle"]
    dont        = brief["pre_call_angle"]["what_not_to_do"]
    health      = brief["health_score"]
    gaps        = brief["gap_summary"]["critical_gaps"]

    # Extract key synthesis points
    timing_signals = brief["sections"]["timing"].get("urgency_signals", [])
    inferred_uc    = brief["sections"]["use_case"].get("inferred_use_case") or \
                     brief["sections"]["use_case"].get("crm_use_case","")
    comp_primary   = (brief["sections"]["competitive"].get("crm_competitive") or {}).get("primary") or \
                     (((brief["sections"]["competitive"].get("inferred_competitors") or [{}])[0]).get("competitor",""))

    prompt = f"""You are a senior sales coach writing a specific pre-call brief for a rep. 
Be direct and tactical. No fluff. Speak to the rep by first name.

DEAL CONTEXT:
- Rep: {rep}
- Company: {company} ({industry}, {segment})
- Stage: {stage} | ACV: ${acv:,.0f}
- Health score: {health}/100 | Critical gaps: {gaps}
- Top angle: {top_angle.get('angle','')}
- Timing signals: {timing_signals}
- Inferred use case: {inferred_uc}
- Competitor: {comp_primary or 'unknown'}
- What NOT to do: {dont}

Write a pre-call brief in exactly this format:

**Situation in one sentence:** [what's true about this deal right now]

**Your opening:** [a specific first sentence or subject line for the next outreach — not generic]

**The ask on this call:** [one specific thing to accomplish — not a list]

**Watch out for:** [one specific risk or trap for this account]

Keep it under 120 words total. Be specific. Use the deal context."""

    try:
        resp = requests.post(
            ANTHROPIC_API_URL,
            headers={"Content-Type": "application/json"},
            json={
                "model":      "claude-sonnet-4-20250514",
                "max_tokens": 250,
                "messages":   [{"role": "user", "content": prompt}],
            },
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()["content"][0]["text"].strip()
    except Exception:
        return _template_first_move(rep, company, stage, top_angle, dont, acv, inferred_uc, comp_primary)


def _template_first_move(rep, company, stage, top_angle, dont, acv, inferred_uc, comp_primary) -> str:
    angle_text = top_angle.get("angle", "Lead with value, not features.")
    uc = inferred_uc or "their data infrastructure challenge"
    comp_note  = f"Come prepared on {comp_primary}." if comp_primary else "Qualify the competitive situation."
    return (
        f"**{rep} — pre-call brief for {company}**\n\n"
        f"**Situation:** {stage} deal at ${acv:,.0f}. "
        f"Key angle: {angle_text}\n\n"
        f"**Opening:** 'Last time we spoke about {uc} — I want to check if that's still the priority "
        f"or if something has shifted.'\n\n"
        f"**The ask:** Get confirmation on the next milestone and who else needs to be in the room.\n\n"
        f"**Watch out for:** {dont}\n\n"
        f"{comp_note}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# 5. MARKDOWN CARD BUILDER
# ─────────────────────────────────────────────────────────────────────────────

def build_markdown_card(brief: dict, first_move: str) -> str:
    s         = brief["sections"]
    pre       = brief["pre_call_angle"]
    acv       = brief["acv_usd"]
    health    = brief["health_score"]
    readiness = brief["intelligence_readiness"]
    gap_sum   = brief["gap_summary"]

    def conf_badge(conf):
        return CONFIDENCE_LABELS.get(conf, conf or "?")

    def section_block(sec):
        lines = []
        if sec.get("recommendation"):
            lines.append(f"> ⚡ **Action:** {sec['recommendation']}\n")
        return "\n".join(lines)

    # Champion block
    champ_sec = s["champion"]
    champ_lines = []
    if champ_sec.get("crm_champion"):
        c = champ_sec["crm_champion"]
        champ_lines.append(f"- **{c.get('name')}** — {c.get('title')} ({c.get('seniority')})  [{conf_badge('crm-confirmed')}]")
        if c.get("linkedin"):
            champ_lines.append(f"  {c['linkedin']}")
    for cand in champ_sec.get("inferred_candidates",[])[:2]:
        champ_lines.append(f"- {cand.get('inferred_name')} — {cand.get('title')}  [{conf_badge(cand.get('confidence','unverified'))}]")
        champ_lines.append(f"  Source: {cand.get('signal_source','')}")
    champ_block = "\n".join(champ_lines) if champ_lines else "_No champion data available_"

    # Economic buyer block
    econ_sec = s["economic_buyer"]
    econ_lines = []
    if econ_sec.get("crm_economic_buyer"):
        e = econ_sec["crm_economic_buyer"]
        econ_lines.append(f"- **{e.get('name')}** — {e.get('title')}  [{conf_badge('crm-confirmed')}]")
        econ_lines.append(f"  Meetings logged: {e.get('meetings',0)}")
    for exec_ in econ_sec.get("inferred_execs",[])[:2]:
        econ_lines.append(f"- {exec_.get('inferred_name')} — {exec_.get('title')}  [{conf_badge(exec_.get('confidence','unverified'))}]")
        econ_lines.append(f"  Source: {exec_.get('signal_source','')}")
    econ_block = "\n".join(econ_lines) if econ_lines else "_No economic buyer identified_"
    exec_status = "✓ Engaged" if econ_sec.get("exec_sponsor_engaged") else "✗ Not engaged"

    # Competitive block
    comp_sec   = s["competitive"]
    comp_lines = []
    if comp_sec.get("crm_competitive"):
        c = comp_sec["crm_competitive"]
        comp_lines.append(f"- **{c.get('primary')}** (primary)  [{conf_badge('crm-confirmed')}]")
        if c.get("secondary"):
            comp_lines.append(f"- {c['secondary']} (secondary)")
        if comp_sec.get("pricing_pressure_detected"):
            comp_lines.append("- ⚠️ Pricing objection already raised")
    for cs in comp_sec.get("inferred_competitors",[])[:2]:
        comp_lines.append(f"- {cs.get('competitor')}  [{conf_badge(cs.get('confidence','unverified'))}]")
        comp_lines.append(f"  Signal: {cs.get('detail','')[:80]}")
    comp_block = "\n".join(comp_lines) if comp_lines else "_No competitive data available_"

    # Use case block
    uc_sec    = s["use_case"]
    uc_lines  = []
    if uc_sec.get("crm_use_case"):
        uc_lines.append(f"- **{uc_sec['crm_use_case']}**  [{conf_badge('crm-confirmed')}]")
    if uc_sec.get("inferred_use_case"):
        uc_lines.append(f"- {uc_sec['inferred_use_case']}  [{conf_badge(uc_sec.get('inference_confidence','unverified'))}]")
    if uc_sec.get("inferred_tech_stack"):
        stack = ", ".join(uc_sec["inferred_tech_stack"][:4])
        uc_lines.append(f"- **Inferred stack:** {stack}  [{conf_badge(uc_sec.get('tech_stack_confidence','unverified'))}]")
    if uc_sec.get("relevant_job_postings"):
        uc_lines.append(f"- **Hiring signals:** {uc_sec['relevant_job_postings'][0].get('title','')} ({uc_sec['relevant_job_postings'][0].get('platform','')})")
    uc_block  = "\n".join(uc_lines) if uc_lines else "_Use case not defined_"

    # Timing block
    timing    = s["timing"]
    t_lines   = []
    if timing.get("funding_event"):
        fe = timing["funding_event"]
        t_lines.append(f"- 💰 **{fe.get('type')} — {fe.get('amount')}** ({fe.get('date')})  [{conf_badge('inferred-strong')}]")
        t_lines.append(f"  _{fe.get('implication','')}_")
    for news in timing.get("recent_news",[])[:2]:
        t_lines.append(f"- 📰 {news.get('headline','')} ({news.get('source','')}, {news.get('date','')})")
    if not t_lines:
        t_lines.append("_No recent trigger events detected_")
    t_block = "\n".join(t_lines)

    # Pre-call angle
    top        = pre["top_angle"]
    dont_text  = pre.get("what_not_to_do","")

    return f"""# Account Brief — {brief['company_name']}

**Rep:** {brief['rep_name']}  
**Segment:** {brief['segment']} | **Industry:** {brief.get('industry','')} | **ACV:** ${acv:,.0f}  
**Stage:** {brief['current_stage']} | **Forecast:** {brief.get('forecast_category','—')}

| Health Score | Intelligence Readiness | Critical Gaps | Exec Status |
|:---:|:---:|:---:|:---:|
| {health}/100 | {readiness}/100 | {gap_sum['critical_gaps']} | {exec_status} |

---

## Champion

{champ_block}
{section_block(champ_sec)}

## Economic Buyer & Exec Engagement

{econ_block}
{section_block(econ_sec)}

## Competitive Landscape

{comp_block}
{section_block(comp_sec)}

## Use Case & Pain Point

{uc_block}
{section_block(uc_sec)}

## Timing & Trigger Signals

{t_block}

---

## Pre-Call Angle

**Lead with:** {top.get('angle','')}  
**Confidence:** {conf_badge(top.get('confidence','unverified'))}  
**Source:** {top.get('source','')}

**Don't:** {dont_text}

---

## First Move — Do This Now

{first_move}

---
*Generated: {brief['generated_at']} | Intelligence readiness: {readiness}/100*
"""


# ─────────────────────────────────────────────────────────────────────────────
# 6. ACCOUNT READINESS FLATTENED EXPORT
# ─────────────────────────────────────────────────────────────────────────────

def flatten_brief_for_export(brief: dict, first_move: str) -> dict:
    """Flatten key brief fields to one CSV row per account."""
    s   = brief["sections"]
    pre = brief["pre_call_angle"]

    return {
        "account_id":               brief["account_id"],
        "company_name":             brief["company_name"],
        "rep_name":                 brief["rep_name"],
        "segment":                  brief["segment"],
        "industry":                 brief.get("industry",""),
        "current_stage":            brief["current_stage"],
        "acv_usd":                  brief["acv_usd"],
        "health_score":             brief["health_score"],
        "health_label":             brief["health_label"],
        "forecast_category":        brief.get("forecast_category",""),
        "intelligence_readiness":   brief["intelligence_readiness"],

        # Gap summary
        "total_gaps":               brief["gap_summary"]["total_gaps"],
        "critical_gaps":            brief["gap_summary"]["critical_gaps"],
        "gaps_filled_by_intel":     brief["gap_summary"]["filled_by_intel"],

        # Champion
        "champion_confidence":      s["champion"]["overall_confidence"],
        "champion_crm":             bool(s["champion"].get("crm_champion")),
        "champion_inferred_count":  len(s["champion"].get("inferred_candidates",[])),

        # Economic buyer
        "econ_buyer_confidence":    s["economic_buyer"]["overall_confidence"],
        "econ_buyer_crm":           bool(s["economic_buyer"].get("crm_economic_buyer")),
        "exec_sponsor_engaged":     s["economic_buyer"].get("exec_sponsor_engaged", False),
        "econ_buyer_meetings":      safe_int(s["economic_buyer"].get("economic_buyer_meetings", 0)),
        "exec_inferred_count":      len(s["economic_buyer"].get("inferred_execs",[])),

        # Competitive
        "competitive_confidence":   s["competitive"]["overall_confidence"],
        "competitive_crm":          bool(s["competitive"].get("crm_competitive")),
        "competitor_inferred_count":len(s["competitive"].get("inferred_competitors",[])),
        "pricing_pressure":         s["competitive"].get("pricing_pressure_detected", False),

        # Use case
        "use_case_confidence":      s["use_case"]["overall_confidence"],
        "use_case_crm":             bool(s["use_case"].get("crm_use_case")),
        "use_case_inferred":        s["use_case"].get("inferred_use_case",""),
        "tech_stack_inferred":      json.dumps(s["use_case"].get("inferred_tech_stack",[])),

        # Timing
        "funding_detected":         s["timing"].get("funding_detected", False),
        "leadership_change":        s["timing"].get("leadership_change_detected", False),
        "urgency_signal_count":     len(s["timing"].get("urgency_signals",[])),

        # Pre-call
        "top_angle":                pre["top_angle"].get("angle",""),
        "angle_confidence":         pre["top_angle"].get("confidence","unverified"),
        "angle_source":             pre["top_angle"].get("source",""),
        "what_not_to_do":           pre.get("what_not_to_do",""),

        # First move
        "first_move_draft":         first_move[:300],
        "generated_at":             brief["generated_at"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def run_brief_generator():
    print("\n" + "="*60)
    print("ACCOUNT INTELLIGENCE ENGINE — PHASE 3: BRIEF GENERATOR")
    print("="*60 + "\n")

    print("[1] Loading inputs from Phases 1 and 2...")
    health_df, gap_df, ext_df, crm_df = load_inputs()

    # Build lookup maps
    ext_map  = {row["account_id"]: row.to_dict() for _, row in ext_df.iterrows()}
    crm_map  = {row["account_id"]: row.to_dict() for _, row in crm_df.iterrows()}
    gap_map  = gap_df.groupby("account_id").apply(
        lambda x: x.to_dict("records"), include_groups=False
    ).to_dict()

    print("\n[2] Generating briefs for all accounts...")
    all_briefs   = []
    flat_rows    = []
    briefing_queue = []

    for i, (_, health_row) in enumerate(health_df.iterrows()):
        acc_id   = health_row["account_id"]
        crm_row  = crm_map.get(acc_id, {})
        ext_row  = ext_map.get(acc_id, {})
        acc_gaps = gap_map.get(acc_id, [])

        brief     = build_account_brief(
            health_row.to_dict(), crm_row, ext_row, acc_gaps
        )
        first_move = generate_first_move(brief)

        brief["first_move"] = first_move
        all_briefs.append(brief)

        flat = flatten_brief_for_export(brief, first_move)
        flat_rows.append(flat)

        # Add to queue — sort key: combine health urgency + ACV
        health_score = int(health_row.get("health_score") or 100)
        acv          = float(health_row.get("acv_usd") or 0)
        priority     = (100 - health_score) * 0.6 + min(acv / 100000, 10) * 0.4
        briefing_queue.append({
            "account_id":             acc_id,
            "company_name":           health_row.get("company_name"),
            "rep_name":               health_row.get("rep_name"),
            "segment":                health_row.get("segment"),
            "acv_usd":                acv,
            "health_score":           health_score,
            "health_label":           health_row.get("health_label"),
            "intelligence_readiness": brief["intelligence_readiness"],
            "critical_gaps":          brief["gap_summary"]["critical_gaps"],
            "priority_score":         round(priority, 2),
            "top_angle":              brief["pre_call_angle"]["top_angle"].get("angle",""),
            "angle_confidence":       brief["pre_call_angle"]["top_angle"].get("confidence","unverified"),
            "funding_detected":       brief["sections"]["timing"].get("funding_detected", False),
            "exec_engaged":           brief["sections"]["economic_buyer"].get("exec_sponsor_engaged", False),
            "first_move_preview":     first_move[:200],
        })

        if (i + 1) % 50 == 0:
            print(f"  → {i+1}/{len(health_df)} briefs built")

    briefing_queue.sort(key=lambda x: -x["priority_score"])

    print(f"  → {len(all_briefs)} briefs generated")

    # Intelligence readiness stats
    readiness_vals = [b["intelligence_readiness"] for b in all_briefs]
    print(f"\n  Intelligence readiness distribution:")
    for label, (lo, hi) in [("High (70–100)", (70,101)), ("Medium (40–69)", (40,70)), ("Low (<40)", (0,40))]:
        count = sum(1 for v in readiness_vals if lo <= v < hi)
        print(f"    {label:<20} {count}")

    print(f"\n  Confidence breakdown (top angle):")
    conf_counts = {}
    for q in briefing_queue:
        c = q["angle_confidence"]
        conf_counts[c] = conf_counts.get(c, 0) + 1
    for conf, count in sorted(conf_counts.items(), key=lambda x: CONFIDENCE_ORDER.get(x[0],3)):
        print(f"    {conf:<22} {count}")

    print(f"\n  Accounts with funding signals: {sum(1 for q in briefing_queue if q['funding_detected'])}")

    print("\n[3] Writing markdown cards for top 30 accounts...")
    top_accounts = briefing_queue[:30]
    top_ids      = {q["account_id"] for q in top_accounts}
    for brief in all_briefs:
        if brief["account_id"] in top_ids:
            md = build_markdown_card(brief, brief["first_move"])
            safe = re.sub(r"[^a-zA-Z0-9_-]", "_", brief["account_id"])
            with open(BRIEFS_DIR / f"{safe}.md", "w") as f:
                f.write(md)
    print(f"  → {len(top_ids)} markdown cards written to outputs/briefs/")

    print("\n[4] Writing output files...")

    readiness_df = pd.DataFrame(flat_rows)
    readiness_df.to_csv(OUTPUT_DIR / "account_readiness.csv", index=False)
    print(f"  → account_readiness.csv ({len(readiness_df)} rows, {len(readiness_df.columns)} fields)")

    with open(OUTPUT_DIR / "briefing_queue.json", "w") as f:
        json.dump(briefing_queue, f, indent=2, default=str)
    print(f"  → briefing_queue.json ({len(briefing_queue)} accounts, priority-sorted)")

    with open(OUTPUT_DIR / "all_briefs.json", "w") as f:
        json.dump(all_briefs, f, indent=2, default=str)
    print(f"  → all_briefs.json ({len(all_briefs)} full briefs)")

    print(f"\n  Top 5 priority accounts:")
    print(f"  {'Account':<12} {'Company':<28} {'ACV':>10}  {'Health':>7}  {'Ready':>7}  {'Top Angle'}")
    print(f"  {'─'*100}")
    for q in briefing_queue[:5]:
        print(f"  {q['account_id']:<12} {str(q['company_name'])[:26]:<28} "
              f"${q['acv_usd']:>9,.0f}  {q['health_score']:>7}  "
              f"{q['intelligence_readiness']:>6}%  "
              f"{str(q['top_angle'])[:45]}")

    print("\n" + "="*60)
    print("PHASE 3 COMPLETE")
    print("="*60)

    return all_briefs, briefing_queue, readiness_df


if __name__ == "__main__":
    all_briefs, queue, readiness_df = run_brief_generator()
