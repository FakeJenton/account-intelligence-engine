"""
Account Intelligence Engine — Phase 1: Mock Data Generator
===========================================================
Generates two datasets:

  crm_accounts.csv          — 200 CRM account records, deliberately messy
  external_intelligence.csv — simulated web/enrichment signals per account

Design philosophy mirrors the Deal Trajectory Engine data layer:
  - Realistic field set covering everything a mid-market SaaS CRM would hold
  - Deliberate data quality issues (nulls, stale dates, contradictions, dupes)
  - Ground truth labels for validation (injected_gap_severity)
  - External signals that fill specific CRM gaps so Phase 3 has something to synthesize
"""

import json
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from faker import Faker

fake = Faker()
random.seed(42)
np.random.seed(42)

# ─────────────────────────────────────────────
# REFERENCE TABLES
# ─────────────────────────────────────────────

SEGMENTS        = ["SMB", "Mid-Market", "Enterprise"]
INDUSTRIES      = [
    "Financial Services", "Healthcare", "Retail & E-Commerce", "Technology",
    "Manufacturing", "Logistics & Supply Chain", "Insurance", "Media & AdTech",
    "Energy & Utilities", "SaaS / Software", "Consulting", "Education"
]
REGIONS         = ["Northeast", "Southeast", "Midwest", "West Coast", "Southwest", "EMEA", "APAC"]
LEAD_SOURCES    = [
    "Outbound SDR", "Inbound - Website", "Partner Referral", "Event / Conference",
    "Executive Referral", "LinkedIn Outbound", "PLG / Free Trial", "Cold Email Sequence"
]
STAGES          = [
    "Prospecting", "Discovery", "Technical Validation",
    "Proposal Sent", "Negotiation", "Closed Won", "Closed Lost"
]
FORECAST_CATS   = ["Commit", "Best Case", "Pipeline", "Omitted"]
COMPETITORS     = [
    "Snowflake", "Databricks", "Fivetran", "dbt Labs", "Starburst",
    "Monte Carlo", "Atlan", "Alation", "Collibra", "None / Greenfield"
]
TECH_STACKS     = [
    "Snowflake + dbt + Looker", "Databricks + Tableau", "Redshift + dbt + Mode",
    "BigQuery + Looker Studio", "Azure Synapse + Power BI", "Postgres + Metabase",
    "Legacy on-prem Teradata", "Spark + Airflow + Superset", "Unknown / Not logged"
]
CHAMPION_TITLES = [
    "Data Engineer", "Senior Data Engineer", "Lead Data Engineer",
    "Analytics Engineer", "Data Platform Lead", "Head of Data Engineering",
    "Director of Data", "VP of Data", "Chief Data Officer",
    "Analytics Manager", "BI Lead", "Data Architect", "Staff Data Engineer"
]
ECONOMIC_BUYER_TITLES = [
    "VP Engineering", "CTO", "CFO", "COO", "SVP Technology",
    "Director of IT", "Head of Product", "VP Data & Analytics", "VP Operations"
]
SENIORITY_MAP = {
    "Data Engineer": "IC", "Senior Data Engineer": "IC", "Lead Data Engineer": "IC",
    "Analytics Engineer": "IC", "Staff Data Engineer": "IC",
    "Data Platform Lead": "Manager", "Head of Data Engineering": "Manager",
    "Analytics Manager": "Manager", "BI Lead": "Manager",
    "Data Architect": "IC",
    "Director of Data": "Director", "VP of Data": "VP",
    "Chief Data Officer": "C-Suite",
}
CONTRACT_TYPES  = ["Annual", "Multi-Year", "Monthly", "Pilot / POC"]

# Gap type labels — injected as ground truth for validation
GAP_TYPES = {
    "champion_blank":        "Champion name and title not logged",
    "economic_buyer_blank":  "No economic buyer identified",
    "competitive_blank":     "Competitive landscape empty despite objection signals",
    "use_case_vague":        "Use case / pain point not clearly defined",
    "exec_not_engaged":      "No executive sponsor engagement logged",
    "zombie_deal":           "Close date past with no stage change",
    "ic_champion_large_deal":"IC-level champion on high-ACV deal with no exec engagement",
    "stage_data_mismatch":   "Stage inconsistent with supporting field data",
    "stale_activity":        "No recent activity relative to stage expectations",
}

# External signal templates — filled per account in generate_external_intelligence()
NEWS_TEMPLATES = [
    "{company} raises ${amount}M Series {series} to expand data infrastructure",
    "{company} appoints new Chief Data Officer amid digital transformation push",
    "{company} announces partnership with {partner} to modernize analytics platform",
    "{company} acquires {target} to accelerate real-time data capabilities",
    "{company} reports {pct}% YoY growth, cites data platform as key differentiator",
    "{company} migrating off legacy data warehouse — {quote}",
    "{company} named to Gartner Magic Quadrant for {category}",
    "{company} CISO issues statement on data governance after audit findings",
]
JOB_TITLE_TEMPLATES = [
    "Senior Data Engineer — {stack} experience required",
    "Analytics Engineer — dbt, Snowflake, Looker",
    "Data Platform Lead — own our real-time ingestion layer",
    "Staff Engineer, Data Infrastructure — Kafka, Spark, Airflow",
    "Head of Data — build and scale our analytics team",
    "Business Intelligence Engineer — Tableau / Looker / Power BI",
    "Data Governance Lead — data quality, lineage, compliance",
    "ML Platform Engineer — feature store, model serving, monitoring",
    "VP of Data & Analytics — executive hire",
    "Data Engineer (Remote) — Python, SQL, cloud data warehousing",
]
G2_POSITIVE = [
    "Best-in-class performance on complex analytical queries",
    "Seamless integration with our existing dbt + Looker stack",
    "Support team is responsive and technically knowledgeable",
    "Dramatically reduced time-to-insight for our analytics team",
    "Easy onboarding — data engineers were productive within a week",
]
G2_NEGATIVE = [
    "Pricing gets expensive at scale — costs surprised us in month 3",
    "Documentation is thin for advanced use cases",
    "Competitor offered more native connectors for our source systems",
    "Setup required more professional services than expected",
    "Wish there was better support for real-time / streaming use cases",
]


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def jitter(val, pct=0.18):
    return round(val * (1 + random.uniform(-pct, pct)), 2)

def maybe_null(val, null_rate=0.08):
    return None if random.random() < null_rate else val

def dirty_name(name):
    variants = [
        name, name.upper(), name.lower(),
        name + ", Inc.", name + " Inc", name + " LLC",
        name + " Corp", "The " + name, name.replace(" ", ""),
    ]
    return random.choice(variants)

def messy_date(dt):
    if dt is None:
        return None
    fmts = ["%Y-%m-%d", "%m/%d/%Y", "%d-%b-%Y", "%B %d, %Y", "%m-%d-%Y"]
    return dt.strftime(random.choice(fmts))

def rand_date(days_ago_min=0, days_ago_max=365):
    days = random.randint(days_ago_min, days_ago_max)
    return datetime.today() - timedelta(days=days)

def acv_for_segment(segment):
    ranges = {"SMB": (8000, 40000), "Mid-Market": (40000, 180000), "Enterprise": (180000, 900000)}
    return round(random.uniform(*ranges[segment]), -2)


# ─────────────────────────────────────────────
# CRM ACCOUNT BUILDER
# ─────────────────────────────────────────────

def build_account(account_id, injected_gaps=None):
    """
    Build one CRM account record.
    injected_gaps: list of GAP_TYPE keys to deliberately inject into this record.
    """
    if injected_gaps is None:
        injected_gaps = []

    segment       = random.choice(SEGMENTS)
    industry      = random.choice(INDUSTRIES)
    region        = random.choice(REGIONS)
    lead_source   = random.choice(LEAD_SOURCES)
    stage         = random.choice(STAGES[:5])  # Active deals only
    competitor    = random.choice(COMPETITORS)
    tech_stack    = random.choice(TECH_STACKS)
    contract_type = random.choice(CONTRACT_TYPES)

    acv           = acv_for_segment(segment)
    discount_pct  = round(random.uniform(0, 0.25), 2) if random.random() > 0.5 else 0.0
    net_acv       = round(acv * (1 - discount_pct), -2)

    rep_name      = fake.name()
    rep_id        = f"REP-{random.randint(100,999)}"
    company_name  = fake.company()
    domain        = company_name.lower().replace(" ", "").replace(",", "")[:12] + ".com"

    champion_title    = random.choice(CHAMPION_TITLES)
    champion_seniority = SENIORITY_MAP.get(champion_title, "IC")
    econ_buyer_title  = random.choice(ECONOMIC_BUYER_TITLES)

    # Timeline
    created_date      = rand_date(30, 365)
    expected_cycle    = {"SMB": 45, "Mid-Market": 90, "Enterprise": 180}[segment]
    days_in_stage     = random.randint(3, 30)
    stage_changes     = random.randint(1, 5)
    last_activity     = rand_date(0, 25)
    last_meeting      = rand_date(0, 30)
    last_call         = rand_date(0, 20)

    # Default close date: future
    close_date = datetime.today() + timedelta(days=random.randint(14, 120))

    # Activity signals
    email_response_rate     = round(random.uniform(0.3, 0.85), 2)
    meeting_count_30d       = random.randint(1, 6)
    multithread_attempts    = random.randint(0, 5)
    total_meetings          = random.randint(2, 15)
    total_calls             = random.randint(2, 20)
    call_freq_per_week      = round(random.uniform(0.5, 3.0), 1)
    days_since_last_activity = (datetime.today() - last_activity).days
    days_since_last_meeting  = (datetime.today() - last_meeting).days

    # Process signals
    proposal_sent             = random.choice([True, False])
    technical_validation_done = random.choice([True, False])
    security_review_done      = random.choice([True, False])
    legal_review_started      = random.choice([True, False])
    next_step_defined         = random.choice([True, False])
    mutual_action_plan        = random.choice([True, False])
    exec_sponsor_engaged      = random.choice([True, True, False])
    economic_buyer_meetings   = random.randint(1, 4) if exec_sponsor_engaged else 0
    pricing_objection_raised  = random.choice([True, False])
    competitive_mentions      = random.randint(0, 3)

    # Forecast
    forecast_category = random.choice(FORECAST_CATS)

    # Intent signals
    intent_score          = maybe_null(random.randint(40, 95))
    website_visits_30d    = random.randint(1, 20)
    content_downloads     = maybe_null(random.randint(0, 8), null_rate=0.3)
    g2_profile_viewed     = maybe_null(random.choice([True, False]), null_rate=0.3)

    # Rep notes
    rep_notes = _rep_notes(stage, competitor, champion_title, injected_gaps)

    # Stated use case
    use_cases = [
        "Modernize legacy data warehouse",
        "Unify customer data for analytics",
        "Real-time pipeline for ML feature store",
        "Replace Tableau with self-serve BI",
        "Data governance and lineage for compliance",
        "Accelerate time-to-insight for product team",
        None, None  # Some are blank
    ]
    use_case = random.choice(use_cases)

    # ── Inject gap patterns ──────────────────────────────

    champion_name  = fake.name()
    economic_buyer_name = fake.name()
    competitive_notes = f"Evaluating against {competitor}" if competitor != "None / Greenfield" else ""

    if "champion_blank" in injected_gaps:
        champion_name  = None
        champion_title = None
        champion_seniority = None

    if "economic_buyer_blank" in injected_gaps:
        economic_buyer_name = None
        econ_buyer_title    = None
        exec_sponsor_engaged = False
        economic_buyer_meetings = 0

    if "competitive_blank" in injected_gaps:
        competitor         = None
        competitive_notes  = None
        competitive_mentions = 0
        # But keep pricing_objection_raised True — that's the contradiction
        pricing_objection_raised = True

    if "use_case_vague" in injected_gaps:
        use_case = random.choice(["TBD", "General data modernization", None, ""])

    if "exec_not_engaged" in injected_gaps:
        exec_sponsor_engaged     = False
        economic_buyer_meetings  = 0

    if "zombie_deal" in injected_gaps:
        # Close date in the past, stage hasn't moved
        close_date = datetime.today() - timedelta(days=random.randint(14, 90))
        last_activity = rand_date(20, 60)  # Also stale activity
        days_since_last_activity = (datetime.today() - last_activity).days

    if "ic_champion_large_deal" in injected_gaps:
        champion_title     = random.choice(["Data Engineer", "Senior Data Engineer", "Analytics Engineer"])
        champion_seniority = "IC"
        exec_sponsor_engaged     = False
        economic_buyer_meetings  = 0
        acv = round(random.uniform(250000, 900000), -2)  # Force large ACV
        net_acv = round(acv * (1 - discount_pct), -2)

    if "stage_data_mismatch" in injected_gaps:
        # Stage says advanced but supporting fields say early
        stage = random.choice(["Proposal Sent", "Negotiation"])
        proposal_sent             = False   # Contradiction
        technical_validation_done = False   # Contradiction
        forecast_category         = "Commit"
        economic_buyer_meetings   = 0       # Contradiction

    if "stale_activity" in injected_gaps:
        last_activity    = rand_date(25, 60)
        last_meeting     = rand_date(30, 75)
        meeting_count_30d = 0
        days_since_last_activity  = (datetime.today() - last_activity).days
        days_since_last_meeting   = (datetime.today() - last_meeting).days
        email_response_rate = round(random.uniform(0.05, 0.25), 2)

    # ── Assemble record ──────────────────────────────────

    return {
        # ── Identifiers ──
        "account_id":             account_id,
        "company_name":           maybe_null(dirty_name(company_name), null_rate=0.01),
        "domain":                 domain,
        "crm_account_id":         f"ACC-{random.randint(10000,99999)}",
        "opportunity_name":       maybe_null(f"{company_name} - {contract_type}"),

        # ── Ownership ──
        "rep_name":               rep_name,
        "rep_id":                 rep_id,
        "account_owner":          maybe_null(fake.name(), null_rate=0.12),
        "sdr_name":               maybe_null(fake.name(), null_rate=0.25),
        "sales_team":             random.choice(["Commercial", "Enterprise", "Strategic", "SMB"]),

        # ── Firmographic ──
        "segment":                segment,
        "industry":               industry,
        "region":                 region,
        "employee_count":         maybe_null(random.choice([50, 150, 500, 1200, 3000, 8000, 20000]), null_rate=0.15),
        "hq_location":            maybe_null(fake.city() + ", " + fake.state_abbr(), null_rate=0.1),
        "tech_stack":             maybe_null(tech_stack, null_rate=0.2),
        "engineering_team_size":  maybe_null(random.choice([5, 12, 25, 50, 100, 200, 400]), null_rate=0.3),

        # ── Deal financials ──
        "acv_usd":                acv,
        "net_acv_usd":            net_acv,
        "tcv_usd":                maybe_null(round(net_acv * random.uniform(1.0, 3.0), -2), null_rate=0.2),
        "discount_pct":           discount_pct,
        "contract_type":          contract_type,
        "budget_confirmed":       maybe_null(random.choice([True, False]), null_rate=0.2),
        "budget_range_stated":    maybe_null(random.choice(["<$50K","$50K–$150K","$150K–$500K",">$500K"]), null_rate=0.35),

        # ── Deal timeline ──
        "created_date":           messy_date(created_date),
        "close_date":             messy_date(close_date),
        "last_modified_date":     messy_date(rand_date(0, 30)),
        "days_in_current_stage":  days_in_stage,
        "stage_change_count":     stage_changes,
        "expected_cycle_days":    expected_cycle,
        "current_stage":          stage,
        "lead_source":            lead_source,

        # ── Contacts ──
        "champion_name":          maybe_null(champion_name, null_rate=0.02),
        "champion_title":         maybe_null(champion_title, null_rate=0.02),
        "champion_seniority":     maybe_null(champion_seniority, null_rate=0.02),
        "champion_tenure_yrs":    maybe_null(round(random.uniform(0.5, 10), 1), null_rate=0.25),
        "champion_linkedin":      maybe_null(f"linkedin.com/in/{fake.user_name()}", null_rate=0.4),
        "economic_buyer_name":    maybe_null(economic_buyer_name, null_rate=0.05),
        "economic_buyer_title":   maybe_null(econ_buyer_title, null_rate=0.05),
        "it_security_contact":    maybe_null(fake.name(), null_rate=0.5),
        "legal_contact":          maybe_null(fake.name(), null_rate=0.55),
        "finance_contact":        maybe_null(fake.name(), null_rate=0.5),
        "exec_sponsor_engaged":   exec_sponsor_engaged,
        "economic_buyer_meetings":economic_buyer_meetings,

        # ── Competitive ──
        "competitor_primary":     maybe_null(competitor, null_rate=0.02),
        "competitor_secondary":   maybe_null(random.choice(COMPETITORS), null_rate=0.65),
        "competitive_notes":      maybe_null(competitive_notes, null_rate=0.3),
        "competitive_mentions_count": competitive_mentions,
        "pricing_objection_raised":   pricing_objection_raised,
        "pricing_objection_count":    random.randint(1, 4) if pricing_objection_raised else 0,
        "feature_gap_flagged":        maybe_null(random.choice([True, False]), null_rate=0.15),

        # ── Activity signals ──
        "last_activity_date":         messy_date(last_activity),
        "last_meeting_date":          messy_date(last_meeting),
        "last_call_date":             messy_date(last_call),
        "days_since_last_activity":   days_since_last_activity,
        "days_since_last_meeting":    days_since_last_meeting,
        "email_response_rate":        email_response_rate,
        "meeting_count_last_30d":     meeting_count_30d,
        "total_meetings":             total_meetings,
        "total_calls":                total_calls,
        "call_frequency_per_week":    call_freq_per_week,
        "multithread_attempt_count":  multithread_attempts,
        "unique_stakeholders_engaged":random.randint(1, 6),
        "last_meeting_type":          maybe_null(random.choice(["Discovery","Demo","Technical Review","Pricing","Exec QBR","POC Review"]), null_rate=0.15),

        # ── Process milestones ──
        "proposal_sent":              proposal_sent,
        "technical_validation_done":  technical_validation_done,
        "security_review_done":       security_review_done,
        "legal_review_started":       legal_review_started,
        "procurement_engaged":        maybe_null(random.choice([True, False]), null_rate=0.2),
        "sow_sent":                   maybe_null(random.choice([True, False]), null_rate=0.25),
        "next_step_defined":          next_step_defined,
        "mutual_action_plan":         mutual_action_plan,

        # ── Intent & product signals ──
        "intent_score":               intent_score,
        "website_visits_30d":         website_visits_30d,
        "content_downloads_count":    content_downloads,
        "g2_profile_viewed":          g2_profile_viewed,
        "product_trial_active":       maybe_null(random.choice([True, False]), null_rate=0.2),
        "trial_feature_adoption":     maybe_null(random.randint(20, 100), null_rate=0.45),
        "open_support_tickets":       random.randint(0, 3),

        # ── Qualitative / free text ──
        "use_case":                   use_case,
        "pain_point_stated":          maybe_null(_pain_point(industry, use_case), null_rate=0.25),
        "rep_notes":                  rep_notes,
        "last_call_notes":            maybe_null(fake.sentence(nb_words=16), null_rate=0.3),
        "forecast_category":          forecast_category,
        "nps_score":                  maybe_null(random.randint(5, 10), null_rate=0.4),

        # ── Ground truth labels (for validation only) ──
        "injected_gaps":              json.dumps(injected_gaps) if injected_gaps else None,
        "gap_count":                  len(injected_gaps),
        "primary_gap_type":           injected_gaps[0] if injected_gaps else None,
    }


def _pain_point(industry, use_case):
    templates = {
        "Financial Services":       "Fragmented data across trading, risk, and compliance systems slowing regulatory reporting",
        "Healthcare":               "Patient data siloed across EMR systems — no unified view for population health analytics",
        "Retail & E-Commerce":      "Can't connect online and offline customer data fast enough for personalization",
        "Technology":               "Data pipelines brittle and slow — product analytics lagging by 24+ hours",
        "Manufacturing":            "Operational data locked in on-prem ERPs — no visibility into real-time production KPIs",
        "SaaS / Software":          "Growing data volume making current warehouse cost and latency unsustainable",
        "Logistics & Supply Chain": "No real-time visibility into shipment status and delay prediction",
        "Insurance":                "Actuarial models running on stale data — claims data refresh takes 48 hours",
    }
    return templates.get(industry, use_case or "Data infrastructure modernization")


def _rep_notes(stage, competitor, champion_title, injected_gaps):
    base_notes = [
        f"Strong champion engagement. {champion_title or 'Contact'} is technically deep and internal advocate.",
        f"Evaluating against {competitor}. Price sensitivity moderate. Technical fit is strong.",
        "Moved quickly through discovery. Use case is clear. Next step is technical validation.",
        "Exec engagement pending. Champion is supportive but can't sign alone.",
        "Good call last week. They're under pressure to modernize before Q4.",
        "Slowing down — less responsive than 2 weeks ago. Following up.",
        "POC went well. Waiting on security review sign-off.",
        "Legal redlines received. Should close this month.",
        f"Competed hard against Snowflake. Champion prefers our approach.",
        "Deal stalled. Champion went quiet. May have internal reorganization.",
        None,
        "",
    ]
    note = random.choice(base_notes)
    # Introduce typos and casual formatting ~20%
    if note and random.random() < 0.2:
        note = note.replace(".", "..").lower().replace(" the ", " teh ")
    return note


# ─────────────────────────────────────────────
# EXTERNAL INTELLIGENCE BUILDER
# ─────────────────────────────────────────────

def build_external_intelligence(account_id, company_name, industry, segment,
                                 injected_gaps, acv):
    """
    Simulates what a web scraping + enrichment layer would return for an account.
    Structured to fill specific CRM gaps identified in the health audit.
    """
    domain = company_name.lower().replace(" ", "").replace(",", "")[:12] + ".com"

    # News signals
    news_count = random.randint(1, 3)
    news_items = []
    for _ in range(news_count):
        template = random.choice(NEWS_TEMPLATES)
        news_item = template.format(
            company=company_name,
            amount=random.choice([15, 30, 50, 75, 120, 200]),
            series=random.choice(["A", "B", "C", "D"]),
            partner=random.choice(["AWS", "Google Cloud", "Databricks", "Snowflake", "dbt Labs"]),
            target=fake.company(),
            pct=random.randint(18, 65),
            quote='"We needed a more scalable foundation," says CTO.',
            category=random.choice(["Analytics Platforms", "Cloud Data Warehousing", "Data Integration"])
        )
        days_ago = random.randint(1, 120)
        news_items.append({
            "headline": news_item,
            "date":     (datetime.today() - timedelta(days=days_ago)).strftime("%Y-%m-%d"),
            "source":   random.choice(["TechCrunch", "VentureBeat", "Business Wire", "PR Newswire", "The Information"]),
        })

    # Job postings
    job_count = random.randint(2, 5)
    job_postings = []
    for _ in range(job_count):
        title = random.choice(JOB_TITLE_TEMPLATES).format(
            stack=random.choice(["Snowflake", "dbt", "Spark", "Kafka"])
        )
        job_postings.append({
            "title":    title,
            "posted":   (datetime.today() - timedelta(days=random.randint(1, 45))).strftime("%Y-%m-%d"),
            "platform": random.choice(["LinkedIn", "Greenhouse", "Lever", "Indeed", "Wellfound"]),
        })

    # Infer tech stack from job titles
    inferred_stack = _infer_stack_from_jobs(job_postings)

    # Likely champion candidates (for champion_blank gap)
    likely_champions = []
    if "champion_blank" in (injected_gaps or []) or random.random() < 0.4:
        for _ in range(random.randint(2, 4)):
            title = random.choice(CHAMPION_TITLES)
            likely_champions.append({
                "inferred_name":    fake.name(),
                "title":            title,
                "seniority":        SENIORITY_MAP.get(title, "IC"),
                "linkedin_signal":  f"linkedin.com/in/{fake.user_name()}",
                "confidence":       random.choice(["inferred-strong", "inferred-weak"]),
                "signal_source":    random.choice(["LinkedIn job posting", "GitHub commits", "Conference speaker listing", "Engineering blog authorship"]),
            })

    # Likely exec contacts (for exec/econ buyer gaps)
    likely_execs = []
    if "economic_buyer_blank" in (injected_gaps or []) or "exec_not_engaged" in (injected_gaps or []) or random.random() < 0.35:
        for title in random.sample(ECONOMIC_BUYER_TITLES, k=random.randint(1, 3)):
            likely_execs.append({
                "inferred_name":  fake.name(),
                "title":          title,
                "linkedin_signal":f"linkedin.com/in/{fake.user_name()}",
                "confidence":     "inferred-weak",
                "signal_source":  random.choice(["LinkedIn company page", "Crunchbase", "Press release", "Conference bio"]),
            })

    # Competitive signals (for competitive_blank gap)
    competitor_signals = []
    if "competitive_blank" in (injected_gaps or []) or random.random() < 0.4:
        for comp in random.sample(COMPETITORS[:8], k=random.randint(1, 3)):
            competitor_signals.append({
                "competitor":      comp,
                "signal_type":     random.choice(["Job posting mentions incumbent", "G2 review comparison", "Conference co-presenter", "Integration partner listing"]),
                "confidence":      random.choice(["inferred-strong", "inferred-weak"]),
                "detail":          f"Recent job posting at {company_name} listed {comp} experience as preferred",
            })

    # Use case inference (for use_case_vague gap)
    use_case_inference = None
    if "use_case_vague" in (injected_gaps or []) or random.random() < 0.3:
        use_case_inference = {
            "inferred_use_case":  _infer_use_case(industry, job_postings, inferred_stack),
            "confidence":         random.choice(["inferred-strong", "inferred-weak"]),
            "signal_sources":     ["job posting analysis", "industry pattern", "tech stack signals"],
        }

    # G2 signals
    g2_signals = {
        "positive_themes": random.sample(G2_POSITIVE, k=random.randint(1, 3)),
        "negative_themes": random.sample(G2_NEGATIVE, k=random.randint(1, 2)),
        "avg_rating":      round(random.uniform(3.8, 4.8), 1),
        "review_count":    random.randint(12, 340),
    }

    # Funding / growth signals
    funding_event = None
    if random.random() < 0.25:
        funding_event = {
            "type":   random.choice(["Series A", "Series B", "Series C", "Series D", "IPO", "Acquisition"]),
            "amount": f"${random.choice([15, 30, 50, 75, 120, 250, 500])}M",
            "date":   (datetime.today() - timedelta(days=random.randint(30, 365))).strftime("%Y-%m-%d"),
            "implication": "Post-funding data infrastructure investment likely — good time to engage",
        }

    # Pre-call angle (synthesized)
    pre_call_angle = _generate_pre_call_angle(
        industry, segment, inferred_stack, job_postings,
        funding_event, competitor_signals, injected_gaps or []
    )

    return {
        "account_id":             account_id,
        "company_name":           company_name,
        "domain":                 domain,
        "data_freshness_date":    datetime.today().strftime("%Y-%m-%d"),

        # News
        "news_count":             news_count,
        "news_items":             json.dumps(news_items),
        "latest_news_headline":   news_items[0]["headline"] if news_items else None,
        "latest_news_date":       news_items[0]["date"] if news_items else None,

        # Jobs
        "open_job_count":         job_count,
        "job_postings":           json.dumps(job_postings),
        "data_roles_open":        sum(1 for j in job_postings if any(
            kw in j["title"].lower() for kw in ["data", "analytics", "engineer", "ml"]
        )),

        # Tech stack
        "inferred_tech_stack":    json.dumps(inferred_stack),
        "tech_stack_confidence":  random.choice(["inferred-strong", "inferred-weak", "unverified"]),

        # People signals
        "likely_champions":       json.dumps(likely_champions),
        "champion_count_inferred":len(likely_champions),
        "likely_execs":           json.dumps(likely_execs),
        "exec_count_inferred":    len(likely_execs),

        # Competitive
        "competitor_signals":     json.dumps(competitor_signals),
        "competitor_count_inferred": len(competitor_signals),

        # Use case
        "use_case_inference":     json.dumps(use_case_inference) if use_case_inference else None,

        # G2
        "g2_signals":             json.dumps(g2_signals),
        "g2_avg_rating":          g2_signals["avg_rating"],

        # Funding
        "funding_event":          json.dumps(funding_event) if funding_event else None,
        "funding_detected":       bool(funding_event),

        # Pre-call angle
        "pre_call_angle":         pre_call_angle,
        "pre_call_confidence":    random.choice(["inferred-strong", "inferred-weak"]),

        # Gaps this record specifically fills
        "gaps_addressed":         json.dumps([
            g for g in (injected_gaps or []) if g in [
                "champion_blank", "economic_buyer_blank",
                "competitive_blank", "use_case_vague", "exec_not_engaged"
            ]
        ]),
    }


def _infer_stack_from_jobs(job_postings):
    stack_signals = []
    keywords = {
        "Snowflake": ["snowflake"],
        "dbt": ["dbt", "analytics engineer"],
        "Databricks": ["databricks", "spark", "delta lake"],
        "Kafka": ["kafka", "real-time", "streaming"],
        "Airflow": ["airflow", "orchestration"],
        "Looker": ["looker"],
        "Tableau": ["tableau"],
        "dbt + Snowflake": ["dbt", "snowflake"],
        "BigQuery": ["bigquery", "bq"],
        "Redshift": ["redshift"],
    }
    all_titles = " ".join(j["title"].lower() for j in job_postings)
    for tool, kws in keywords.items():
        if any(kw in all_titles for kw in kws):
            stack_signals.append(tool)
    return stack_signals or ["Unknown — insufficient signal"]


def _infer_use_case(industry, job_postings, inferred_stack):
    job_titles = " ".join(j["title"].lower() for j in job_postings)
    if "real-time" in job_titles or "streaming" in job_titles or "kafka" in job_titles:
        return "Real-time data pipeline and streaming analytics modernization"
    if "governance" in job_titles or "lineage" in job_titles:
        return "Data governance, lineage, and compliance readiness"
    if "ml" in job_titles or "feature" in job_titles or "model" in job_titles:
        return "ML platform buildout — feature store, model serving, and monitoring"
    industry_map = {
        "Financial Services":   "Unified data platform for risk, trading, and compliance reporting",
        "Healthcare":           "Patient data unification and population health analytics",
        "Retail & E-Commerce":  "Customer 360 and real-time personalization infrastructure",
        "Technology":           "Scalable analytical infrastructure to replace legacy warehouse",
        "SaaS / Software":      "Product analytics and customer health scoring at scale",
    }
    return industry_map.get(industry, "Data infrastructure modernization and analytics acceleration")


def _generate_pre_call_angle(industry, segment, inferred_stack, job_postings,
                               funding_event, competitor_signals, injected_gaps):
    angles = []
    if funding_event:
        angles.append(
            f"Lead with post-{funding_event['type']} infrastructure scaling — "
            f"companies at this stage typically face data volume 3–5x in 18 months "
            f"and their current stack wasn't built for it."
        )
    if "dbt" in str(inferred_stack) or "analytics engineer" in " ".join(j["title"].lower() for j in job_postings):
        angles.append(
            "They're building an analytics engineering practice — "
            "lead with the dbt + native integration story and how we accelerate "
            "the transition from raw data to reliable metrics."
        )
    if competitor_signals:
        comp = competitor_signals[0]["competitor"]
        angles.append(
            f"Likely evaluating {comp} — come prepared with the specific "
            f"differentiation on [query performance / governance / cost at scale] "
            f"and have the champion success story from a comparable {industry} account ready."
        )
    if not angles:
        industry_angles = {
            "Financial Services": "Lead with compliance and audit-readiness — regulatory data lineage is a hard requirement, not a nice-to-have.",
            "Healthcare":         "Lead with the patient data unification story — interoperability pressure from CMS is creating urgency.",
            "Retail & E-Commerce":"Lead with real-time personalization latency — their current batch pipeline is a competitive disadvantage.",
            "SaaS / Software":    "Lead with the product analytics scalability story — their warehouse costs are probably growing faster than revenue.",
        }
        angles.append(industry_angles.get(industry, "Lead with the data reliability and time-to-insight story for the {industry} segment."))

    return angles[0] if angles else "Research further before outreach."


# ─────────────────────────────────────────────
# DATASET GENERATORS
# ─────────────────────────────────────────────

def generate_crm_accounts(n=200):
    """Generate n CRM account records with a realistic mix of gap patterns."""

    # Gap distribution — realistic for a mid-market SaaS CRM
    gap_distribution = []
    gap_types = list(GAP_TYPES.keys())

    for i in range(n):
        # ~35% of accounts are clean (no injected gaps)
        if random.random() < 0.35:
            gap_distribution.append([])
            continue

        # ~40% have one gap
        # ~20% have two gaps
        # ~5% have three+ gaps (the real problem accounts)
        r = random.random()
        if r < 0.5:
            num_gaps = 1
        elif r < 0.85:
            num_gaps = 2
        else:
            num_gaps = random.randint(3, 4)

        # Weighted gap selection — some gaps are more common than others
        weights = {
            "champion_blank":        0.20,
            "economic_buyer_blank":  0.18,
            "exec_not_engaged":      0.16,
            "use_case_vague":        0.15,
            "stale_activity":        0.12,
            "competitive_blank":     0.10,
            "zombie_deal":           0.05,
            "ic_champion_large_deal":0.02,
            "stage_data_mismatch":   0.02,
        }
        w_keys   = list(weights.keys())
        w_values = list(weights.values())
        selected = random.choices(w_keys, weights=w_values, k=min(num_gaps, len(w_keys)))
        gap_distribution.append(list(set(selected)))

    records = []
    for i, gaps in enumerate(gap_distribution):
        acc_id = f"ACC-{2000 + i}"
        rec = build_account(acc_id, injected_gaps=gaps)
        records.append(rec)

    df = pd.DataFrame(records)

    # Post-generation data quality noise
    # 1. Duplicate ~3% of rows with minor variations
    bool_cols = df.select_dtypes(include="bool").columns.tolist()
    df[bool_cols] = df[bool_cols].astype(object)
    dup_idx = random.sample(range(len(df)), k=max(1, int(len(df) * 0.03)))
    dups = df.iloc[dup_idx].copy()
    dups["account_id"]   = dups["account_id"] + "-DUP"
    dups["company_name"] = dups["company_name"].apply(
        lambda x: dirty_name(str(x)) if x else x
    )
    df = pd.concat([df, dups], ignore_index=True)

    # 2. Random blank-out on a few rows
    for _ in range(int(len(df) * 0.015)):
        blank_idx = random.randint(0, len(df) - 1)
        for col in random.sample(df.columns.tolist(), k=random.randint(6, 12)):
            df.at[blank_idx, col] = None

    return df.sample(frac=1, random_state=42).reset_index(drop=True)


def generate_external_intelligence(crm_df):
    """
    Generate one external intelligence record per non-duplicate CRM account.
    """
    clean = crm_df[~crm_df["account_id"].astype(str).str.endswith("-DUP")].copy()
    records = []

    for _, row in clean.iterrows():
        raw_gaps = row["injected_gaps"]
        gaps = json.loads(raw_gaps) if (isinstance(raw_gaps, str) and raw_gaps) else []
        rec  = build_external_intelligence(
            account_id   = row["account_id"],
            company_name = str(row["company_name"] or fake.company()),
            industry     = str(row["industry"] or "Technology"),
            segment      = str(row["segment"] or "Mid-Market"),
            injected_gaps= gaps,
            acv          = float(row["acv_usd"] or 50000),
        )
        records.append(rec)

    return pd.DataFrame(records)


def generate_metadata(crm_df, ext_df):
    gap_counts = crm_df["primary_gap_type"].value_counts(dropna=True).to_dict()
    return {
        "generated_at":   datetime.today().strftime("%Y-%m-%d %H:%M:%S"),
        "generated_by":   "Account Intelligence Engine — Phase 1 v1.0",
        "note":           "All data is synthetic. Deliberately imperfect: duplicates, mixed date formats, nulls, and injected CRM gap patterns with corresponding external intelligence to fill them.",
        "datasets": {
            "crm_accounts.csv": {
                "rows_approx":     200,
                "fields":          len(crm_df.columns),
                "gap_distribution":gap_counts,
                "clean_accounts":  int((crm_df["gap_count"] == 0).sum()),
                "known_issues":    [
                    "~3% duplicate account IDs (suffixed -DUP)",
                    "~8% null rate on most fields, higher on contact and competitive fields",
                    "Mixed date formats: YYYY-MM-DD, MM/DD/YYYY, DD-Mon-YYYY, Month DD YYYY",
                    "Inconsistent company_name formatting (casing, suffixes)",
                    "~5% of deals: close_date in the past with no stage change (zombie_deal gap)",
                    "~10% of deals: stage_data_mismatch — e.g., Proposal Sent but proposal_sent = False",
                    "~18% of deals: economic_buyer blank or exec not engaged",
                    "~20% of deals: champion_blank — champion name or title missing",
                ]
            },
            "external_intelligence.csv": {
                "rows_approx":  200,
                "fields":       len(ext_df.columns),
                "purpose":      "Simulated web/enrichment signals. Structured to fill specific CRM gaps. In production these come from news APIs, LinkedIn, job boards, G2, and GitHub.",
                "confidence_levels": {
                    "CRM-confirmed":   "Exists in CRM and recently updated",
                    "inferred-strong": "Derived from 2+ external signals that agree",
                    "inferred-weak":   "Derived from a single or indirect signal",
                    "unverified":      "LLM-inferred from industry/segment patterns",
                }
            }
        },
        "gap_types":        GAP_TYPES,
        "field_notes": {
            "injected_gaps":      "Ground truth label — which gaps were injected. Use for validation only, not as a model input.",
            "primary_gap_type":   "First/dominant gap type for this account.",
            "gap_count":          "Total number of injected gaps. 0 = clean account.",
            "gaps_addressed":     "External intelligence field — which CRM gaps this record specifically fills.",
            "pre_call_angle":     "Synthesized first-touch angle based on all available signals.",
        }
    }


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import os
    out_dir = "/home/claude/account-intelligence-engine"
    os.makedirs(out_dir, exist_ok=True)

    print("="*60)
    print("ACCOUNT INTELLIGENCE ENGINE — PHASE 1: DATA GENERATION")
    print("="*60)

    print("\n[1] Generating CRM accounts...")
    crm_df = generate_crm_accounts(n=200)
    crm_df.to_csv(f"{out_dir}/crm_accounts.csv", index=False)
    print(f"  → {len(crm_df)} rows, {len(crm_df.columns)} fields")
    print(f"  → Clean accounts (no gaps): {int((crm_df['gap_count']==0).sum())}")
    print(f"  → Accounts with gaps: {int((crm_df['gap_count']>0).sum())}")
    print(f"  → Gap distribution:")
    for gap, count in crm_df['primary_gap_type'].value_counts(dropna=True).items():
        print(f"       {gap:<35} {count}")

    print("\n[2] Generating external intelligence signals...")
    ext_df = generate_external_intelligence(crm_df)
    ext_df.to_csv(f"{out_dir}/external_intelligence.csv", index=False)
    print(f"  → {len(ext_df)} rows, {len(ext_df.columns)} fields")
    print(f"  → Accounts with funding events detected: {ext_df['funding_detected'].sum()}")
    print(f"  → Avg open data roles per account: {ext_df['data_roles_open'].mean():.1f}")
    print(f"  → Accounts with inferred champion: {(ext_df['champion_count_inferred']>0).sum()}")
    print(f"  → Accounts with competitor signals: {(ext_df['competitor_count_inferred']>0).sum()}")

    print("\n[3] Writing metadata...")
    meta = generate_metadata(crm_df, ext_df)
    with open(f"{out_dir}/data_metadata.json", "w") as f:
        json.dump(meta, f, indent=2)
    print("  → data_metadata.json written")

    print("\n[4] Field inventory:")
    print(f"  → crm_accounts.csv: {len(crm_df.columns)} fields")
    for col in crm_df.columns:
        null_pct = round(crm_df[col].isna().mean() * 100, 1)
        print(f"       {col:<45} {null_pct}% null")

    print("\n" + "="*60)
    print("PHASE 1 COMPLETE")
    print("="*60)
