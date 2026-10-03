"""One-page candidate sheet — optimised for reading on a phone in a DM.
Every claim below is traceable to Nikhil's real resume / real repos.
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether

OUT = r"D:\AIAGENT\AgentForAppling\Resumes\Nikhil_Candidate_OnePager.pdf"

INK      = HexColor("#111827")
MUTED    = HexColor("#6B7280")
ACCENT   = HexColor("#0891B2")
RULE     = HexColor("#E5E7EB")
BOX_BG   = HexColor("#F8FAFC")
GREEN    = HexColor("#047857")

S = ParagraphStyle("s", fontName="Helvetica", fontSize=8.6, leading=11.6, textColor=INK, alignment=TA_LEFT)
SMALL  = ParagraphStyle("small", parent=S, fontSize=7.6, leading=10.2, textColor=MUTED)
NAME   = ParagraphStyle("name", parent=S, fontSize=21, leading=24, textColor=INK)
ROLE   = ParagraphStyle("role", parent=S, fontSize=10.5, leading=14, textColor=ACCENT)
H      = ParagraphStyle("h", parent=S, fontSize=8.2, leading=10, textColor=ACCENT, fontName="Helvetica-Bold")
BODY   = ParagraphStyle("body", parent=S, fontSize=8.5, leading=11.4)
PROJ   = ParagraphStyle("proj", parent=S, fontSize=9.0, leading=11.6, fontName="Helvetica-Bold")
LINK   = ParagraphStyle("link", parent=SMALL, textColor=ACCENT)

story = []

def rule(pad_top=3, pad_bottom=5):
    story.append(Spacer(1, pad_top * mm))
    story.append(Table([[""]], colWidths=[178 * mm], rowHeights=[0.35 * mm],
                       style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), RULE)])))
    story.append(Spacer(1, pad_bottom * mm))

# ── Header ────────────────────────────────────────────────────────────────
story.append(Paragraph("NIKHIL REDDY CHITTEPU", NAME))
story.append(Spacer(1, 1 * mm))
story.append(Paragraph(
    "Full-Stack / Software Engineer Intern &mdash; available immediately for a 6-month "
    "internship, full-time from mid-2027.", ROLE))
story.append(Spacer(1, 1.6 * mm))
story.append(Paragraph(
    "B.Tech Information Technology, Anurag University, Hyderabad &nbsp;&bull;&nbsp; 2027 &nbsp;&bull;&nbsp; "
    '<link href="https://github.com/Ch-NikhilReddy" color="#0891B2">github.com/Ch-NikhilReddy</link>'
    ' &nbsp;&bull;&nbsp; <link href="https://nikhilreddy.dpdns.org" color="#0891B2">nikhilreddy.dpdns.org</link>'
    ' &nbsp;&bull;&nbsp; +91 7995214340', SMALL))
rule()

# ── What I build ──────────────────────────────────────────────────────────
story.append(Paragraph("WHAT I BUILD", H))
story.append(Spacer(1, 1.2 * mm))
story.append(Paragraph(
    "End-to-end web systems in <b>React, Next.js, Node.js, Express, Spring Boot, MongoDB and MySQL</b> &mdash; "
    "database modelling, REST APIs, JWT authentication, role-based access control, and deployment to "
    "Vercel / Render. I own features from schema to shipped UI rather than handing off pieces.", BODY))
story.append(Spacer(1, 2 * mm))

# ── Selected work ─────────────────────────────────────────────────────────
story.append(Paragraph("SELECTED WORK", H))
story.append(Spacer(1, 1.2 * mm))

projects = [
    ("Civic Issues Portal",
     "<b>React, Tailwind, Leaflet, Node, Express, MongoDB</b> &mdash; map-based complaint reporting with geolocation, "
     "3-tier roles (user / admin / worker) and a pending&rarr;resolved tracking model. "
     '<b>Won the MLRIT college hackathon.</b> '
     '<link href="https://github.com/Ch-NikhilReddy/civic" color="#0891B2">github.com/Ch-NikhilReddy/civic</link>'),
    ("Smart Hostel Complaint &amp; Maintenance System",
     "<b>React, Spring Boot, MySQL</b> &mdash; role-based complaint lifecycle with admin dashboards and Spring Boot "
     "REST APIs. <i>Delivered as part of a 6-month web development internship at Unified Mentor (Jul&ndash;Oct 2025).</i> "
     '<link href="https://github.com/Ch-NikhilReddy/Smart-Hostel" color="#0891B2">github.com/Ch-NikhilReddy/Smart-Hostel</link>'),
    ("Adaptive Cognitive Firewall (mini project, Anurag University)",
     "<b>Python, ML, security</b> &mdash; an offline-first host firewall architecture combining a local rule engine with a "
     "lightweight on-device classifier, a privacy-preserving external-lookup fallback, and a local conversational "
     "security assistant for explaining alerts."),
]

rows = [[Paragraph(t, PROJ), Paragraph(d, SMALL)] for t, d in projects]
story.append(Table(rows, colWidths=[46 * mm, 132 * mm], style=TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ("TOPPADDING", (0, 0), (-1, -1), 0),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5 * mm),
])))
story.append(Spacer(1, 0.5 * mm))

# ── Flagship project box ──────────────────────────────────────────────────
ai_body = (
    "A self-directed system that <b>discovers, evaluates, prepares and tracks</b> job applications &mdash; and is "
    "running live today. It pulls roles from <b>seven public job APIs</b> (Greenhouse, Lever, Remotive, Himalayas, "
    "RemoteOK, Arbeitnow, Jobicy), filters to entry-level India/remote tech roles, and scores each one with visible "
    "reasons for skills, education, experience, location and eligibility.<br/>"
    "For every match it generates a <b>tailored DOCX resume and PDF cover letter</b>, then an approval-gated workflow "
    "generates application answers, uploads documents to S3, and a headless-Chromium worker auto-fills and submits "
    "eligible forms on a schedule.<br/>"
    "<b>The hard part was the honesty layer.</b> A fabrication guard blocks the system from inventing a single skill, "
    "degree or date, and it refuses to guess visa, salary or work-authorisation answers &mdash; those are flagged back "
    "to me. It stops dead at CAPTCHA and login walls instead of working around them. <b>62 automated tests</b> cover "
    "those guarantees, and one of them caught a real bug where a &ldquo;5+ years of experience&rdquo; posting would not "
    "have been filtered out.<br/>"
    '<b>Stack:</b> Fastify, TypeScript, Prisma, PostgreSQL, BullMQ, Playwright, React, Docker '
    '&nbsp;&bull;&nbsp; <link href="https://github.com/Ch-NikhilReddy/Job-auto" color="#0891B2">github.com/Ch-NikhilReddy/Job-auto</link>'
)
story.append(KeepTogether(Table(
    [[Paragraph("FLAGSHIP PROJECT &nbsp;&middot;&nbsp; CAREERPILOT AI &mdash; AUTONOMOUS JOB-APPLICATION AGENT", H),
      Paragraph(ai_body, SMALL)]],
    colWidths=[178 * mm],
    style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BOX_BG),
        ("BOX", (0, 0), (-1, -1), 0.6, RULE),
        ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))))
story.append(Spacer(1, 1 * mm))

# ── Bottom strip ──────────────────────────────────────────────────────────
story.append(Paragraph("ALSO IN PROGRESS", H))
story.append(Spacer(1, 1 * mm))
story.append(Paragraph(
    "Gas Agency booking system (MERN, JWT, email notifications) &middot; Student&ndash;Teacher appointment scheduler "
    "(MERN) &middot; Ecoyaan checkout flow (Next.js SSR) &middot; Custom OS bootloader and language interpreter "
    "(NASM, QEMU) &mdash; systems work beyond the web stack.", SMALL))
story.append(Spacer(1, 3 * mm))

story.append(Table([[""]], colWidths=[178 * mm], rowHeights=[0.35 * mm],
                   style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), RULE)])))
story.append(Spacer(1, 2.5 * mm))
story.append(Paragraph(
    "<b>Open to a 6-month internship starting now</b> &mdash; ideally with a team where I can own a feature end to "
    "end and keep shipping. Happy to share the repository, a tailored resume, or a 15-minute walkthrough of the "
    "project above. &nbsp;&mdash;&nbsp; Nikhil Reddy Chittepu, +91 7995214340, "
    "nikhilreddynikhil988@gmail.com", SMALL))

doc = SimpleDocTemplate(
    OUT, pagesize=A4,
    leftMargin=16 * mm, rightMargin=16 * mm,
    topMargin=13 * mm, bottomMargin=11 * mm,
    title="Nikhil Reddy Chittepu — Software Engineer Intern",
    author="Nikhil Reddy Chittepu",
)
doc.build(story)
print("WROTE", OUT)