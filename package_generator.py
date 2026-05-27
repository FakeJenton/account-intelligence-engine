"""
Account Intelligence Engine — Phase 4: Account Readiness Package Generator
===========================================================================
Merges Phase 2 health audit + Phase 3 intelligence briefs into the final
unified output per account and the fleet-level payload consumed by the dashboard.

Outputs
-------
  readiness_packages/ACC-XXXX.json   — complete per-account package (top 50)
  dashboard_payload.json             — full serialized payload for the React dashboard
  executive_summary.json             — fleet-level stats for the exec view
  revops_brief.md                    — LLM-generated final RevOps brief
"""

import json
import math
import numpy as np
import pandas as pd
import requests
from pathlib import Path
from datetime import datetime

# ── Input paths ──────────────────────────────────────────────────────────────
HEALTH_PATH    = Path("/home/claude/account-intelligence-engine/outputs/health_scores.csv")
GAP_PATH       = Path("/home/claude/account-intelligence-engine/outputs/gap_report.csv")
CONTRADICTION_PATH = Path("/home/claude/account-intelligence-engine/outputs/contradiction_report.csv")
READINESS_PATH = Path("/home/claude/account-intelligence-engine/outputs/account_readiness.csv")
QUEUE_PATH     = Path("/home/claude/account-intelligence-engine/outputs/briefing_queue.json")
BRIEFS_PATH    = Path("/home/claude/account-intelligence-engine/outputs/all_briefs.json")
FLEET_PATH     = Path("/home/claude/account-intelligence-engine/outputs/fleet_summary.json")

OUTPUT_DIR     = Path("/home/claude/account-intelligence-engine/outputs")
PKG_DIR        = OUTPUT_DIR / "readiness_packages"
PKG_DIR.mkdir(parents=True, exist_ok=True)

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"

# ─────────────────────────────────────────────────────────────────────────────
# 1. LOAD ALL INPUTS
# ─────────────────────────────────────────────────────────────────────────────

def load_all():
    health_df  = pd.read_csv(HEALTH_PATH,    low_memory=False)
    gap_df     = pd.read_csv(GAP_PATH,       low_memory=False)
    cont_df    = pd.read_csv(CONTRADICTION_PATH, low_memory=False)
    ready_df   = pd.read_csv(READINESS_PATH, low_memory=False)

    with open(QUEUE_PATH)  as f: queue   = json.load(f)
    with open(BRIEFS_PATH) as f: briefs  = json.load(f)
    with open(FLEET_PATH)  as f: fleet   = json.load(f)

    # Build fast lookup maps
    brief_map  = {b["account_id"]: b for b in briefs}
    health_map = {r["account_id"]: r.to_dict() for _, r in health_df.iterrows()}
    ready_map  = {r["account_id"]: r.to_dict() for _, r in ready_df.iterrows()}
    gap_map    = gap_df.groupby("account_id").apply(
        lambda x: x.to_dict("records"), include_groups=False
    ).to_dict()
    cont_map   = cont_df.groupby("account_id").apply(
        lambda x: x.to_dict("records"), include_groups=False
    ).to_dict()

    print(f"[load] {len(health_df)} accounts, {len(briefs)} briefs, "
          f"{len(gap_df)} gaps, {len(cont_df)} contradictions")
    return health_map, ready_map, brief_map, gap_map, cont_map, queue, fleet


# ─────────────────────────────────────────────────────────────────────────────
# 2. BUILD UNIFIED READINESS PACKAGE PER ACCOUNT
# ─────────────────────────────────────────────────────────────────────────────

def _safe(val, default=None):
    """Return default for NaN, None, or empty string."""
    if val is None:
        return default
    if isinstance(val, float) and math.isnan(val):
        return default
    if isinstance(val, str) and val.strip().lower() in ("", "nan", "none"):
        return default
    return val


def build_readiness_package(account_id: str, health: dict, ready: dict,
                              brief: dict, gaps: list, contradictions: list) -> dict:
    """
    Merges health audit + intelligence brief into one unified account package.
    This is the single source of truth consumed by the dashboard.
    """
    acv   = float(_safe(health.get("acv_usd"), 0))
    stage = _safe(health.get("current_stage"), "Unknown")

    # ── Health dimension block ────────────────────────────────────────────────
    health_block = {
        "overall_score":    int(_safe(health.get("health_score"), 0)),
        "label":            _safe(health.get("health_label"), "unknown"),
        "completeness":     round(float(_safe(health.get("completeness_score"), 0)), 3),
        "freshness":        round(float(_safe(health.get("freshness_score"), 0)), 3),
        "consistency":      round(float(_safe(health.get("consistency_score"), 0)), 3),
        "reliability":      round(float(_safe(health.get("reliability_score"), 0)), 3),
        "reliability_tag":  _safe(health.get("reliability_tag"), "unknown"),
        "top_gap":          _safe(health.get("top_gap"), "No major gaps"),
        "top_gap_severity": _safe(health.get("top_gap_severity"), "none"),
    }

    # ── Gap summary block ─────────────────────────────────────────────────────
    critical_gaps    = [g for g in gaps if g.get("severity") == "critical"]
    important_gaps   = [g for g in gaps if g.get("severity") == "important"]
    freshness_gaps   = [g for g in gaps if g.get("gap_source") == "freshness"]
    completeness_gaps= [g for g in gaps if g.get("gap_source") == "completeness"]

    gap_block = {
        "total":                len(gaps),
        "critical":             len(critical_gaps),
        "important":            len(important_gaps),
        "freshness_flags":      len(freshness_gaps),
        "contradictions":       len(contradictions),
        "critical_contradictions": sum(1 for c in contradictions if c.get("severity") == "critical"),
        "top_critical_gaps":    [{"field": g["gap_field"], "label": g["gap_label"], "context": g.get("context","")}
                                  for g in critical_gaps[:4]],
        "top_contradictions":   [{"label": c["label"], "detail": c["detail"], "severity": c["severity"]}
                                  for c in contradictions[:3] if c.get("severity") == "critical"],
        "freshness_flags_detail": [{"label": g["gap_label"], "severity": g.get("severity","standard")}
                                    for g in freshness_gaps[:3]],
    }

    # ── Intelligence block ────────────────────────────────────────────────────
    sections   = brief.get("sections", {}) if brief else {}
    pre_call   = brief.get("pre_call_angle", {}) if brief else {}

    intel_block = {
        "readiness_score":     int(_safe(ready.get("intelligence_readiness"), 0)),
        "gaps_filled_by_intel":int(_safe(ready.get("gaps_filled_by_intel"), 0)),

        # Champion
        "champion": {
            "has_crm_data":    bool(_safe(ready.get("champion_crm"), False)),
            "confidence":      _safe(ready.get("champion_confidence"), "unverified"),
            "inferred_count":  int(_safe(ready.get("champion_inferred_count"), 0)),
            "candidates":      (sections.get("champion") or {}).get("inferred_candidates", [])[:2],
        },

        # Economic buyer
        "economic_buyer": {
            "has_crm_data":    bool(_safe(ready.get("econ_buyer_crm"), False)),
            "confidence":      _safe(ready.get("econ_buyer_confidence"), "unverified"),
            "exec_engaged":    bool(_safe(ready.get("exec_sponsor_engaged"), False)),
            "meetings":        int(float(_safe(ready.get("econ_buyer_meetings"), 0) or 0)),
            "inferred_execs":  (sections.get("economic_buyer") or {}).get("inferred_execs", [])[:2],
        },

        # Competitive
        "competitive": {
            "has_crm_data":    bool(_safe(ready.get("competitive_crm"), False)),
            "confidence":      _safe(ready.get("competitive_confidence"), "unverified"),
            "pricing_pressure":bool(_safe(ready.get("pricing_pressure"), False)),
            "inferred_count":  int(_safe(ready.get("competitor_inferred_count"), 0)),
            "signals":         (sections.get("competitive") or {}).get("inferred_competitors", [])[:2],
        },

        # Use case
        "use_case": {
            "has_crm_data":    bool(_safe(ready.get("use_case_crm"), False)),
            "confidence":      _safe(ready.get("use_case_confidence"), "unverified"),
            "inferred":        _safe(ready.get("use_case_inferred"), ""),
            "tech_stack":      json.loads(_safe(ready.get("tech_stack_inferred"), "[]") or "[]"),
        },

        # Timing
        "timing": {
            "funding_detected":       bool(_safe(ready.get("funding_detected"), False)),
            "leadership_change":      bool(_safe(ready.get("leadership_change"), False)),
            "urgency_signal_count":   int(_safe(ready.get("urgency_signal_count"), 0)),
            "urgency_signals":        (sections.get("timing") or {}).get("urgency_signals", []),
            "recent_news":            (sections.get("timing") or {}).get("recent_news", [])[:2],
        },
    }

    # ── Action block ──────────────────────────────────────────────────────────
    top_angle  = pre_call.get("top_angle", {}) if pre_call else {}
    first_move = _safe(brief.get("first_move"), "") if brief else ""

    action_block = {
        "top_angle":        _safe(top_angle.get("angle"), "Research further before outreach"),
        "angle_confidence": _safe(top_angle.get("confidence"), "unverified"),
        "angle_source":     _safe(top_angle.get("source"), ""),
        "all_angles":       (pre_call.get("all_angles") or [])[:3],
        "what_not_to_do":   _safe(pre_call.get("what_not_to_do"), ""),
        "first_move":       first_move,
        "first_move_preview": first_move[:200] if first_move else "",
    }

    # ── Priority score ────────────────────────────────────────────────────────
    health_score   = health_block["overall_score"]
    intel_readiness= intel_block["readiness_score"]
    acv_weight     = min(5.0, math.log1p(acv / 50000))
    urgency_bonus  = 0.5 if intel_block["timing"]["funding_detected"] else 0
    priority       = (100 - health_score) * 0.5 + (100 - intel_readiness) * 0.2 + acv_weight * 6 + urgency_bonus * 10
    priority       = round(priority, 2)

    return {
        "account_id":       account_id,
        "company_name":     _safe(health.get("company_name"), "Unknown"),
        "rep_name":         _safe(health.get("rep_name"), "Unknown"),
        "segment":          _safe(health.get("segment"), "Unknown"),
        "industry":         _safe(ready.get("industry"), ""),
        "current_stage":    stage,
        "acv_usd":          acv,
        "forecast_category":_safe(health.get("forecast_category"), ""),
        "priority_score":   priority,
        "generated_at":     datetime.now().strftime("%Y-%m-%d %H:%M:%S"),

        "health":           health_block,
        "gaps":             gap_block,
        "intelligence":     intel_block,
        "action":           action_block,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. EXECUTIVE SUMMARY
# ─────────────────────────────────────────────────────────────────────────────

def build_executive_summary(packages: list, fleet: dict) -> dict:
    """Fleet-level stats for the exec view tab."""
    total_acv  = sum(p["acv_usd"] for p in packages)
    flagged    = [p for p in packages if p["health"]["label"] in ("critical","at-risk")]
    acv_risk   = sum(p["acv_usd"] for p in flagged)

    # Health distribution
    health_dist = {}
    for p in packages:
        lbl = p["health"]["label"]
        health_dist[lbl] = health_dist.get(lbl, 0) + 1

    # Reliability distribution
    rel_dist = {}
    for p in packages:
        t = p["health"]["reliability_tag"]
        rel_dist[t] = rel_dist.get(t, 0) + 1

    # Commit deals that are unreliable
    unreliable_commits = [
        p for p in packages
        if p["health"]["reliability_tag"] == "unreliable"
        and p.get("forecast_category","") == "Commit"
    ]

    # Top gaps across fleet
    all_gaps = []
    for p in packages:
        for g in p["gaps"]["top_critical_gaps"]:
            all_gaps.append(g["label"])
    gap_freq = {}
    for g in all_gaps:
        gap_freq[g] = gap_freq.get(g, 0) + 1
    top_gaps = sorted(gap_freq.items(), key=lambda x: -x[1])[:8]

    # Rep scorecard
    rep_map = {}
    for p in packages:
        rep = _safe(p["rep_name"], "Unknown")
        if rep not in rep_map:
            rep_map[rep] = {"rep_name": rep, "total": 0, "at_risk": 0, "acv": 0.0,
                             "gap_types": [], "avg_health": []}
        rep_map[rep]["total"]    += 1
        rep_map[rep]["acv"]      += p["acv_usd"]
        rep_map[rep]["avg_health"].append(p["health"]["overall_score"])
        if p["health"]["label"] in ("critical","at-risk"):
            rep_map[rep]["at_risk"] += 1
        for g in p["gaps"]["top_critical_gaps"]:
            rep_map[rep]["gap_types"].append(g["field"])

    rep_scorecard = []
    for rep, d in rep_map.items():
        from collections import Counter
        top_gap = Counter(d["gap_types"]).most_common(1)
        rep_scorecard.append({
            "rep_name":          rep,
            "total_accounts":    d["total"],
            "at_risk_count":     d["at_risk"],
            "total_acv":         round(d["acv"], 0),
            "avg_health_score":  round(sum(d["avg_health"]) / len(d["avg_health"]), 1),
            "dominant_gap":      top_gap[0][0] if top_gap else "none",
        })
    rep_scorecard.sort(key=lambda x: -x["at_risk_count"])

    # Segment comparison
    seg_map = {}
    for p in packages:
        seg = _safe(p["segment"], "Unknown")
        if seg not in seg_map:
            seg_map[seg] = {"health": [], "completeness": [], "acv": 0, "count": 0, "at_risk": 0}
        seg_map[seg]["health"].append(p["health"]["overall_score"])
        seg_map[seg]["completeness"].append(p["health"]["completeness"])
        seg_map[seg]["acv"]   += p["acv_usd"]
        seg_map[seg]["count"] += 1
        if p["health"]["label"] in ("critical","at-risk"):
            seg_map[seg]["at_risk"] += 1

    segment_breakdown = {
        seg: {
            "count":           d["count"],
            "avg_health":      round(sum(d["health"]) / len(d["health"]), 1),
            "avg_completeness":round(sum(d["completeness"]) / len(d["completeness"]), 3),
            "total_acv":       round(d["acv"], 0),
            "at_risk_pct":     round(d["at_risk"] / d["count"], 3),
        }
        for seg, d in seg_map.items()
    }

    # Timing signals
    funding_accounts  = [p for p in packages if p["intelligence"]["timing"]["funding_detected"]]
    urgency_accounts  = [p for p in packages if p["intelligence"]["timing"]["urgency_signal_count"] > 0]

    # Intelligence coverage
    intel_coverage = {
        "champion_crm_pct":         round(sum(1 for p in packages if p["intelligence"]["champion"]["has_crm_data"]) / len(packages), 3),
        "econ_buyer_crm_pct":       round(sum(1 for p in packages if p["intelligence"]["economic_buyer"]["has_crm_data"]) / len(packages), 3),
        "exec_engaged_pct":         round(sum(1 for p in packages if p["intelligence"]["economic_buyer"]["exec_engaged"]) / len(packages), 3),
        "competitive_crm_pct":      round(sum(1 for p in packages if p["intelligence"]["competitive"]["has_crm_data"]) / len(packages), 3),
        "use_case_defined_pct":     round(sum(1 for p in packages if p["intelligence"]["use_case"]["has_crm_data"]) / len(packages), 3),
        "funding_detected_count":   len(funding_accounts),
        "urgency_signal_count":     len(urgency_accounts),
    }

    return {
        "generated_at":            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_accounts":          len(packages),
        "total_acv":               round(total_acv, 0),
        "acv_at_risk":             round(acv_risk, 0),
        "acv_at_risk_pct":         round(acv_risk / total_acv, 3) if total_acv > 0 else 0,
        "avg_health_score":        round(sum(p["health"]["overall_score"] for p in packages) / len(packages), 1),
        "avg_intelligence_readiness": round(sum(p["intelligence"]["readiness_score"] for p in packages) / len(packages), 1),
        "health_distribution":     health_dist,
        "reliability_distribution":rel_dist,
        "unreliable_commit_count": len(unreliable_commits),
        "unreliable_commit_acv":   round(sum(p["acv_usd"] for p in unreliable_commits), 0),
        "unreliable_commits":      [{"account_id": p["account_id"], "company_name": p["company_name"],
                                      "rep_name": p["rep_name"], "acv_usd": p["acv_usd"],
                                      "health_score": p["health"]["overall_score"]}
                                     for p in unreliable_commits[:10]],
        "top_gap_types":           [{"label": g, "count": c} for g, c in top_gaps],
        "rep_scorecard":           rep_scorecard[:15],
        "segment_breakdown":       segment_breakdown,
        "intelligence_coverage":   intel_coverage,
        "non_obvious_insights":    fleet.get("non_obvious_insights", []),
        "top_5_priority":          sorted(packages, key=lambda x: -x["priority_score"])[:5],
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. DASHBOARD PAYLOAD
# ─────────────────────────────────────────────────────────────────────────────

def build_dashboard_payload(packages: list, exec_summary: dict) -> dict:
    """Serialize everything into one JSON blob for the React dashboard."""

    def clean(obj):
        """Recursively strip NaN/inf values for JSON safety."""
        if isinstance(obj, dict):
            return {k: clean(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [clean(v) for v in obj]
        if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
            return None
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        return obj

    # Sort packages: critical first, then by priority score
    label_order = {"critical": 0, "at-risk": 1, "needs-attention": 2, "healthy": 3}
    sorted_packages = sorted(
        packages,
        key=lambda x: (label_order.get(x["health"]["label"], 4), -x["priority_score"])
    )

    payload = {
        "generated_at":   datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "executive_summary": exec_summary,
        "accounts":       sorted_packages,
        "color_scheme": {
            "health": {
                "critical":         "#DC2626",
                "at-risk":          "#D97706",
                "needs-attention":  "#2563EB",
                "healthy":          "#16A34A",
            },
            "reliability": {
                "reliable":    "#16A34A",
                "questionable":"#D97706",
                "unreliable":  "#DC2626",
            },
            "confidence": {
                "crm-confirmed":   "#16A34A",
                "inferred-strong": "#2563EB",
                "inferred-weak":   "#D97706",
                "unverified":      "#9CA3AF",
            },
            "segment": {
                "Enterprise":  "#6366F1",
                "Mid-Market":  "#0EA5E9",
                "SMB":         "#10B981",
            },
        },
    }

    return clean(payload)


# ─────────────────────────────────────────────────────────────────────────────
# 5. LLM REVOPS BRIEF
# ─────────────────────────────────────────────────────────────────────────────

def generate_revops_brief(exec_summary: dict) -> str:
    rel   = exec_summary["reliability_distribution"]
    dist  = exec_summary["health_distribution"]
    cov   = exec_summary["intelligence_coverage"]
    top5  = exec_summary.get("top_gap_types", [])[:5]
    insights = exec_summary.get("non_obvious_insights", [])

    prompt = f"""You are a RevOps analyst writing a pipeline health brief for a VP of Sales.
Direct, specific, data-backed. No generic advice. No hedging.

FLEET DATA:
- Total accounts: {exec_summary['total_accounts']}
- Total pipeline ACV: ${exec_summary['total_acv']:,.0f}
- ACV in critical/at-risk accounts: ${exec_summary['acv_at_risk']:,.0f} ({exec_summary['acv_at_risk_pct']*100:.1f}%)
- Average health score: {exec_summary['avg_health_score']}/100
- Health distribution: {dist}
- Forecast reliability: {rel}
- Unreliable Commit deals: {exec_summary['unreliable_commit_count']} deals (${exec_summary['unreliable_commit_acv']:,.0f} ACV)
- CRM coverage: champion logged {cov['champion_crm_pct']*100:.0f}%, exec engaged {cov['exec_engaged_pct']*100:.0f}%, use case defined {cov['use_case_defined_pct']*100:.0f}%
- Top gap types: {[g['label'] for g in top5]}
- Funding signals detected: {cov['funding_detected_count']} accounts (outreach window open)
- Non-obvious findings: {[i['title'] for i in insights]}

Write the brief in exactly this format — no headers, just the four sections clearly labeled:

STATE OF PIPELINE: [2 sentences — the single most important number and what it means]

FORECAST EXPOSURE: [The unreliable Commit deals problem, specifically. What's the risk and why.]

THREE BIGGEST PROBLEMS: [Numbered. Each one a specific finding with a number. No platitudes.]

FIX BEFORE NEXT PIPELINE REVIEW: [3 prioritized actions, specific, for the rep manager to act on Monday morning]

Under 250 words total."""

    try:
        resp = requests.post(
            ANTHROPIC_API_URL,
            headers={"Content-Type": "application/json"},
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 600,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=45,
        )
        resp.raise_for_status()
        return resp.json()["content"][0]["text"].strip()
    except Exception as e:
        print(f"  [LLM] API unavailable ({e}) — structured fallback")
        return _fallback_brief(exec_summary)


def _fallback_brief(s: dict) -> str:
    dist    = s["health_distribution"]
    rel     = s["reliability_distribution"]
    insights= s.get("non_obvious_insights", [])
    return f"""# Account Intelligence Engine — RevOps Brief
Generated: {s['generated_at']}

**STATE OF PIPELINE**
{s['total_accounts']} accounts audited with an average health score of {s['avg_health_score']}/100.
${s['acv_at_risk']:,.0f} ({s['acv_at_risk_pct']*100:.1f}%) of pipeline ACV is in accounts rated critical or at-risk.

**FORECAST EXPOSURE**
{s['unreliable_commit_count']} Commit deals carry an unreliable health score, representing ${s['unreliable_commit_acv']:,.0f} in committed ACV.
These deals have critical data gaps or internal contradictions that undermine the commit classification.
Review each before the next forecast call.

**THREE BIGGEST PROBLEMS**
{chr(10).join(f'{i+1}. {ins["finding"]}' for i, ins in enumerate(insights[:3]))}

**FIX BEFORE NEXT PIPELINE REVIEW**
1. Audit all Commit deals with reliability_tag = "unreliable" — confirm exec engagement and next step before keeping in forecast.
2. Champion is blank on {s['intelligence_coverage']['champion_crm_pct']*100:.0f}% of accounts — set a rep requirement to log champion before any deal advances past Discovery.
3. {s['intelligence_coverage']['funding_detected_count']} accounts have detected funding events — these are warm outreach windows. Assign reps to each account this week.
"""


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def run_package_generator():
    print("\n" + "="*60)
    print("ACCOUNT INTELLIGENCE ENGINE — PHASE 4: PACKAGE GENERATOR")
    print("="*60 + "\n")

    print("[1] Loading all phase outputs...")
    health_map, ready_map, brief_map, gap_map, cont_map, queue, fleet = load_all()

    print("\n[2] Building unified readiness packages...")
    packages = []
    for acc_id in health_map:
        pkg = build_readiness_package(
            account_id    = acc_id,
            health        = health_map[acc_id],
            ready         = ready_map.get(acc_id, {}),
            brief         = brief_map.get(acc_id),
            gaps          = gap_map.get(acc_id, []),
            contradictions= cont_map.get(acc_id, []),
        )
        packages.append(pkg)

    packages.sort(key=lambda x: -x["priority_score"])
    print(f"  → {len(packages)} packages built")

    print("\n[3] Writing individual package files (top 50)...")
    for pkg in packages[:50]:
        safe_id = pkg["account_id"].replace("-","_")
        with open(PKG_DIR / f"{safe_id}.json", "w") as f:
            json.dump(pkg, f, indent=2, default=str)
    print(f"  → {min(50, len(packages))} JSON packages written to outputs/readiness_packages/")

    print("\n[4] Building executive summary...")
    exec_summary = build_executive_summary(packages, fleet)
    print(f"  → Total ACV: ${exec_summary['total_acv']:,.0f}")
    print(f"  → ACV at risk: ${exec_summary['acv_at_risk']:,.0f} ({exec_summary['acv_at_risk_pct']*100:.1f}%)")
    print(f"  → Unreliable commits: {exec_summary['unreliable_commit_count']} deals")
    print(f"  → Avg health: {exec_summary['avg_health_score']}/100")
    print(f"  → Avg intel readiness: {exec_summary['avg_intelligence_readiness']}/100")

    print("\n[5] Generating RevOps brief via LLM...")
    brief_text = generate_revops_brief(exec_summary)

    print("\n[6] Building dashboard payload...")
    payload = build_dashboard_payload(packages, exec_summary)
    print(f"  → {len(payload['accounts'])} accounts in payload")

    print("\n[7] Writing output files...")
    with open(OUTPUT_DIR / "executive_summary.json", "w") as f:
        json.dump(exec_summary, f, indent=2, default=str)
    print("  → executive_summary.json")

    with open(OUTPUT_DIR / "dashboard_payload.json", "w") as f:
        json.dump(payload, f, indent=2, default=str)
    print("  → dashboard_payload.json")

    with open(OUTPUT_DIR / "revops_brief.md", "w") as f:
        f.write(brief_text)
    print("  → revops_brief.md")

    print(f"\n  TOP 5 PRIORITY ACCOUNTS:")
    print(f"  {'ID':<12} {'Company':<28} {'ACV':>10}  {'Health':>7}  {'Label':<18}  {'Top Angle'}")
    print(f"  {'─'*105}")
    for pkg in packages[:5]:
        print(f"  {pkg['account_id']:<12} {str(pkg['company_name'])[:26]:<28} "
              f"${pkg['acv_usd']:>9,.0f}  "
              f"{pkg['health']['overall_score']:>7}  "
              f"{pkg['health']['label']:<18}  "
              f"{str(pkg['action']['top_angle'])[:40]}")

    print("\n" + "="*60)
    print("PHASE 4 COMPLETE — BUILDING DASHBOARD")
    print("="*60)
    return packages, exec_summary, payload


if __name__ == "__main__":
    packages, exec_summary, payload = run_package_generator()
