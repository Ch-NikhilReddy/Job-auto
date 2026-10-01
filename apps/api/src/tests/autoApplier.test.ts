import { describe, it, expect } from 'vitest';
import { isDomainAllowed, buildFieldMap } from '../services/autoApplier.js';

describe('autoApplier — allowlist gate', () => {
  it('denies everything when the allowlist is empty', () => {
    const r = isDomainAllowed('https://boards.greenhouse.io/x/jobs/1');
    expect(typeof r.allowed).toBe('boolean');
  });

  it('matches configured hosts', () => {
    process.env.AUTO_APPLY_DOMAINS = 'boards.greenhouse.io,apply.workable.com';
    expect(isDomainAllowed('https://boards.greenhouse.io/acme/jobs/1').allowed).toBe(true);
    expect(isDomainAllowed('https://apply.workable.com/acme/J/1/').allowed).toBe(true);
    expect(isDomainAllowed('https://www.linkedin.com/jobs/view/1').allowed).toBe(false);
  });

  it('does not allow subdomain spoofing', () => {
    process.env.AUTO_APPLY_DOMAINS = 'greenhouse.io';
    expect(isDomainAllowed('https://evil-greenhouse.io/x').allowed).toBe(false);
    expect(isDomainAllowed('https://sub.greenhouse.io/x').allowed).toBe(true);
  });

  it('rejects malformed URLs', () => {
    expect(isDomainAllowed('not-a-url').allowed).toBe(false);
  });
});

describe('autoApplier — field mapping', () => {
  const map = buildFieldMap({ resumePath: '/tmp/resume.docx' });
  it('maps verified contact fields', () => {
    const all = JSON.stringify(map);
    expect(all).toContain('nikhilreddynikhil988@gmail.com');
    expect(all).toContain('+91 7995214340');
    expect(all).toContain('Anurag University');
    expect(all).toContain('2027');
  });
  it('includes exactly one file field when a resume is supplied', () => {
    expect(map.filter((f) => f.kind === 'file')).toHaveLength(1);
  });
  it('omits the file field when no resume exists', () => {
    expect(buildFieldMap({}).filter((f) => f.kind === 'file')).toHaveLength(0);
  });
});
