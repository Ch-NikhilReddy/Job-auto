import { describe, it, expect } from 'vitest';
import { checkSafeCriteria } from '../services/applicationExecutor.js';

const base = {
  job: { employmentType: 'internship', location: 'Hyderabad', workMode: 'hybrid', skills: ['React'], description: 'Fresher internship, 0-1 year experience' },
  application: { status: 'APPROVED' as string, answersApproved: true, hasUnknown: false },
  source: { name: 'Greenhouse', supportsApply: true },
  duplicateExists: false,
};

const find = (checks: any[], frag: string) => checks.find((c) => c.reason.toLowerCase().includes(frag.toLowerCase()));
const passed = (checks: any[], frag: string) => find(checks, frag)?.passed;

describe('applicationExecutor — §6 Mode C safe criteria', () => {
  it('passes a clean approved fresher role', () => {
    const checks = checkSafeCriteria(base as any);
    expect(checks.every((c) => c.passed)).toBe(true);
    expect(checks).toHaveLength(9);
  });

  it('BLOCKS when status is not APPROVED', () => {
    const checks = checkSafeCriteria({ ...base, application: { ...base.application, status: 'APPROVAL_REQUIRED' } } as any);
    expect(passed(checks, 'needs APPROVE')).toBe(false);
    expect(find(checks, 'APPROVE')?.blocker).toBe(true);
  });

  it('BLOCKS when UNKNOWN answers remain', () => {
    const checks = checkSafeCriteria({ ...base, application: { ...base.application, hasUnknown: true } } as any);
    expect(passed(checks, 'UNKNOWN')).toBe(false);
  });

  it('BLOCKS duplicates', () => {
    const checks = checkSafeCriteria({ ...base, duplicateExists: true } as any);
    expect(passed(checks, 'duplicate')).toBe(false);
  });

  it('BLOCKS roles needing 2+ years', () => {
    const checks = checkSafeCriteria({ ...base, job: { ...base.job, description: 'Requires 3+ years of experience' } } as any);
    expect(passed(checks, 'requires')).toBe(false);
    expect(find(checks, 'requires')?.blocker).toBe(true);
  });

  it('BLOCKS "years of experience" phrasings', () => {
    for (const d of ['5 years of experience required', '3 yrs experience', 'minimum 4 years experience']) {
      const checks = checkSafeCriteria({ ...base, job: { ...base.job, description: d } } as any);
      expect(passed(checks, 'requires')).toBe(false);
    }
  });

  it('BLOCKS application fees / bonds', () => {
    const checks = checkSafeCriteria({ ...base, job: { ...base.job, description: 'Candidates must pay an application fee of 500' } } as any);
    expect(passed(checks, 'fee/bond')).toBe(false);
  });

  it('BLOCKS CAPTCHA / MFA forms', () => {
    const checks = checkSafeCriteria({ ...base, job: { ...base.job, description: 'Complete the reCAPTCHA before submitting' } } as any);
    expect(passed(checks, 'CAPTCHA')).toBe(false);
  });

  it('BLOCKS off-location roles', () => {
    const checks = checkSafeCriteria({ ...base, job: { ...base.job, location: 'New York, USA', workMode: 'onsite' } } as any);
    expect(passed(checks, 'Location')).toBe(false);
  });

  it('treats remote as location-compatible', () => {
    const checks = checkSafeCriteria({ ...base, job: { ...base.job, location: 'Anywhere', workMode: 'remote' } } as any);
    expect(passed(checks, 'Location')).toBe(true);
  });

  it('does NOT block on link-out sources (it is advisory)', () => {
    const checks = checkSafeCriteria({ ...base, source: { name: 'LinkedIn Jobs', supportsApply: false } } as any);
    const permitted = checks.find((c) => c.reason.includes('link-out'));
    expect(permitted?.blocker).toBe(false);
  });
});
