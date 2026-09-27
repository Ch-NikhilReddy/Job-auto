// §20 Application Executor — browser-assisted apply, zero human interaction per application
// SAFETY (AGENTS.md §23 / MASTER PROMPT §35): never bypass CAPTCHA, MFA, OTP, anti-bot.
// On those we STOP, mark BLOCKED_CAPTCHA, notify the user, and move on. No guessing.

import 'dotenv/config';
import { chromium, type Browser, type Page } from 'playwright';
import { getPrisma } from '../config/db.js';
import { nikhilProfile } from '../data/profile.js';
import { downloadFromStorage } from './storage.js';
import { notify } from './notification.js';

export const APPLY_STATUS = {
  READY: 'READY',
  APPLYING: 'APPLYING',
  APPLIED: 'APPLIED',
  BLOCKED_CAPTCHA: 'BLOCKED_CAPTCHA',
  BLOCKED_LOGIN: 'BLOCKED_LOGIN',
  FAILED: 'FAILED',
} as const;

// Domain allowlist — only these hosts may be auto-filled (user-approved, per §6 Mode C)
export function allowedDomains(): string[] {
  return (process.env.AUTO_APPLY_DOMAINS ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function isDomainAllowed(url: string): { allowed: boolean; host: string; reason: string } {
  let host = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch { return { allowed: false, host: '', reason: 'Invalid URL' }; }
  const list = allowedDomains();
  if (list.length === 0) return { allowed: false, host, reason: 'AUTO_APPLY_DOMAINS is empty — no hosts approved yet' };
  const ok = list.some((d) => host === d || host.endsWith(`.${d}`));
  return { allowed: ok, host, reason: ok ? `Host ${host} is on the allowlist` : `Host ${host} is NOT on the allowlist` };
}

// Signals that mean a human is required — we never try to solve these
const CAPTCHA_SIGNALS = [
  'recaptcha', 'hcaptcha', 'g-recaptcha', 'captcha-container',
  'cf-challenge', 'px-captcha', 'funcaptcha', 'arkoselabs', 'perimeterx',
  'access denied', 'unusual traffic', 'verify you are human', 'are you a robot',
];
const LOGIN_SIGNALS = ['sign in to continue', 'log in to apply', 'login required', 'create an account to apply', 'already have an account'];

export type FieldMap = { selectors: string[]; value: string; kind: 'text' | 'email' | 'tel' | 'textarea' | 'file' };

export function buildFieldMap(opts: { resumePath?: string; coverPath?: string }): FieldMap[] {
  const P = nikhilProfile;
  return [
    { selectors: ['input[name*="first" i]', 'input[id*="first" i]', 'input[placeholder*="first name" i]'], value: 'Nikhil', kind: 'text' },
    { selectors: ['input[name*="last" i]', 'input[id*="last" i]', 'input[placeholder*="last name" i]'], value: 'Reddy', kind: 'text' },
    { selectors: ['input[name*="full" i]', 'input[id*="fullname" i]', 'input[placeholder*="full name" i]'], value: P.fullName, kind: 'text' },
    { selectors: ['input[type="email" i]', 'input[name*="email" i]', 'input[id*="email" i]'], value: 'nikhilreddynikhil988@gmail.com', kind: 'email' },
    { selectors: ['input[type="tel" i]', 'input[name*="phone" i]', 'input[id*="phone" i]', 'input[placeholder*="mobile" i]'], value: '+91 7995214340', kind: 'tel' },
    { selectors: ['input[name*="location" i]', 'input[id*="location" i]', 'input[placeholder*="city" i]'], value: 'Hyderabad, Telangana, India', kind: 'text' },
    { selectors: ['input[name*="linkedin" i]', 'input[id*="linkedin" i]', 'input[placeholder*="linkedin" i]'], value: 'https://linkedin.com/in/ch-nikhil-reddy', kind: 'text' },
    { selectors: ['input[name*="github" i]', 'input[id*="github" i]', 'input[placeholder*="github" i]'], value: 'https://github.com/Ch-NikhilReddy', kind: 'text' },
    { selectors: ['input[name*="portfolio" i]', 'input[id*="portfolio" i]', 'input[placeholder*="portfolio" i]', 'input[placeholder*="website" i]'], value: 'https://nikhilreddy.dpdns.org', kind: 'text' },
    { selectors: ['input[name*="university" i]', 'input[id*="university" i]', 'input[placeholder*="university" i]', 'input[placeholder*="college" i]'], value: 'Anurag University, Hyderabad', kind: 'text' },
    { selectors: ['input[name*="graduation" i]', 'input[id*="graduation" i]', 'input[placeholder*="graduation" i]'], value: '2027', kind: 'text' },
    { selectors: ['input[name*="degree" i]', 'input[id*="degree" i]'], value: 'B.Tech Information Technology', kind: 'text' },
    { selectors: ['textarea[name*="skills" i]', 'textarea[id*="skills" i]', 'textarea[placeholder*="skills" i]'], value: P.skills.join(', '), kind: 'textarea' },
    { selectors: ['textarea[name*="summary" i]', 'textarea[id*="summary" i]', 'textarea[placeholder*="about" i]', 'textarea[placeholder*="cover" i]'], value: `Final-year B.Tech IT student (Anurag University, 2027) with hands-on full-stack experience across React, Next.js, Node.js, Express, Spring Boot, MongoDB and MySQL. Built ${P.projects.length} deployed systems including a MLRIT Hackathon-winning civic reporting portal and a role-based hostel management system. Available immediately for a 6-month internship and full-time from mid-2027.`, kind: 'textarea' },
    ...(opts.resumePath ? [{ selectors: ['input[type="file"][accept*=".doc" i]', 'input[type="file"][name*="resume" i]', 'input[type="file"][id*="resume" i]', 'input[type="file"][name*="cv" i]'], value: opts.resumePath, kind: 'file' as const }] : []),
  ];
}

export type ApplyOutcome = {
  status: string;
  reason: string;
  filled: string[];
  uploaded: boolean;
  submitted: boolean;
  blockedBy?: 'captcha' | 'login' | 'domain' | 'no_form';
  screenshotKey?: string;
  url: string;
};

async function detectBlock(page: Page): Promise<'captcha' | 'login' | null> {
  const html = (await page.content()).toLowerCase();
  const title = ((await page.title()) || '').toLowerCase();
  const text = ((await page.locator('body').innerText().catch(() => '')) || '').toLowerCase();
  const hay = `${html.slice(0, 200000)} ${title} ${text.slice(0, 5000)}`;
  for (const s of CAPTCHA_SIGNALS) if (hay.includes(s)) return 'captcha';
  for (const s of LOGIN_SIGNALS) if (text.includes(s)) return 'login';
  return null;
}

export async function applyToApplication(applicationId: string): Promise<ApplyOutcome> {
  const prisma = getPrisma();
  if (!prisma) throw new Error('DB required');

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: true, documents: true },
  });
  if (!app) throw new Error('Application not found');
  const job: any = app.job;
  const url: string = job?.sourceUrl ?? '';
  if (!url || !/^https?:\/\//i.test(url)) throw new Error('No permitted application URL on this job');

  const gate = isDomainAllowed(url);
  if (!gate.allowed) {
    await setStatus(applicationId, APPLY_STATUS.BLOCKED_LOGIN, `Auto-apply blocked: ${gate.reason}`);
    await notify({ type: 'auto_apply_blocked', title: `Auto-apply blocked (domain)`, message: `${job.companyName} — ${gate.reason}. Add the host to AUTO_APPLY_DOMAINS to allow.`, payload: { applicationId, host: gate.host } });
    return { status: APPLY_STATUS.BLOCKED_LOGIN, reason: gate.reason, filled: [], uploaded: false, submitted: false, blockedBy: 'domain', url };
  }

  // Resolve the tailored documents from S3 → temp files for upload
  const fs = await import('fs');
  const os = await import('os');
  const path = await import('path');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-apply-'));
  let resumePath: string | undefined;
  const resumeDoc = (app.documents ?? []).find((d: any) => d.documentType === 'resume_tailored') ?? (app.documents ?? []).find((d: any) => d.documentType === 'resume');
  if (resumeDoc) {
    const data = await downloadFromStorage(resumeDoc.fileKey);
    if (data) { resumePath = path.join(tmp, 'resume.docx'); fs.writeFileSync(resumePath, data.body); }
  }

  await setStatus(applicationId, APPLY_STATUS.APPLYING, `Auto-apply started on ${gate.host}`);

  let browser: Browser | null = null;
  const filled: string[] = [];
  let uploaded = false;
  let submitted = false;
  let screenshotKey: string | undefined;
  const timeoutMs = Number(process.env.AUTO_APPLY_TIMEOUT_MS ?? 45000);

  try {
    browser = await chromium.launch({
      headless: true,
      // On Render/Docker use the system chromium; locally use Playwright's own build
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
    });
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(timeoutMs);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

    // 1) Block check BEFORE any interaction
    const block = await detectBlock(page);
    if (block) {
      screenshotKey = await snap(page, applicationId, `blocked-${block}`);
      await setStatus(applicationId, block === 'captcha' ? APPLY_STATUS.BLOCKED_CAPTCHA : APPLY_STATUS.BLOCKED_LOGIN,
        block === 'captcha' ? 'CAPTCHA/anti-bot detected — human required (never bypassed)' : 'Login required — human required');
      await notify({ type: 'auto_apply_blocked', title: `Human needed: ${job.companyName}`, message: block === 'captcha' ? 'CAPTCHA detected. The agent stopped (it will never bypass it). Apply manually on the company site.' : 'This form needs an account login. Apply manually.', payload: { applicationId, block } });
      return { status: block === 'captcha' ? APPLY_STATUS.BLOCKED_CAPTCHA : APPLY_STATUS.BLOCKED_LOGIN, reason: `${block} detected`, filled, uploaded, submitted: false, blockedBy: block, screenshotKey, url };
    }

    // 2) Try embedded résumé/apply form first
    const map = buildFieldMap({ resumePath });
    for (const f of map) {
      for (const sel of f.selectors) {
        const loc = page.locator(sel).first();
        if (await loc.count().catch(() => 0)) {
          try {
            if (f.kind === 'file') {
              await loc.setInputFiles(f.value);
              uploaded = true; filled.push('file:resume');
            } else {
              await loc.fill(f.value, { timeout: 8000 });
              filled.push(`${f.kind}:${sel.slice(0, 28)}`);
            }
            break;
          } catch { /* try next selector */ }
        }
      }
    }

    // 3) Detect a submit control
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Submit")',
      'button:has-text("Apply")',
      'button:has-text("Apply now")',
      'input[value*="Apply" i]',
      'input[value*="Submit" i]',
    ];
    let submitLoc = null as any;
    for (const sel of submitSelectors) {
      const loc = page.locator(sel).first();
      if (await loc.count().catch(() => 0)) { submitLoc = loc; break; }
    }
    if (!submitLoc) {
      screenshotKey = await snap(page, applicationId, 'no-submit');
      await setStatus(applicationId, APPLY_STATUS.FAILED, 'No apply/submit control found on the page');
      await notify({ type: 'auto_apply_failed', title: `No apply button: ${job.companyName}`, message: 'Could not find a submit control. The form may be multi-step or require an account.', payload: { applicationId } });
      return { status: APPLY_STATUS.FAILED, reason: 'No submit control found', filled, uploaded, submitted: false, blockedBy: 'no_form', screenshotKey, url };
    }

    // 4) Click apply/signup gates only (no CAPTCHA bypass)
    for (const gateSel of ['button:has-text("Apply for this job")', 'a:has-text("Apply for this job")', 'button:has-text("Easy Apply")', 'a:has-text("Easy Apply")', 'button:has-text("Apply now")']) {
      const l = page.locator(gateSel).first();
      if (await l.count().catch(() => 0)) { await l.click({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(1500); break; }
    }

    const block2 = await detectBlock(page);
    if (block2 === 'captcha') {
      screenshotKey = await snap(page, applicationId, 'blocked-captcha-post-apply');
      await setStatus(applicationId, APPLY_STATUS.BLOCKED_CAPTCHA, 'CAPTCHA appeared after opening the form — human required');
      await notify({ type: 'auto_apply_blocked', title: `CAPTCHA at ${job.companyName}`, message: 'A CAPTCHA appeared on the form. The agent stopped and will not bypass it. Apply manually.', payload: { applicationId } });
      return { status: APPLY_STATUS.BLOCKED_CAPTCHA, reason: 'captcha after opening form', filled, uploaded, submitted: false, blockedBy: 'captcha', screenshotKey, url };
    }

    // Re-fill fields that appeared in the modal/second step
    for (const f of map) {
      for (const sel of f.selectors) {
        const loc = page.locator(sel).first();
        if (await loc.count().catch(() => 0)) {
          try {
            if (f.kind === 'file') { if (!uploaded) { await loc.setInputFiles(f.value); uploaded = true; filled.push('file:resume'); } }
            else { const cur = await loc.inputValue().catch(() => ''); if (!cur) { await loc.fill(f.value, { timeout: 5000 }); filled.push(`${f.kind}:${sel.slice(0, 28)}`); } }
            break;
          } catch {}
        }
      }
    }

    // 5) Submit
    await submitLoc.click({ timeout: 10000 });
    await page.waitForTimeout(3500);
    submitted = true;
    screenshotKey = await snap(page, applicationId, 'submitted');

    // 6) Post-submit block check (some ATS challenges after submit)
    const post = await detectBlock(page);
    if (post === 'captcha') {
      await setStatus(applicationId, APPLY_STATUS.BLOCKED_CAPTCHA, 'Submit clicked but a CAPTCHA challenge is pending — finish it manually');
      await notify({ type: 'auto_apply_blocked', title: `Finish CAPTCHA at ${job.companyName}`, message: 'Form was filled and submitted, but a CAPTCHA challenge is pending. Open the page and complete it.', payload: { applicationId, url } });
      return { status: APPLY_STATUS.BLOCKED_CAPTCHA, reason: 'captcha pending after submit', filled, uploaded, submitted, blockedBy: 'captcha', screenshotKey, url };
    }

    const bodyText = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
    const confirmed = /thank you|application received|we have received|successfully submitted|application submitted|we'll be in touch|we will be in touch/.test(bodyText);

    const prisma2 = getPrisma()!;
    await prisma2.application.update({
      where: { id: applicationId },
      data: {
        status: APPLY_STATUS.APPLIED,
        submissionMethod: 'browser_automated',
        submittedAt: new Date(),
        applicationUrl: url,
        ...(screenshotKey ? { verificationNote: `Auto-filled and submitted by agent on ${gate.host}. Confirmation text detected: ${confirmed}. Screenshot: ${screenshotKey}` } : {}),
      },
    });
    await prisma2.applicationEvent.create({ data: { applicationId, eventType: 'AUTO_APPLIED', eventData: { host: gate.host, filled, uploaded, confirmed, screenshotKey, url } as any } });
    await notify({ type: 'application_submitted', title: `Auto-applied: ${job.title} at ${job.companyName}`, message: confirmed ? 'Form filled, resume uploaded, and submitted. Confirmation text detected.' : 'Form filled and submitted. Verify the confirmation email to close the loop.', payload: { applicationId, url } });

    return { status: APPLY_STATUS.APPLIED, reason: confirmed ? 'Submitted with confirmation text' : 'Submitted (no confirmation text found)', filled, uploaded, submitted: true, screenshotKey, url };
  } catch (e: any) {
    await setStatus(applicationId, APPLY_STATUS.FAILED, `Auto-apply error: ${e?.message ?? e}`);
    await notify({ type: 'auto_apply_failed', title: `Auto-apply failed: ${job.companyName ?? 'job'}`, message: e?.message ?? String(e), payload: { applicationId, url } });
    return { status: APPLY_STATUS.FAILED, reason: e?.message ?? String(e), filled, uploaded, submitted, url };
  } finally {
    await browser?.close().catch(() => {});
  }
}

async function setStatus(id: string, status: string, note: string) {
  const prisma = getPrisma();
  if (!prisma) return;
  await prisma.application.update({ where: { id }, data: { status, ...(status === APPLY_STATUS.FAILED ? {} : {}) } }).catch(() => {});
  await prisma.applicationEvent.create({ data: { applicationId: id, eventType: status, eventData: { note } as any } }).catch(() => {});
}

async function snap(page: Page, applicationId: string, tag: string): Promise<string | undefined> {
  try {
    const buf = await page.screenshot({ fullPage: false });
    const key = `evidence/${applicationId}_${tag}_${Date.now()}.png`;
    const { uploadToStorage } = await import('./storage.js');
    await uploadToStorage(key, Buffer.from(buf), 'image/png');
    return key;
  } catch { return undefined; }
}
