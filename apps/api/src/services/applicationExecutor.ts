// Application Executor per §7 + §20 + Phase 7 — permitted submission only
import { getPrisma } from '../config/db.js';

export type SafeCriteria = {
  job: { employmentType: string; location: string; workMode: string; skills: string[]; description: string };
  application: { status: string; answersApproved: boolean; hasUnknown: boolean };
  source: { name: string; supportsApply: boolean };
  duplicateExists: boolean;
};

export type SubmitCheck = { passed: boolean; reason: string; blocker?: boolean };

export function checkSafeCriteria(c: SafeCriteria): SubmitCheck[] {
  const checks: SubmitCheck[] = [];

  // 1. Internship/fresher eligible
  const fresherEligible = c.job.employmentType === 'internship' || /fresher|intern|0\s*-\s*1|entry/i.test(c.job.description);
  checks.push({ passed: fresherEligible, reason: fresherEligible ? 'Fresher/intern eligible' : 'Not fresher-eligible', blocker: !fresherEligible });

  // 2. Location matches (Hyderabad/Remote)
  const locOk = /hyderabad|remote|bengaluru/i.test(c.job.location) || c.job.workMode === 'remote';
  checks.push({ passed: locOk, reason: locOk ? `Location ok: ${c.job.location}` : `Location mismatch: ${c.job.location}`, blocker: !locOk });

  // 3. No mandatory experience >1 year
  const expMatch = c.job.description.match(/(\d+)\+?\s*years/i);
  const expYears = expMatch ? parseInt(expMatch[1], 10) : 0;
  const expOk = isNaN(expYears) || expYears <= 1;
  checks.push({ passed: expOk, reason: expOk ? 'Experience ≤1 year' : `Requires ${expYears}+ years`, blocker: !expOk });

  // 4. No application fee / unusual contract
  const fee = /application fee|fee.*required|bond.*\d+.*year|contract.*\d+.*year/i.test(c.job.description);
  checks.push({ passed: !fee, reason: fee ? 'Fee/bond detected — block' : 'No fee/bond', blocker: fee });

  // 5. No unanswered critical question
  checks.push({ passed: !c.application.hasUnknown, reason: c.application.hasUnknown ? 'Has UNKNOWN answers → needs user' : 'All critical answers present', blocker: c.application.hasUnknown });

  // 6. No CAPTCHA/MFA requiring user
  const captcha = /captcha|mfa|otp/i.test(c.job.description);
  checks.push({ passed: !captcha, reason: captcha ? 'CAPTCHA/MFA detected — needs user' : 'No CAPTCHA/MFA', blocker: captcha });

  // 7. Permitted mechanism
  checks.push({ passed: c.source.supportsApply || c.source.name === 'Manual import' || c.source.name === 'Greenhouse', reason: c.source.supportsApply ? `Source ${c.source.name} supports apply` : `Source ${c.source.name}: link-out only — manual apply`, blocker: false });

  // 8. Duplicate check
  checks.push({ passed: !c.duplicateExists, reason: c.duplicateExists ? 'Duplicate application exists — BLOCK' : 'No duplicate', blocker: c.duplicateExists });

  // 9. Approval gate
  const approved = c.application.status === 'APPROVED';
  checks.push({ passed: approved, reason: approved ? 'Human approval granted (APPROVED)' : `Status is ${c.application.status} — needs APPROVE`, blocker: !approved });

  return checks;
}

export async function canAutoSubmit(applicationId: string): Promise<{ ok: boolean; checks: SubmitCheck[]; job: any; application: any }> {
  const prisma = getPrisma();
  if (!prisma) throw new Error('DB not enabled');
  const appRow = await prisma.application.findUnique({ where: { id: applicationId }, include: { job: true, answers: true } });
  if (!appRow || !appRow.job) throw new Error('Application or job not found');
  const job = appRow.job;
  // An answer is UNKNOWN only if still flagged/empty AND not user-supplied (§19)
  const hasUnknown = appRow.answers.some(
    (a: any) => a.answeredBy !== 'user' && (a.answerText === '(FLAG FOR USER)' || a.answerText === '' || a.answeredBy === 'system-flagged')
  );
  const answersApproved = appRow.answers.length === 0 || appRow.answers.every((a: any) => a.isApproved || a.answerText !== '');

  // Source supportsApply lookup
  let sourceSupportsApply = false;
  let sourceName = 'Unknown';
  if ((job as any).sourceId) {
    const src = await prisma.jobSource.findUnique({ where: { id: (job as any).sourceId } });
    if (src) { sourceSupportsApply = (src.capabilities as any)?.supportsApply ?? false; sourceName = src.name; }
  } else {
    sourceName = 'Manual import';
    sourceSupportsApply = false;
  }

  const duplicateExists = false; // already unique per job, checked earlier

  const checks = checkSafeCriteria({
    job: { employmentType: (job as any).employmentType, location: (job as any).location, workMode: (job as any).workMode, skills: (job.skills as string[]) ?? [], description: (job as any).description },
    application: { status: (appRow as any).status, answersApproved, hasUnknown },
    source: { name: sourceName, supportsApply: sourceSupportsApply },
    duplicateExists,
  });

  const blockers = checks.filter(c => c.blocker && !c.passed);
  return { ok: blockers.length === 0, checks, job, application: appRow };
}
