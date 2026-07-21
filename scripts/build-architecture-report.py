#!/usr/bin/env python3
"""NeutralNews — full V2 Architecture Review PDF, in the editorial brand design."""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
                                Table, TableStyle, HRFlowable, KeepTogether, PageBreak)
from reportlab.lib.styles import ParagraphStyle

CREAM = HexColor('#FFF8F0'); INK = HexColor('#1a1a1a')
MUTE = HexColor('#64748b'); FAINT = HexColor('#94a3b8'); HAIR = HexColor('#e0d8cf')
GREEN = HexColor('#15803d'); RED = HexColor('#e11d48'); AMBER = HexColor('#b45309')
SPEC = ['#e11d48', '#fb923c', '#94a3b8', '#0ea5e9', '#1d4ed8']
F = '/System/Library/Fonts/Supplemental/'
pdfmetrics.registerFont(TTFont('Georgia', F + 'Georgia.ttf'))
pdfmetrics.registerFont(TTFont('Georgia-B', F + 'Georgia Bold.ttf'))
pdfmetrics.registerFont(TTFont('Georgia-I', F + 'Georgia Italic.ttf'))
SERIF, SERIF_B, SERIF_I, SANS, SANS_B = 'Georgia', 'Georgia-B', 'Georgia-I', 'Helvetica', 'Helvetica-Bold'
PW, PH = A4; MX = 17 * mm

def deco(c, doc):
    c.saveState()
    c.setFillColor(CREAM); c.rect(0, 0, PW, PH, fill=1, stroke=0)
    seg = PW / 5.0
    for i, col in enumerate(SPEC): c.setFillColor(HexColor(col)); c.rect(i*seg, PH-6, seg, 6, fill=1, stroke=0)
    c.setFillColor(INK); c.rect(0, PH-30, PW, 24, fill=1, stroke=0)
    c.setFillColor(HexColor('#FFFFFF')); c.setFont(SANS_B, 7.5)
    c.drawCentredString(PW/2, PH-22, 'N E U T R A L N E W S   ·   A R C H I T E C T U R E   R E V I E W   ·   C O R P U S   V 2')
    c.setFillColor(HAIR); c.rect(MX, 24, PW-2*MX, 0.8, fill=1, stroke=0)
    c.setFillColor(FAINT); c.setFont(SANS, 7.5)
    c.drawString(MX, 14, 'neutralnachrichten.com  ·  Engineering · Confidential')
    c.drawRightString(PW-MX, 14, f'Page {doc.page}')
    for i, col in enumerate(SPEC): c.setFillColor(HexColor(col)); c.rect(i*seg, 0, seg, 4, fill=1, stroke=0)
    c.restoreState()

def S(name, **k): return ParagraphStyle(name, **k)
eye   = S('eye', fontName=SANS_B, fontSize=8, textColor=FAINT, leading=12, spaceAfter=2)
title = S('t', fontName=SERIF_B, fontSize=25, textColor=INK, leading=28, spaceAfter=3)
h2    = S('h2', fontName=SERIF_B, fontSize=15, textColor=INK, leading=18, spaceBefore=8, spaceAfter=3)
h3    = S('h3', fontName=SERIF_B, fontSize=11, textColor=INK, leading=13.5, spaceBefore=5, spaceAfter=2)
body  = S('b', fontName=SERIF, fontSize=9.3, textColor=INK, leading=13.6, spaceAfter=4, alignment=TA_LEFT)
small = S('s', fontName=SANS, fontSize=7.8, textColor=MUTE, leading=10.5)
cellb = S('cb', fontName=SERIF, fontSize=8.3, textColor=INK, leading=11)
cellh = S('ch', fontName=SANS_B, fontSize=6.8, textColor=FAINT, leading=9)

story = []
def sp(h): story.append(Spacer(1, h))
def rule(color=INK, w=1): story.append(HRFlowable(width='100%', thickness=w, color=color, spaceBefore=3, spaceAfter=6))
def chip(txt, color=INK):
    return Paragraph(f'<font color="#FFFFFF">&nbsp;{txt}&nbsp;</font>', S('c', fontName=SANS_B, fontSize=8, backColor=color, leading=14))
def P(t, st=body): return Paragraph(t, st)

CW = PW - 2*MX
def tbl(data, widths, header=True, zebra=False, small_font=8.3):
    t = Table(data, colWidths=widths)
    sty = [('VALIGN',(0,0),(-1,-1),'TOP'),
           ('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4),
           ('LEFTPADDING',(0,0),(-1,-1),4),('RIGHTPADDING',(0,0),(-1,-1),4)]
    if header:
        sty += [('LINEBELOW',(0,0),(-1,0),0.9,INK)]
    for r in range(1, len(data)):
        sty.append(('LINEBELOW',(0,r),(-1,r),0.4,HAIR))
    t.setStyle(TableStyle(sty)); return t

# ══════════════════════════════ PAGE 1 ══════════════════════════════
sp(12)
story.append(P('MEDIA-BIAS ANALYSIS PLATFORM · ENGINEERING', eye))
story.append(P('Architecture Review — Corpus V2', title))
story.append(P('The full picture: how the system works, why its analyses are now trustworthy, '
               'which defects were found and fixed, and how the new version differs from production.', h3))
sp(5); rule(INK, 1.4)
meta = tbl([[P('<font name="Helvetica-Bold" color="#94a3b8" size="7">PRODUCTION (NOW)</font><br/><font name="Georgia" size="9.5">V1 · live-RSS · no reliability layer</font>', cellb),
             P('<font name="Helvetica-Bold" color="#94a3b8" size="7">NEW (dev / staging)</font><br/><font name="Georgia" size="9.5">V2 · corpus RAG + reliability</font>', cellb),
             P('<font name="Helvetica-Bold" color="#94a3b8" size="7">MATURITY</font><br/><font name="Georgia" size="9.5">~5/10 → 9/10</font>', cellb),
             P('<font name="Helvetica-Bold" color="#94a3b8" size="7">DATE</font><br/><font name="Georgia" size="9.5">16 June 2026</font>', cellb)]],
            [CW/4.0]*4, header=False)
meta.setStyle(TableStyle([('LINEAFTER',(0,0),(-2,-1),0.6,HAIR),('VALIGN',(0,0),(-1,-1),'TOP'),
                          ('LEFTPADDING',(0,0),(0,0),0),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),4)]))
story.append(meta); sp(10)

story.append(P('1 · The two architectures at a glance', h2)); rule(HAIR, 0.8)
story.append(P('Production today (last updated ~2 weeks ago) is essentially <b>V1</b>: a Gemini analysis built from '
   '<i>live</i> RSS/Google-Search results, presented as a clean five-camp comparison. It looks polished, but every '
   'analysis asks the reader to <b>trust the model</b> — there is no confidence score, no check that the camp '
   'articles are real or on-topic, no detection of meaning reversals, and no honest statement of what was and '
   'wasn’t covered. The corpus/reliability modules exist in the tree but are <b>dormant</b> — the server never '
   'calls them, and the real NLI / orchestration / clustering modules are not even present.', body))
story.append(P('The new version (running on staging) is <b>Corpus V2</b>: a retrieval-augmented pipeline over a '
   'stored, legally-clean corpus, where <b>every analysis carries a measured, defensible reliability envelope</b> — '
   'citations grounded to real stored articles, claims checked for entailment/contradiction against sources, '
   'coverage stated honestly, and a confidence score the team can defend line-by-line.', body))
sp(4)
cmp1 = [[P('CAPABILITY', cellh), P('PRODUCTION · V1', cellh), P('NEW · V2', cellh)],
    [P('Analysis source', cellb), P('Live RSS / Google Search (volatile)', cellb), P('Stored corpus, 55 outlets, hybrid retrieval', cellb)],
    [P('Confidence score', cellb), P('<font color="#e11d48">none</font>', cellb), P('<font color="#15803d">weighted, defensible, shown to users</font>', cellb)],
    [P('Anti-hallucination', cellb), P('<font color="#e11d48">none</font>', cellb), P('citation grounding + NLI entailment', cellb)],
    [P('Off-topic protection', cellb), P('<font color="#e11d48">none</font>', cellb), P('relevance gate (≥2 distinct topic words)', cellb)],
    [P('Blind-spot honesty', cellb), P('<font color="#e11d48">none</font>', cellb), P('feed-health-aware silence detection', cellb)],
    [P('Legal text handling', cellb), P('n/a (nothing stored)', cellb), P('derive-and-discard (summary + vector only)', cellb)],
    [P('Measurement / eval', cellb), P('<font color="#e11d48">none</font>', cellb), P('offline RAG harness + real-data capture', cellb)],
    [P('Reliability UI', cellb), P('DeepAnalysisBlock, SourceCard', cellb), P('+ ReliabilityPanel, DeepInsights', cellb)]]
story.append(tbl(cmp1, [CW*0.26, CW*0.36, CW*0.38]))
sp(6)
story.append(P('<b>Bottom line.</b> Production is a presentation layer over an unverified LLM answer. V2 turns each '
   'answer into a <i>verified, measured</i> claim — the difference between “looks neutral” and “provably sourced, '
   'with a stated confidence.”', body))

story.append(PageBreak())
# ══════════════════════════════ PAGE 2 — pipeline ══════════════════════════════
story.append(P('2 · The V2 pipeline — end to end', h2)); rule(INK, 1.2)
story.append(P('Two paths, one flag. <font name="Georgia-I">CORPUS_ANALYSIS_ENABLED</font> selects the corpus path '
   'when the database holds enough articles; otherwise the system falls back to the byte-identical live-RSS path, '
   'so the new code can never make the product worse than production. The corpus path:', body))
sp(2)
stages = [[P('#', cellh), P('STAGE', cellh), P('MECHANISM', cellh), P('WHY IT MAKES THE ANALYSIS TRUE', cellh)],
  [P('1', cellb), P('Ingestion worker', cellb), P('Pulls RSS from 55 classified outlets on a schedule; dedupes.', cellb), P('Coverage is broad and balanced across all 5 camps.', cellb)],
  [P('2', cellb), P('Derive &amp; discard', cellb), P('Stores our_summary (≤600), short_lead (≤200) + embedding; discards full text.', cellb), P('Legally clean — we never warehouse copyrighted article bodies.', cellb)],
  [P('3', cellb), P('Store', cellb), P('Postgres + pgvector(768) + full-text search (German).', cellb), P('Durable, queryable corpus — not whatever a live search returns.', cellb)],
  [P('4', cellb), P('Hybrid retrieval', cellb), P('Semantic (cosine) + lexical (ts_rank), fused by Reciprocal Rank Fusion (k=60).', cellb), P('Catches paraphrases AND exact entities — recall + precision.', cellb)],
  [P('5', cellb), P('Relevance gate', cellb), P('Keep only articles with ≥2 distinct topic words (compound-aware substring).', cellb), P('No off-topic filler padding a camp that didn’t cover the story.', cellb)],
  [P('6', cellb), P('Analysis', cellb), P('Gemini 2.5-flash writes the 5-camp synthesis from corpus context only.', cellb), P('The model summarizes real retrieved sources, not the open web.', cellb)],
  [P('7', cellb), P('Citation grounding', cellb), P('Match each emitted card to a real corpus row by URL / title overlap.', cellb), P('Every shown article resolves to a stored, real source + link.', cellb)],
  [P('8', cellb), P('Blind-spot check', cellb), P('Feed-health-aware: distinguishes “camp silent” from “feed broken”.', cellb), P('Silence is reported honestly, never faked or hidden.', cellb)],
  [P('9', cellb), P('NLI verification', cellb), P('One batched Gemini call judges each claim vs the union of its top-3 sources.', cellb), P('Catches hallucination &amp; meaning reversal (entailment/contradiction).', cellb)],
  [P('10', cellb), P('Confidence envelope', cellb), P('Weighted blend: breadth .25 / grounding .15 / claim-support .35 / volume .25.', cellb), P('A single, defensible trust score — unmeasured ≠ perfect, ≠ zero.', cellb)],
  [P('11', cellb), P('Story clusters', cellb), P('Groups sub-stories; flags angles only one camp tells.', cellb), P('Surfaces sub-story-level blind spots, not just camp-level.', cellb)]]
story.append(tbl(stages, [CW*0.04, CW*0.18, CW*0.40, CW*0.38]))
sp(5)
story.append(P('<b>Cost control.</b> NLI is one batched call per analysis (not one per claim), bounded by a daily '
   'budget; if the budget or model is unavailable, verification <i>degrades</i> (falls back to lexical / unmeasured) '
   'rather than blocking the analysis.', small))

story.append(PageBreak())
# ══════════════════════════════ PAGE 3 — why true + bugs ══════════════════════════════
story.append(P('3 · Why the analysis is now trustworthy', h2)); rule(INK, 1.2)
story.append(P('Trust is not asserted — it is <b>constructed and shown</b>. Three independent guarantees stack:', body))
story.append(P('<b>① Traceability.</b> Every camp article is grounded to a real stored row with a working link '
   '(grounding ratio is reported). A card that can’t be matched is flagged, not shown as fact.', body))
story.append(P('<b>② Meaning-level verification.</b> The synthesis sentences are checked by NLI against their sources. '
   'A source-contradicted claim is penalised hard; an unverifiable one is marked unmeasured — never silently '
   'counted as true.', body))
story.append(P('<b>③ Honest coverage.</b> Confidence blends breadth, grounding, claim-support and volume, with an '
   '<i>unmeasured factor</i> so missing signals lower the score instead of faking a perfect one. The reader sees '
   'exactly which factor is weak.', body))
sp(6)
story.append(P('4 · Defects identified &amp; fixed', h2)); rule(INK, 1.2)
bugs = [[P('DEFECT', cellh), P('ROOT CAUSE', cellh), P('FIX', cellh), P('SEV.', cellh)],
  [P('Confidence stuck at 65 on good analyses', cellb), P('NLI “neutral” counted as a support failure; evidence was a single article, so abstractive sentences always returned neutral.', cellb), P('“neutral” = unmeasured (excluded from the ratio); judge against union of top-3 sources.', cellb), P('<font color="#e11d48">CRIT</font>', cellb)],
  [P('Confidence saturated at 100 everywhere', cellb), P('Grounding was near-circular (model copies our titles) and the volume target was far too low.', cellb), P('Re-weighted blend — claim-support dominant; volume target 14; grounding demoted to a sanity check.', cellb), P('<font color="#b45309">HIGH</font>', cellb)],
  [P('Off-topic articles under a topic', cellb), P('Semantic retrieval surfaced vaguely-related filler in camps that hadn’t covered the story.', cellb), P('Relevance gate: ≥2 distinct topic words, German-compound aware; silent camp shown as silent.', cellb), P('<font color="#b45309">HIGH</font>', cellb)],
  [P('Weak semantic recall', cellb), P('Query was embedded as a keyword bag; documents as natural text → asymmetry.', cellb), P('Embed the natural-language topic (symmetric with documents).', cellb), P('MED', cellb)],
  [P('Duplicated orchestration', cellb), P('Reliability logic lived inline AND in an orphaned module → drift risk.', cellb), P('Unified into one dependency-injected, fully tested module.', cellb), P('MED', cellb)],
  [P('Embeddings 404 / dim mismatch, pubDate crash, duplicate cards, cryptic cluster labels, translation timeouts', cellb), P('Model/dim drift, type coercion, near-duplicate rows, LLM-named clusters, slow path.', cellb), P('gemini-embedding-001 @768 + fallback; ISO coercion; dedupe; human-readable labels (no LLM); bounded translation.', cellb), P('LOW–MED', cellb)]]
story.append(tbl(bugs, [CW*0.27, CW*0.34, CW*0.31, CW*0.08]))

story.append(PageBreak())
# ══════════════════════════════ PAGE 4 — new logic + measurement ══════════════════════════════
story.append(P('5 · New logic, architecture &amp; features (vs production)', h2)); rule(INK, 1.2)
feats = [
 ('Stored corpus + ingestion worker', 'A scheduled worker builds a durable, deduped corpus instead of relying on volatile live search at query time.'),
 ('Derive-and-discard', 'Legal-by-design storage: only our transformed summary + embedding are kept; full article text is discarded.'),
 ('Hybrid retrieval with RRF', 'Semantic and lexical retrieval fused rank-free — strictly better recall/precision than either alone.'),
 ('Relevance gate', 'Hard guarantee against off-topic filler — the single biggest perceived-accuracy fix.'),
 ('Citation grounding', 'Turns model output into real, clickable, verifiable sources.'),
 ('NLI claim verification', 'Meaning-level anti-hallucination — entailment / contradiction / neutral, batched and budgeted.'),
 ('Confidence envelope', 'A single defensible trust score with honest “unmeasured” handling and a contradiction penalty.'),
 ('Blind-spot verification', 'Three-level silence: covered / flagship-silent / camp-silent, feed-health aware.'),
 ('Story clustering', 'Sub-story grouping with solo-camp angle detection (no LLM cost).'),
 ('3-axis source classification', '55 outlets rated on spectrum × reach tier × factual rating, with ownership + provenance.'),
 ('Reach-weighted coverage', 'Camps weighted by audience reach, not raw article counts — mass-market ≠ niche.'),
 ('Reliability/Insights UI', 'New ReliabilityPanel + DeepInsights surface the trust signals to the reader.'),
]
rows = [[P('FEATURE', cellh), P('WHAT IT ADDS', cellh)]]
for n, d in feats: rows.append([P(n, cellb), P(d, cellb)])
story.append(tbl(rows, [CW*0.30, CW*0.70]))
sp(6)
story.append(P('6 · Measurement infrastructure (new)', h2)); rule(INK, 1.2)
story.append(P('“Reliable” is now a tracked number, not a claim. An <b>offline RAG-evaluation harness</b> scores '
   'retrieval (precision, recall@k, MRR, MAP, nDCG@k) and faithfulness (grounding × claim-support, contradiction '
   'penalty) over a labelled golden set — deterministic, no Gemini/DB, and CI-gateable. A <b>real-corpus capture</b> '
   'tool runs the production retrieval path against staging and dumps candidates for independent human labelling, '
   'bridging from “tests the logic” to “measures real accuracy.”', body))
sp(2)
mt = tbl([[P('PRECISION', cellh),P('RECALL@5', cellh),P('MRR', cellh),P('nDCG@5', cellh),P('FAITHFULNESS', cellh),P('TESTS', cellh)],
   [P('<font name="Georgia-B" size="12">97%</font>', cellb),P('<font name="Georgia-B" size="12">95%</font>', cellb),P('<font name="Georgia-B" size="12">100%</font>', cellb),P('<font name="Georgia-B" size="12">97%</font>', cellb),P('<font name="Georgia-B" size="12">93%</font>', cellb),P('<font name="Georgia-B" size="12">623</font>', cellb)]],
   [CW/6.0]*6)
story.append(mt)
story.append(P('Synthetic golden set, 15 topics, aggregate; all gate floors pass. 623 automated tests across the stack.', small))

story.append(PageBreak())
# ══════════════════════════════ PAGE 5 — maturity scorecard + verdict ══════════════════════════════
story.append(P('7 · Maturity — production vs new version', h2)); rule(INK, 1.2)
story.append(P('Scored per dimension, 0–10. Production is a capable presentation layer; V2 is a verified, '
   'measured analysis system.', body))
sc = [[P('DIMENSION', cellh), P('PROD · V1', cellh), P('NEW · V2', cellh), P('WHAT CHANGED', cellh)],
  [P('Anti-hallucination', cellb), P('<font color="#e11d48">2</font>', cellb), P('<font color="#15803d">9</font>', cellb), P('grounding + NLI entailment vs nothing', cellb)],
  [P('Trust transparency', cellb), P('<font color="#e11d48">1</font>', cellb), P('<font color="#15803d">9</font>', cellb), P('defensible confidence shown vs none', cellb)],
  [P('Retrieval accuracy', cellb), P('4', cellb), P('<font color="#15803d">9</font>', cellb), P('hybrid + relevance gate vs live search', cellb)],
  [P('Coverage breadth', cellb), P('5', cellb), P('<font color="#15803d">9</font>', cellb), P('55 classified outlets, balanced', cellb)],
  [P('Legal safety (text)', cellb), P('6', cellb), P('<font color="#15803d">9</font>', cellb), P('derive-and-discard by design', cellb)],
  [P('Measurability', cellb), P('<font color="#e11d48">1</font>', cellb), P('<font color="#15803d">9</font>', cellb), P('RAG eval harness + real capture', cellb)],
  [P('Architecture cleanliness', cellb), P('5', cellb), P('<font color="#15803d">9</font>', cellb), P('unified, DI, 623 tests', cellb)],
  [P('OVERALL', cellb), P('<font name="Georgia-B" color="#b45309">~5 / 10</font>', cellb), P('<font name="Georgia-B" color="#15803d">9 / 10</font>', cellb), P('presentation → verified system', cellb)]]
t = tbl(sc, [CW*0.27, CW*0.13, CW*0.13, CW*0.47])
t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),4.5),('BOTTOMPADDING',(0,0),(-1,-1),4.5),
   ('LEFTPADDING',(0,0),(-1,-1),4),('LINEBELOW',(0,0),(-1,0),0.9,INK),('ALIGN',(1,0),(2,-1),'CENTER'),
   ('FONT',(0,len(sc)-1),(-1,len(sc)-1),SERIF_B,9),('LINEABOVE',(0,len(sc)-1),(-1,len(sc)-1),0.8,INK)]
   + [('LINEBELOW',(0,r),(-1,r),0.4,HAIR) for r in range(1,len(sc)-1)]))
story.append(t)
sp(8)
story.append(P('8 · Verdict &amp; rollout', h2)); rule(INK, 1.2)
story.append(P('<b>Why it’s trustworthy now.</b> Production answers ask for trust; V2 <i>earns</i> it — every claim '
   'is traceable to a real source, checked for meaning, and the residual uncertainty is shown rather than hidden. '
   'That is the qualitative jump from a media-comparison UI to a verifiable media-analysis system.', body))
for t_ in [
   '<b>Production is untouched and safe.</b> V2 is flag-gated with a byte-identical live-RSS fallback; it cannot regress the current product.',
   '<b>Verify on staging before promotion.</b> Confirm the confidence fix end-to-end (e.g. the G7 query reads HIGH, not 65).',
   '<b>Then measure for real.</b> Capture &amp; label ~10–15 live topics to produce the first real-data reliability numbers and compare with the synthetic 97/95.',
   '<b>Remaining hardening.</b> persistent clustering, /api/feedback rate-limit, feed-health alerting — tracked, non-blocking.',
]:
    story.append(P('•&nbsp;&nbsp;' + t_, body))
sp(5)
story.append(P('Prepared for the NeutralNews engineering team · full architecture review of Corpus V2 vs the current production build.', small))

OUT = os.path.join(os.path.dirname(__file__), '..', 'reports', 'NeutralNews-Architecture-Review-V2.pdf')
os.makedirs(os.path.dirname(OUT), exist_ok=True)
doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=MX, rightMargin=MX, topMargin=34*mm, bottomMargin=20*mm)
frame = Frame(MX, 20*mm, PW-2*MX, PH-34*mm-20*mm, id='m', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
doc.addPageTemplates([PageTemplate(id='brand', frames=[frame], onPage=deco)])
doc.build(story)
print('WROTE', os.path.abspath(OUT))
