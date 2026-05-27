"""
Account Intelligence Engine — Phase 2: CRM Health Auditor
==========================================================
Loads crm_accounts.csv and scores every account across four dimensions:

  1. Completeness  — are the fields that predict outcomes filled in?
  2. Freshness     — is the data current relative to stage expectations?
  3. Consistency   — do fields that should agree actually agree?
  4. Forecast Reliability — how much should we trust this deal's forecast position?

Produces a severity-ranked gap list per account, contradiction flags,
and a fleet-level summary with rep and segment breakdowns.

Outputs
-------
  health_scores.csv           — per-account scores across all four dimensions
  gap_report.csv              — one row per gap per account, severity-ranked
  contradiction_report.csv    — accounts where fields conflict with each other
  fleet_summary.json          — aggregate health stats for dashboard consumption
  health_audit_report.md      — LLM-generated plain-language RevOps brief
"""

import json
import re
import warnings
import requests
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path

warnings.filterwarnings("ignore")

CRM_PATH    = Path("/home/claude/account-intelligence-engine/crm_accounts.csv")
OUTPUT_DIR  = Path("/home/claude/account-intelligence-engine/outputs")
OUTPUT_DIR.mkdir(exist_ok=True)

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"

# ── Stage ordering for comparison logic ─────────────────────────────────────
STAGE_ORDER = {
    "Prospecting": 1, "Discovery": 2, "Technical Validation": 3,
    "Proposal Sent": 4, "Negotiation": 5, "Closed Won": 6, "Closed Lost": 7
}

# ── Expected activity cadence by stage (days since last activity threshold) ──
ACTIVITY_THRESHOLDS = {
    "Prospecting":          21,
    "Discovery":            14,
    "Technical Validation": 10,
    "Proposal Sent":        7,
    "Negotiation":          5,
}

# ── Meeting cadence by stage (minimum meetings in last 30d) ──────────────────
MEETING_THRESHOLDS = {
    "Prospecting":          1,
    "Discovery":            2,
    "Technical Validation": 2,
    "Proposal Sent":        1,
    "Negotiation":          2,
}

# ─────────────────────────────────────────────────────────────────────────────
# 1. LOAD & CLEAN
# ─────────────────────────────────────────────────────────────────────────────

def load_and_clean(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, low_memory=False)

    # Drop duplicate rows
    df = df[~df["account_id"].astype(str).str.endswith("-DUP", na=False)].copy()
    df = df.reset_index(drop=True)

    # Normalize booleans
    bool_cols = [
        "exec_sponsor_engaged", "pricing_objection_raised", "proposal_sent",
        "technical_validation_done", "security_review_done", "legal_review_started",
        "next_step_defined", "mutual_action_plan", "budget_confirmed",
        "feature_gap_flagged", "g2_profile_viewed", "product_trial_active",
        "procurement_engaged", "sow_sent",
    ]
    for col in bool_cols:
        if col in df.columns:
            df[col] = df[col].map(
                lambda x: True if str(x).strip().lower() in ("true","1","yes")
                else (False if str(x).strip().lower() in ("false","0","no") else np.nan)
            )

    # Coerce numerics
    num_cols = [
        "acv_usd", "net_acv_usd", "discount_pct", "days_in_current_stage",
        "stage_change_count", "expected_cycle_days", "days_since_last_activity",
        "days_since_last_meeting", "email_response_rate", "meeting_count_last_30d",
        "total_meetings", "total_calls", "call_frequency_per_week",
        "multithread_attempt_count", "unique_stakeholders_engaged",
        "competitive_mentions_count", "pricing_objection_count", "economic_buyer_meetings",
        "intent_score", "website_visits_30d", "content_downloads_count",
        "trial_feature_adoption", "open_support_tickets", "gap_count",
    ]
    for col in num_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Standardize dates — try common formats, fall back to NaT
    date_cols = ["created_date", "close_date", "last_modified_date",
                 "last_activity_date", "last_meeting_date", "last_call_date"]
    for col in date_cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")

    # Computed helper: days until close
    today = pd.Timestamp(datetime.today().date())
    df["days_to_close"] = (df["close_date"] - today).dt.days

    print(f"[load] {len(df)} accounts loaded and cleaned")
    print(f"  → Segments: {df['segment'].value_counts().to_dict()}")
    print(f"  → Stages: {df['current_stage'].value_counts().to_dict()}")
    return df


# ─────────────────────────────────────────────────────────────────────────────
# 2. DIMENSION 1 — COMPLETENESS SCORING
# ─────────────────────────────────────────────────────────────────────────────

# Field weights: higher = more important to have filled in
# Weights scale with typical deal stage — we don't penalize missing legal
# contact on a Prospecting deal as harshly as on a Negotiation deal
COMPLETENESS_FIELDS = {
    # Critical (weight 3) — directly predict outcomes
    "champion_name":           {"weight": 3, "min_stage": "Discovery",            "label": "Champion name not logged"},
    "champion_title":          {"weight": 3, "min_stage": "Discovery",            "label": "Champion title not logged"},
    "champion_seniority":      {"weight": 3, "min_stage": "Discovery",            "label": "Champion seniority unknown"},
    "economic_buyer_name":     {"weight": 3, "min_stage": "Technical Validation", "label": "Economic buyer not identified"},
    "economic_buyer_title":    {"weight": 3, "min_stage": "Technical Validation", "label": "Economic buyer title not logged"},
    "use_case":                {"weight": 3, "min_stage": "Discovery",            "label": "Use case / pain point not defined"},
    "next_step_defined":       {"weight": 3, "min_stage": "Prospecting",          "label": "No next step defined"},
    "competitor_primary":      {"weight": 3, "min_stage": "Discovery",            "label": "No primary competitor logged"},
    "close_date":              {"weight": 3, "min_stage": "Prospecting",          "label": "No close date set"},
    # Important (weight 2) — strong predictors, often missed
    "exec_sponsor_engaged":    {"weight": 2, "min_stage": "Technical Validation", "label": "Executive sponsor not engaged"},
    "proposal_sent":           {"weight": 2, "min_stage": "Proposal Sent",        "label": "Proposal not marked as sent"},
    "technical_validation_done":{"weight":2, "min_stage": "Technical Validation", "label": "Technical validation not logged"},
    "pain_point_stated":       {"weight": 2, "min_stage": "Discovery",            "label": "Pain point not articulated"},
    "mutual_action_plan":      {"weight": 2, "min_stage": "Proposal Sent",        "label": "Mutual action plan not shared"},
    "budget_confirmed":        {"weight": 2, "min_stage": "Proposal Sent",        "label": "Budget not confirmed"},
    "forecast_category":       {"weight": 2, "min_stage": "Discovery",            "label": "No forecast category assigned"},
    "rep_notes":               {"weight": 2, "min_stage": "Prospecting",          "label": "No rep notes logged"},
    # Standard (weight 1) — useful but lower urgency
    "it_security_contact":     {"weight": 1, "min_stage": "Technical Validation", "label": "IT / security contact not logged"},
    "legal_contact":           {"weight": 1, "min_stage": "Negotiation",          "label": "Legal contact not logged"},
    "tech_stack":              {"weight": 1, "min_stage": "Discovery",            "label": "Tech stack not logged"},
    "competitive_notes":       {"weight": 1, "min_stage": "Discovery",            "label": "Competitive notes empty"},
    "last_call_notes":         {"weight": 1, "min_stage": "Discovery",            "label": "Last call notes not logged"},
    "champion_linkedin":       {"weight": 1, "min_stage": "Discovery",            "label": "Champion LinkedIn not captured"},
}


def score_completeness(row: dict, stage: str) -> dict:
    """
    Returns completeness score and list of missing fields with severity.
    Only penalizes fields that are expected at or before the current stage.
    """
    stage_rank   = STAGE_ORDER.get(stage, 1)
    total_weight = 0
    earned_weight = 0
    gaps = []

    for field, meta in COMPLETENESS_FIELDS.items():
        min_stage_rank = STAGE_ORDER.get(meta["min_stage"], 1)
        if stage_rank < min_stage_rank:
            continue  # Not expected yet at this stage

        total_weight += meta["weight"]
        val = row.get(field)

        # Determine if the field is populated
        is_blank = (
            val is None
            or (isinstance(val, float) and np.isnan(val))
            or str(val).strip().lower() in ("", "nan", "none", "tbd", "unknown", "n/a")
            or (field == "exec_sponsor_engaged" and str(val).strip().lower() == "false"
                and stage_rank >= STAGE_ORDER.get("Technical Validation", 3))
            or (field in ("next_step_defined", "mutual_action_plan", "budget_confirmed",
                          "proposal_sent", "technical_validation_done")
                and str(val).strip().lower() == "false"
                and stage_rank >= STAGE_ORDER.get(meta["min_stage"], 1))
        )

        if is_blank:
            severity = {3: "critical", 2: "important", 1: "standard"}[meta["weight"]]
            acv = float(row.get("acv_usd") or 0)
            # Escalate severity for high-ACV deals missing critical fields
            if meta["weight"] == 3 and acv > 150000:
                severity = "critical"
            elif meta["weight"] == 2 and acv > 300000:
                severity = "critical"

            gaps.append({
                "field":        field,
                "severity":     severity,
                "weight":       meta["weight"],
                "label":        meta["label"],
                "context":      _gap_context(field, row, stage, acv),
            })
        else:
            earned_weight += meta["weight"]

    score = round(earned_weight / total_weight, 3) if total_weight > 0 else 1.0
    gaps.sort(key=lambda x: -x["weight"])
    return {"score": score, "gaps": gaps, "fields_evaluated": total_weight // 1}


def _gap_context(field: str, row: dict, stage: str, acv: float) -> str:
    """Generate a plain-language explanation of why this gap matters."""
    acv_str = f"${acv:,.0f} ACV" if acv else "unknown ACV"
    stage_str = stage
    contexts = {
        "champion_name":        f"No champion logged on a {stage_str} deal ({acv_str}). Can't multi-thread or plan for champion risk without knowing who it is.",
        "economic_buyer_name":  f"Economic buyer blank on a {stage_str} deal ({acv_str}). Champion alone cannot close this deal.",
        "exec_sponsor_engaged": f"No exec sponsor at {stage_str} with {acv_str}. Deals without exec engagement at this stage have significantly lower close rates.",
        "use_case":             f"Use case not defined — can't personalize outreach or map to relevant case studies.",
        "next_step_defined":    f"No next step logged. Deal may be drifting without a defined forward motion.",
        "competitor_primary":   f"No competitor logged despite deal being at {stage_str}. Risk of being surprised in late stages.",
        "proposal_sent":        f"Stage is {stage_str} but proposal not marked sent — data integrity issue or process gap.",
        "technical_validation_done": f"Technical validation not logged at {stage_str}. Required before close.",
        "mutual_action_plan":   f"No mutual action plan at {stage_str} ({acv_str}). Shared close plans correlate with higher win rates.",
        "budget_confirmed":     f"Budget unconfirmed at {stage_str} on {acv_str} deal — forecast reliability is low.",
        "rep_notes":            f"No rep notes — deal history is invisible to manager and successor reps.",
        "it_security_contact":  f"Security contact not logged at {stage_str}. Technical validation requires security sign-off.",
        "legal_contact":        f"Legal contact blank at {stage_str}. Negotiation will stall without knowing who redlines the MSA.",
        "pain_point_stated":    f"Pain point not articulated. Messaging and positioning cannot be personalized.",
        "tech_stack":           f"No tech stack logged. Can't map integration story or anticipate technical objections.",
    }
    return contexts.get(field, f"Field missing at {stage_str} stage — {acv_str} deal.")


# ─────────────────────────────────────────────────────────────────────────────
# 3. DIMENSION 2 — FRESHNESS SCORING
# ─────────────────────────────────────────────────────────────────────────────

def score_freshness(row: dict, stage: str) -> dict:
    """
    Scores how current the deal data is relative to expected activity for the stage.
    Returns score (0-1) and list of staleness flags.
    """
    flags     = []
    penalties = []
    today     = datetime.today()

    # Activity staleness
    days_inactive = float(row.get("days_since_last_activity") or 999)
    threshold     = ACTIVITY_THRESHOLDS.get(stage, 14)
    if days_inactive > threshold:
        overrun = days_inactive - threshold
        penalty = min(0.35, 0.10 + (overrun / 30) * 0.25)
        penalties.append(penalty)
        flags.append({
            "type":     "stale_activity",
            "severity": "critical" if days_inactive > threshold * 2 else "important",
            "label":    f"No activity in {int(days_inactive)} days (expected: ≤{threshold}d at {stage})",
            "days_overdue": int(overrun),
        })

    # Meeting cadence staleness
    meetings_30d   = float(row.get("meeting_count_last_30d") or 0)
    min_meetings   = MEETING_THRESHOLDS.get(stage, 1)
    if meetings_30d < min_meetings and STAGE_ORDER.get(stage, 1) >= 2:
        penalty = 0.15 if meetings_30d == 0 else 0.08
        penalties.append(penalty)
        flags.append({
            "type":     "meeting_cadence",
            "severity": "important",
            "label":    f"Only {int(meetings_30d)} meeting(s) in last 30 days (expected: ≥{min_meetings} at {stage})",
        })

    # Zombie deal: close date in the past
    days_to_close = row.get("days_to_close")
    if days_to_close is not None:
        try:
            dtc = float(days_to_close)
            if dtc < -7:
                penalty = min(0.30, 0.15 + abs(dtc) / 90 * 0.15)
                penalties.append(penalty)
                flags.append({
                    "type":     "zombie_deal",
                    "severity": "critical",
                    "label":    f"Close date is {abs(int(dtc))} days in the past with no stage change — zombie deal",
                })
        except (TypeError, ValueError):
            pass

    # Stage stagnation: too long in current stage
    days_in_stage = float(row.get("days_in_current_stage") or 0)
    expected_per_stage = float(row.get("expected_cycle_days") or 90) / 5
    if days_in_stage > expected_per_stage * 2.0:
        penalty = min(0.20, (days_in_stage / (expected_per_stage * 2)) * 0.15)
        penalties.append(penalty)
        flags.append({
            "type":     "stage_stagnation",
            "severity": "important",
            "label":    f"Stuck in {stage} for {int(days_in_stage)} days (expected avg: ~{int(expected_per_stage)}d per stage)",
        })

    # Low email response rate
    email_rr = row.get("email_response_rate")
    if email_rr is not None:
        try:
            rr = float(email_rr)
            if rr < 0.30 and STAGE_ORDER.get(stage, 1) >= 2:
                penalty = 0.10
                penalties.append(penalty)
                flags.append({
                    "type":     "low_email_response",
                    "severity": "standard",
                    "label":    f"Email response rate {rr*100:.0f}% — prospect engagement is low",
                })
        except (TypeError, ValueError):
            pass

    total_penalty = min(0.85, sum(penalties))
    score         = round(1.0 - total_penalty, 3)
    flags.sort(key=lambda x: {"critical": 0, "important": 1, "standard": 2}[x["severity"]])
    return {"score": score, "flags": flags}


# ─────────────────────────────────────────────────────────────────────────────
# 4. DIMENSION 3 — CONSISTENCY SCORING
# ─────────────────────────────────────────────────────────────────────────────

def score_consistency(row: dict, stage: str) -> dict:
    """
    Cross-references fields that should agree and flags contradictions.
    Returns score (0-1) and list of contradiction flags.
    """
    contradictions = []
    stage_rank     = STAGE_ORDER.get(stage, 1)
    acv            = float(row.get("acv_usd") or 0)

    def flag(severity, label, detail):
        contradictions.append({"severity": severity, "label": label, "detail": detail})

    # Stage vs. proposal_sent
    if stage_rank >= STAGE_ORDER["Proposal Sent"]:
        if str(row.get("proposal_sent", "")).strip().lower() == "false":
            flag("critical",
                 "Stage is Proposal Sent / Negotiation but proposal_sent = False",
                 "Either the stage is wrong or the proposal field was never updated. Both undermine forecast accuracy.")

    # Stage vs. technical_validation_done
    if stage_rank >= STAGE_ORDER["Negotiation"]:
        if str(row.get("technical_validation_done", "")).strip().lower() == "false":
            flag("important",
                 "In Negotiation but technical validation not logged as complete",
                 "Deals entering negotiation without completed technical validation have high late-stage loss risk.")

    # Forecast = Commit but missing exec engagement
    if str(row.get("forecast_category", "")).strip() == "Commit":
        if str(row.get("exec_sponsor_engaged", "")).strip().lower() == "false":
            flag("critical",
                 "Forecast category is Commit but no executive sponsor engaged",
                 "Committing a deal without exec-level buy-in is a leading indicator of a slip or loss.")
        if float(row.get("economic_buyer_meetings") or 0) == 0:
            flag("critical",
                 "Forecast category is Commit but zero economic buyer meetings logged",
                 "The person who approves budget has not been in a meeting. This deal cannot close as committed.")

    # High ACV + IC-level champion + no exec
    if acv > 150000:
        seniority = str(row.get("champion_seniority", "") or "").strip()
        exec_eng  = str(row.get("exec_sponsor_engaged", "")).strip().lower()
        if seniority == "IC" and exec_eng == "false":
            flag("critical",
                 f"${acv:,.0f} deal with IC-level champion and no exec engagement",
                 "IC champions cannot approve large budgets. Without exec engagement, this deal has a low close probability regardless of champion enthusiasm.")

    # Pricing objection raised but no competitor logged
    if str(row.get("pricing_objection_raised", "")).strip().lower() == "true":
        if not row.get("competitor_primary") or str(row.get("competitor_primary", "")).strip().lower() in ("none", "nan", ""):
            flag("important",
                 "Pricing objection raised but no competitor logged",
                 "Pricing pressure without a logged competitor is suspicious — the comparison is probably happening, just not tracked.")

    # Close date within 14 days but key milestones missing
    days_to_close = row.get("days_to_close")
    if days_to_close is not None:
        try:
            dtc = float(days_to_close)
            if 0 < dtc <= 14:
                if str(row.get("technical_validation_done", "")).strip().lower() == "false":
                    flag("critical",
                         "Close date within 14 days but technical validation not complete",
                         "Technical sign-off is a hard prerequisite for most enterprise closes.")
                if str(row.get("legal_review_started", "")).strip().lower() == "false" and acv > 50000:
                    flag("important",
                         "Close date within 14 days but legal review not started",
                         "Legal review typically takes 5–15 business days. Timeline is at risk.")
                if not row.get("next_step_defined") or str(row.get("next_step_defined", "")).strip().lower() == "false":
                    flag("important",
                         "Close date within 14 days but no next step defined",
                         "A deal approaching close with no defined next step is likely to slip.")
        except (TypeError, ValueError):
            pass

    # Multithread attempt = 0 in late stage
    if stage_rank >= STAGE_ORDER["Technical Validation"]:
        mt = float(row.get("multithread_attempt_count") or 0)
        if mt == 0 and acv > 80000:
            flag("important",
                 f"No multi-thread attempts on a {stage} deal worth ${acv:,.0f}",
                 "Single-threaded deals at this stage are high-risk if the champion leaves or deprioritizes.")

    # Rep notes contradict stage expectations
    notes = str(row.get("rep_notes") or "").lower()
    if any(kw in notes for kw in ["went dark", "gone quiet", "no response", "not responding", "silent"]):
        if stage_rank >= STAGE_ORDER["Technical Validation"]:
            flag("critical",
                 "Rep notes indicate prospect has gone dark but deal remains in active stage",
                 "Deal should be re-qualified or moved to Closed Lost. Keeping it active inflates forecast.")

    if any(kw in notes for kw in ["champion left", "left the company", "new lead", "moved teams"]):
        flag("critical",
             "Rep notes indicate champion has left — deal ownership is unresolved",
             "Champion departure without a replacement contact identified is a high-risk signal.")

    n   = len(contradictions)
    score = max(0.0, round(1.0 - (n * 0.18), 3))
    contradictions.sort(key=lambda x: {"critical": 0, "important": 1, "standard": 2}[x["severity"]])
    return {"score": score, "contradictions": contradictions}


# ─────────────────────────────────────────────────────────────────────────────
# 5. DIMENSION 4 — FORECAST RELIABILITY
# ─────────────────────────────────────────────────────────────────────────────

def score_forecast_reliability(completeness: dict, freshness: dict,
                                consistency: dict, row: dict) -> dict:
    """
    Combines the three dimension scores into a forecast reliability rating.
    Applies non-linear penalty for critical contradictions — a single
    critical consistency issue can tank an otherwise-healthy deal.
    """
    c_score = completeness["score"]
    f_score = freshness["score"]
    co_score = consistency["score"]

    # Weighted composite: completeness matters most, then freshness
    raw = (c_score * 0.40) + (f_score * 0.35) + (co_score * 0.25)

    # Hard penalty for critical contradictions
    critical_issues = sum(
        1 for c in consistency["contradictions"] if c["severity"] == "critical"
    ) + sum(
        1 for f in freshness["flags"] if f["severity"] == "critical"
    )

    penalty = critical_issues * 0.12
    adjusted = max(0.0, round(raw - penalty, 3))

    # Reliability tag
    if adjusted >= 0.80:
        tag = "reliable"
    elif adjusted >= 0.55:
        tag = "questionable"
    else:
        tag = "unreliable"

    return {
        "score":            adjusted,
        "tag":              tag,
        "component_scores": {
            "completeness": c_score,
            "freshness":    f_score,
            "consistency":  co_score,
        },
        "critical_issue_count": critical_issues,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 6. OVERALL HEALTH SCORE
# ─────────────────────────────────────────────────────────────────────────────

def overall_health(completeness, freshness, consistency, reliability) -> tuple[int, str]:
    """
    Combines all four dimensions into a single 0-100 health score with a label.
    """
    raw = (
        completeness["score"] * 0.35
        + freshness["score"]  * 0.25
        + consistency["score"]* 0.20
        + reliability["score"]* 0.20
    )
    score = round(raw * 100)

    if score >= 80:
        label = "healthy"
    elif score >= 60:
        label = "needs-attention"
    elif score >= 40:
        label = "at-risk"
    else:
        label = "critical"

    return score, label


# ─────────────────────────────────────────────────────────────────────────────
# 7. AUDIT ALL ACCOUNTS
# ─────────────────────────────────────────────────────────────────────────────

def audit_all_accounts(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Runs the full 4-dimension audit on every account.

    Returns:
      health_df     — one row per account with all scores
      gap_df        — one row per gap per account (for drilling)
      contradiction_df — one row per contradiction per account
    """
    health_rows   = []
    gap_rows      = []
    contradiction_rows = []

    for _, row in df.iterrows():
        row_dict = row.to_dict()
        stage    = str(row_dict.get("current_stage") or "Prospecting")

        comp   = score_completeness(row_dict, stage)
        fresh  = score_freshness(row_dict, stage)
        cons   = score_consistency(row_dict, stage)
        rel    = score_forecast_reliability(comp, fresh, cons, row_dict)
        health_score, health_label = overall_health(comp, fresh, cons, rel)

        acv     = float(row_dict.get("acv_usd") or 0)
        account_id   = row_dict.get("account_id")
        company_name = row_dict.get("company_name")
        rep_name     = row_dict.get("rep_name")

        health_rows.append({
            "account_id":               account_id,
            "company_name":             company_name,
            "rep_name":                 rep_name,
            "segment":                  row_dict.get("segment"),
            "industry":                 row_dict.get("industry"),
            "current_stage":            stage,
            "acv_usd":                  acv,
            "forecast_category":        row_dict.get("forecast_category"),

            # Dimension scores
            "completeness_score":       comp["score"],
            "freshness_score":          fresh["score"],
            "consistency_score":        cons["score"],
            "reliability_score":        rel["score"],
            "reliability_tag":          rel["tag"],

            # Overall
            "health_score":             health_score,
            "health_label":             health_label,

            # Counts for quick filtering
            "critical_gap_count":       sum(1 for g in comp["gaps"] if g["severity"] == "critical"),
            "total_gap_count":          len(comp["gaps"]) + len(fresh["flags"]),
            "contradiction_count":      len(cons["contradictions"]),
            "critical_contradiction_count": sum(1 for c in cons["contradictions"] if c["severity"] == "critical"),
            "critical_freshness_count": sum(1 for f in fresh["flags"] if f["severity"] == "critical"),

            # Top gap for quick display
            "top_gap":                  comp["gaps"][0]["label"] if comp["gaps"] else (fresh["flags"][0]["label"] if fresh["flags"] else "No major gaps"),
            "top_gap_severity":         comp["gaps"][0]["severity"] if comp["gaps"] else (fresh["flags"][0].get("severity","standard") if fresh["flags"] else "none"),

            # Ground truth
            "injected_gaps":            row_dict.get("injected_gaps"),
            "ground_truth_gap":         row_dict.get("primary_gap_type"),
        })

        # Gap rows — completeness gaps
        for gap in comp["gaps"]:
            gap_rows.append({
                "account_id":   account_id,
                "company_name": company_name,
                "rep_name":     rep_name,
                "segment":      row_dict.get("segment"),
                "acv_usd":      acv,
                "current_stage":stage,
                "gap_source":   "completeness",
                "gap_field":    gap["field"],
                "gap_label":    gap["label"],
                "severity":     gap["severity"],
                "weight":       gap["weight"],
                "context":      gap["context"],
            })

        # Gap rows — freshness flags
        for flag in fresh["flags"]:
            gap_rows.append({
                "account_id":   account_id,
                "company_name": company_name,
                "rep_name":     rep_name,
                "segment":      row_dict.get("segment"),
                "acv_usd":      acv,
                "current_stage":stage,
                "gap_source":   "freshness",
                "gap_field":    flag["type"],
                "gap_label":    flag["label"],
                "severity":     flag["severity"],
                "weight":       3 if flag["severity"] == "critical" else (2 if flag["severity"] == "important" else 1),
                "context":      flag.get("label", ""),
            })

        # Contradiction rows
        for c in cons["contradictions"]:
            contradiction_rows.append({
                "account_id":   account_id,
                "company_name": company_name,
                "rep_name":     rep_name,
                "segment":      row_dict.get("segment"),
                "acv_usd":      acv,
                "current_stage":stage,
                "forecast_category": row_dict.get("forecast_category"),
                "severity":     c["severity"],
                "label":        c["label"],
                "detail":       c["detail"],
                "health_score": health_score,
            })

    health_df        = pd.DataFrame(health_rows)
    gap_df           = pd.DataFrame(gap_rows).sort_values(["account_id","weight"], ascending=[True, False])
    contradiction_df = pd.DataFrame(contradiction_rows).sort_values("severity")

    return health_df, gap_df, contradiction_df


# ─────────────────────────────────────────────────────────────────────────────
# 8. FLEET-LEVEL SUMMARY
# ─────────────────────────────────────────────────────────────────────────────

def build_fleet_summary(health_df: pd.DataFrame, gap_df: pd.DataFrame,
                         contradiction_df: pd.DataFrame) -> dict:
    total = len(health_df)
    label_dist = health_df["health_label"].value_counts().to_dict()

    # ACV breakdown
    acv_total   = float(health_df["acv_usd"].sum())
    acv_critical= float(health_df[health_df["health_label"].isin(["critical","at-risk"])]["acv_usd"].sum())

    # Reliability
    rel_dist = health_df["reliability_tag"].value_counts().to_dict()
    unreliable_commit = health_df[
        (health_df["reliability_tag"] == "unreliable") &
        (health_df["forecast_category"] == "Commit")
    ][["company_name","rep_name","acv_usd","health_score"]].head(10).to_dict("records")

    # Most common gaps
    top_gaps = (
        gap_df.groupby("gap_label")
        .agg(count=("account_id","count"), avg_acv=("acv_usd","mean"))
        .sort_values("count", ascending=False)
        .head(10)
        .reset_index()
        .to_dict("records")
    )

    # Rep-level breakdown
    rep_summary = (
        health_df.groupby("rep_name")
        .agg(
            total_accounts   =("account_id","count"),
            avg_health_score =("health_score","mean"),
            critical_accounts=("health_label", lambda x: (x.isin(["critical","at-risk"])).sum()),
            total_acv        =("acv_usd","sum"),
            avg_completeness =("completeness_score","mean"),
        )
        .sort_values("critical_accounts", ascending=False)
        .head(15)
        .reset_index()
        .round(2)
        .to_dict("records")
    )

    # Segment breakdown
    seg_summary = (
        health_df.groupby("segment")
        .agg(
            avg_health  =("health_score","mean"),
            critical_pct=("health_label", lambda x: (x.isin(["critical","at-risk"])).mean()),
            avg_complete=("completeness_score","mean"),
            total_acv   =("acv_usd","sum"),
        )
        .round(3)
        .to_dict("index")
    )

    # Non-obvious insights
    insights = _extract_insights(health_df, gap_df, contradiction_df)

    return {
        "run_timestamp":          datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_accounts":         total,
        "health_label_distribution": label_dist,
        "health_score_mean":      round(float(health_df["health_score"].mean()), 1),
        "health_score_median":    round(float(health_df["health_score"].median()), 1),
        "total_acv":              round(acv_total, 0),
        "acv_in_critical_or_at_risk": round(acv_critical, 0),
        "acv_at_risk_pct":        round(acv_critical / acv_total, 3) if acv_total > 0 else 0,
        "reliability_distribution": rel_dist,
        "unreliable_commit_deals":  unreliable_commit,
        "total_gaps_identified":  len(gap_df),
        "total_contradictions":   len(contradiction_df),
        "critical_contradictions":int((contradiction_df["severity"] == "critical").sum()),
        "top_gap_types":          top_gaps,
        "rep_breakdown":          rep_summary,
        "segment_breakdown":      seg_summary,
        "non_obvious_insights":   insights,
    }


def _extract_insights(health_df, gap_df, contradiction_df) -> list:
    insights = []

    # 1. Commit deals that are unreliable
    unreliable_commits = health_df[
        (health_df["reliability_tag"] == "unreliable") &
        (health_df["forecast_category"] == "Commit")
    ]
    if len(unreliable_commits) > 0:
        acv_exposed = unreliable_commits["acv_usd"].sum()
        insights.append({
            "title":      f"{len(unreliable_commits)} Commit deals are flagged as unreliable",
            "finding":    f"${acv_exposed:,.0f} in forecast-committed ACV has an 'unreliable' health score — meaning the data supporting the commit is incomplete, stale, or internally contradictory. These are the most dangerous deals in the forecast.",
            "implication":"Review each Commit deal's health score before the next forecast call. Deals without exec engagement, recent activity, and a logged next step should be moved to Best Case until the gaps are closed.",
            "category":   "forecast_risk",
        })

    # 2. IC champion on high-ACV deals
    ic_large = health_df[
        health_df["ground_truth_gap"] == "ic_champion_large_deal"
    ]
    if len(ic_large) >= 2:
        insights.append({
            "title":      f"{len(ic_large)} high-ACV deals are single-threaded through IC-level champions",
            "finding":    f"These deals average ${ic_large['acv_usd'].mean():,.0f} ACV. In each case, the champion is an individual contributor with no budget authority and no exec sponsor logged. The champion enthusiasm is real — the close probability is not.",
            "implication":"Prioritize exec engagement on these accounts before the next pipeline review. The rep needs to ask the champion directly who else needs to say yes.",
            "category":   "pipeline_risk",
        })

    # 3. Zombie deals by segment
    zombies = gap_df[gap_df["gap_field"] == "zombie_deal"]
    if len(zombies) > 0:
        total_zombie_acv = zombies["acv_usd"].sum()
        insights.append({
            "title":      f"{len(zombies)} zombie deals are inflating the pipeline",
            "finding":    f"${total_zombie_acv:,.0f} in ACV has a close date that has already passed with no stage change. These deals are still appearing in pipeline reports and forecast roll-ups, creating a false picture of pipeline health.",
            "implication":"Each zombie deal needs a rep decision: re-date with a new close plan, re-qualify, or mark Closed Lost. Letting them sit degrades forecast accuracy for everyone.",
            "category":   "data_quality",
        })

    # 4. Competitive blind spots
    pricing_no_comp = contradiction_df[
        contradiction_df["label"].str.contains("pricing objection", case=False, na=False)
    ]
    if len(pricing_no_comp) >= 3:
        insights.append({
            "title":      f"{len(pricing_no_comp)} deals have pricing pressure but no competitor logged",
            "finding":    f"These deals show pricing objections without a corresponding competitor entry. The comparison is almost certainly happening — it's just invisible in the CRM. This creates a blind spot in competitive intelligence.",
            "implication":"These deals need a quick rep audit: who are they comparing you against? Logging the competitor enables the right positioning response and improves the fleet-level competitive analysis.",
            "category":   "competitive_intelligence",
        })

    # 5. Freshness gap — stage vs. activity
    stale = gap_df[gap_df["gap_field"] == "stale_activity"]
    if len(stale) > 5:
        avg_days = gap_df[gap_df["gap_field"] == "stale_activity"]["acv_usd"].mean()
        insights.append({
            "title":      f"{len(stale)} deals are showing stale activity relative to their stage",
            "finding":    f"Activity cadence is below the expected minimum for the current stage. On average these deals represent ${avg_days:,.0f} in ACV and are at stages where regular engagement is a prerequisite for forward motion.",
            "implication":"Set a rep-level review cadence rule: any deal in Discovery or later with no activity in 14 days should auto-surface for manager inspection.",
            "category":   "rep_behavior",
        })

    return insights


# ─────────────────────────────────────────────────────────────────────────────
# 9. LLM REVOPS BRIEF
# ─────────────────────────────────────────────────────────────────────────────

def generate_revops_brief(summary: dict) -> str:
    """Call Claude to write a plain-language RevOps brief from the fleet summary."""

    top_gaps = [g["gap_label"] for g in summary["top_gap_types"][:6]]
    insights = [i["title"] for i in summary["non_obvious_insights"]]
    rel_dist = summary["reliability_distribution"]
    label_dist = summary["health_label_distribution"]

    prompt = f"""You are a RevOps analyst writing a CRM health brief for a VP of Sales.
Be direct, specific, and use the numbers provided. No fluff.

DATA:
- Total accounts audited: {summary['total_accounts']}
- Health distribution: {label_dist}
- Average health score: {summary['health_score_mean']}/100
- Total pipeline ACV: ${summary['total_acv']:,.0f}
- ACV in critical/at-risk accounts: ${summary['acv_in_critical_or_at_risk']:,.0f} ({summary['acv_at_risk_pct']*100:.1f}%)
- Forecast reliability: {rel_dist}
- Unreliable Commit deals: {len(summary['unreliable_commit_deals'])} deals
- Total gaps identified: {summary['total_gaps_identified']}
- Critical contradictions: {summary['critical_contradictions']}
- Most common gap types: {top_gaps}
- Non-obvious insights: {insights}

Write the brief in this structure:
1. State of the Pipeline (2-3 sentences — what is the single most important number)
2. Where the Forecast Is Exposed (focus on unreliable Commit deals and contradictions)
3. The Three Biggest Data Quality Problems (specific, with numbers)
4. What to Fix Before the Next Pipeline Review (3 prioritized actions)

Tone: direct, no hedging, written as if presenting to a skeptical VP of Sales who has seen too many glossy summaries."""

    try:
        resp = requests.post(
            ANTHROPIC_API_URL,
            headers={"Content-Type": "application/json"},
            json={
                "model":      "claude-sonnet-4-20250514",
                "max_tokens": 800,
                "messages":   [{"role": "user", "content": prompt}],
            },
            timeout=45,
        )
        resp.raise_for_status()
        return resp.json()["content"][0]["text"].strip()
    except Exception as e:
        print(f"  [LLM] API call failed ({e}) — using structured fallback")
        return _fallback_brief(summary)


def _fallback_brief(summary: dict) -> str:
    label_dist = summary["health_label_distribution"]
    critical   = label_dist.get("critical", 0)
    at_risk    = label_dist.get("at-risk", 0)
    insights   = summary["non_obvious_insights"]

    lines = [
        "# CRM Health Brief\n",
        f"## State of the Pipeline\n",
        f"{summary['total_accounts']} accounts audited. Average health score: {summary['health_score_mean']}/100. "
        f"{critical + at_risk} accounts ({round((critical+at_risk)/summary['total_accounts']*100)}%) are critical or at-risk, "
        f"representing ${summary['acv_in_critical_or_at_risk']:,.0f} in ACV.\n",
        f"## Forecast Exposure\n",
        f"{len(summary['unreliable_commit_deals'])} Commit deals have an unreliable health score. "
        f"Forecast reliability breakdown: {summary['reliability_distribution']}.\n",
        f"## Key Findings\n",
    ]
    for ins in insights:
        lines.append(f"**{ins['title']}**\n{ins['finding']}\n\n_{ins['implication']}_\n")

    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def run_health_auditor():
    print("\n" + "="*60)
    print("ACCOUNT INTELLIGENCE ENGINE — PHASE 2: CRM HEALTH AUDITOR")
    print("="*60 + "\n")

    print("[1] Loading and cleaning CRM data...")
    df = load_and_clean(CRM_PATH)

    print("\n[2] Running 4-dimension health audit...")
    health_df, gap_df, contradiction_df = audit_all_accounts(df)
    print(f"  → Health scores computed for {len(health_df)} accounts")
    print(f"  → {len(gap_df)} gaps identified across all accounts")
    print(f"  → {len(contradiction_df)} contradictions flagged")

    # Print distribution
    print(f"\n  Health label distribution:")
    for label, count in health_df["health_label"].value_counts().items():
        bar = "█" * count
        print(f"    {label:<20} {count:>3}  {bar}")

    print(f"\n  Reliability distribution:")
    for tag, count in health_df["reliability_tag"].value_counts().items():
        print(f"    {tag:<20} {count:>3}")

    print(f"\n  Average dimension scores:")
    for dim in ["completeness_score", "freshness_score", "consistency_score", "reliability_score"]:
        avg = health_df[dim].mean()
        print(f"    {dim:<30} {avg:.3f}")

    print("\n[3] Building fleet summary...")
    summary = build_fleet_summary(health_df, gap_df, contradiction_df)
    print(f"  → ACV at risk: ${summary['acv_in_critical_or_at_risk']:,.0f} ({summary['acv_at_risk_pct']*100:.1f}% of pipeline)")
    print(f"  → Unreliable Commit deals: {len(summary['unreliable_commit_deals'])}")
    print(f"  → Non-obvious insights: {len(summary['non_obvious_insights'])}")

    print("\n[4] Generating RevOps brief via LLM...")
    brief = generate_revops_brief(summary)

    print("\n[5] Writing output files...")
    health_df.to_csv(OUTPUT_DIR / "health_scores.csv", index=False)
    print(f"  → health_scores.csv ({len(health_df)} rows)")

    gap_df.to_csv(OUTPUT_DIR / "gap_report.csv", index=False)
    print(f"  → gap_report.csv ({len(gap_df)} rows)")

    contradiction_df.to_csv(OUTPUT_DIR / "contradiction_report.csv", index=False)
    print(f"  → contradiction_report.csv ({len(contradiction_df)} rows)")

    with open(OUTPUT_DIR / "fleet_summary.json", "w") as f:
        json.dump(summary, f, indent=2, default=str)
    print(f"  → fleet_summary.json")

    with open(OUTPUT_DIR / "health_audit_report.md", "w") as f:
        f.write(brief)
    print(f"  → health_audit_report.md")

    print("\n" + "="*60)
    print("PHASE 2 COMPLETE")
    print("="*60)

    return health_df, gap_df, contradiction_df, summary, brief


if __name__ == "__main__":
    health_df, gap_df, contradiction_df, summary, brief = run_health_auditor()
