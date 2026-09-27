// Real job connectors — PUBLIC APIs only (no scraping, no auth, no ToS bypass).
//   • Greenhouse Job Board API : https://boards-api.greenhouse.io/v1/boards/{token}/jobs
//   • Lever Posting API         : https://api.lever.co/v0/postings/{company}
//   • Ashby Job Board API       : https://api.ashbyhq.com/posting-api/job-board/{company}
//   • Remotive (remote jobs)    : https://remotive.com/api/remote-jobs
// These are documented, public, and intended for exactly this use.

import type { JobSourceAdapter, AdapterResult, RawJob } from './types.js';

const UA = { 'User-Agent': 'CareerPilotAI/1.0 (personal job search assistant)', Accept: 'application/json' };
const TIMEOUT_MS = Number(process.env.SOURCE_TIMEOUT_MS ?? 20000);

async function getJson(url: string): Promise<any | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    const res = await fetch(url, { headers: UA, signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Entry-level relevance filter ──
// A 4th-year student is a poor match for "Senior/Manager/Lead" roles, so we drop them
// at ingestion. This keeps the pipeline cheap (AGENTS.md §24) and the signal high.
const SENIOR_BLOCKLIST = [
  'senior', 'sr.', 'sr ', 'staff', 'principal', 'manager', 'management', 'director', 'head of',
  'lead ', 'leader', 'architect', 'vp', 'vice president', 'chief', 'partner', 'counsel',
  'experienced', 'expert', 'ii', 'iii', 'associate director', 'associate vice',
  'general manager', 'associate partner', 'supervisor',
];
const ENTRY_HINTS = [
  'intern', 'internship', 'trainee', 'graduate', 'fresher', 'entry', 'junior', 'jr.',
  'campus', 'apprentice', 'co-op', 'coop', 'new grad', '0-1', '0 - 1', 'associate',
  'engineer i', 'software engineer', 'developer', 'sde', 'engineer',
];

export function isEntryLevel(title: string, description: string): boolean {
  const t = title.toLowerCase();
  if (SENIOR_BLOCKLIST.some((s) => t.includes(s))) return false;
  return true;
}

export function isInternshipish(title: string, description: string, employmentType: string): boolean {
  if (employmentType === 'internship') return true;
  const hay = `${title} ${description}`.toLowerCase();
  return ['intern', 'internship', 'trainee', 'campus hire', 'co-op', 'apprentice'].some((k) => hay.includes(k));
}

export function extractSkills(text: string): string[] {
  const known = [
    'react', 'next.js', 'node.js', 'express', 'java', 'python', 'javascript', 'typescript',
    'spring boot', 'mongodb', 'mysql', 'postgresql', 'sql', 'redis', 'docker', 'kubernetes',
    'rest api', 'graphql', 'tailwind', 'html', 'css', 'git', 'linux',
    'machine learning', 'tensorflow', 'pytorch', 'data structures', 'algorithms', 'oop',
  ];
  const hay = text.toLowerCase();
  return known.filter((k) => hay.includes(k));
}

// ── India/Remote location gate (user profile: Hyderabad, open to Remote) ──
const INDIA_RE = /india|hyderabad|bengaluru|bangalore|pune|delhi|noida|mumbai|gurgaon|gurugram|hyderabad|telangana|chennai|pune|bangalore|kolkata|ahmedabad|kochi|jaipur|indore|bhubaneswar|coimbatore/i;
const REMOTE_RE = /remote|anywhere|worldwide|work from home|wfh|virtual/i;

export function isRelevantLocation(location: string): boolean {
  const l = (location ?? '').toLowerCase();
  if (!l) return true; // unknown → keep, matcher scores it later
  return INDIA_RE.test(l) || REMOTE_RE.test(l);
}

// Non-tech noise common on aggregator boards
const NOISE_TITLE_RE = /sales|call ?center|telesales|business development|account executive|marketing|content |copywriter|writer|designer|recruiter|hr |human resources|accountant|finance|legal|teacher|instructor|video editor|data annotator|bpo|voice process|relationship|insurance|real estate/i;

export function isTechRelevant(title: string, skills: string[], description: string): boolean {
  if (NOISE_TITLE_RE.test(title)) return false;
  const techTitle = /software|developer|programmer|engineer|full ?stack|backend|frontend|devops|data|qa|automation|mobile|ios|android|web |cloud|security|machine learning|ai |ml |sre|platform/i.test(title);
  return techTitle || skills.length >= 2 || /we are looking for.*(engineer|developer)|technical/i.test(description);
}

function stripHtml(html?: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Greenhouse board tokens of companies known to hire interns / juniors in India ──
const envList = (v?: string, fallback: string[] = []): string[] => {
  if (v) return v.split(',').map((s) => s.trim()).filter(Boolean);
  return fallback;
};

const GREENHOUSE_BOARDS = envList(process.env.GREENHOUSE_BOARDS, [
  'freshworks', 'razorpay', 'zomato', 'swiggy', 'postman', 'browserstack', 'chargebee',
  'hasura', 'zendesk', 'innovaccer', 'dream11', 'upgrad', 'meesho', 'groww', 'cred',
  'practo', 'nykaa', 'mytra', 'slice', 'jupiter', 'acko', 'delhivery',
  'udaan', 'OYO', 'OYOrooms', 'tally', 'zoho', 'freshdesk',
]);

export function greenhouseRealAdapter(): JobSourceAdapter {
  return {
    name: 'Greenhouse',
    capabilities: { search: true, fetchDetails: true, supportsApply: false },
    isEnabled() { return GREENHOUSE_BOARDS.length > 0; },
    async fetchJobs(): Promise<AdapterResult> {
      const jobs: RawJob[] = [];
      const boards = await Promise.all(
        GREENHOUSE_BOARDS.map(async (board: string) => {
          const data = await getJson(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`);
          const list = data?.jobs ?? [];
          return { board, list };
        })
      );
      for (const { board, list } of boards) {
        for (const j of list) {
          const title: string = j.title ?? '';
          if (!title) continue;
          const loc = j.location?.name ?? 'India';
          const departments: string[] = (j.departments ?? []).map((d: any) => d?.name).filter(Boolean);
          const offices: string[] = (j.offices ?? []).map((d: any) => d?.name).filter(Boolean);
          const remote = /remote/i.test(loc);
          const internship = /intern|internship|trainee|graduate|campus/i.test(`${title} ${departments.join(' ')}`);
          const description = stripHtml(j.content).slice(0, 6000);
          if (!isEntryLevel(title, description)) continue;
          if (!isRelevantLocation(loc)) continue;
          const skills = extractSkills(`${title} ${description}`);
          if (!isTechRelevant(title, skills, description)) continue;
          jobs.push({
            externalId: `gh-${board}-${j.id}`,
            title,
            company: board,
            location: loc,
            workMode: remote ? 'remote' : 'hybrid',
            employmentType: isInternshipish(title, description, internship ? 'internship' : 'full-time') ? 'internship' : 'full-time',
            skills,
            description,
            url: j.absolute_url,
            postedAt: j.updated_at ? String(j.updated_at).slice(0, 10) : undefined,
          });
          void offices;
        }
      }
      return { jobs, sourceName: 'Greenhouse', fetchedAt: new Date().toISOString() };
    },
  };
}

// ── Lever companies ──
const LEVER_COMPANIES = envList(process.env.LEVER_COMPANIES, [
  'swiggy', 'meesho', 'razorpay', 'zomato', 'postman', 'hasura', 'browserstack',
  'chargebee', 'tally', 'dream11', 'groww', 'slice', 'cred', 'acko',
]);

export function leverRealAdapter(): JobSourceAdapter {
  return {
    name: 'Lever',
    capabilities: { search: true, fetchDetails: true, supportsApply: false },
    isEnabled() { return LEVER_COMPANIES.length > 0; },
    async fetchJobs(): Promise<AdapterResult> {
      const jobs: RawJob[] = [];
      const results = await Promise.all(
        LEVER_COMPANIES.map(async (c: string) => ({ c, data: await getJson(`https://api.lever.co/v0/postings/${c}?mode=json`) }))
      );
      for (const { c, data } of results) {
        for (const j of data ?? []) {
          const title: string = j.text ?? '';
          if (!title) continue;
          const categories = j.categories ?? {};
          const commitment: string = categories.commitment ?? '';
          const location = categories.location ?? 'India';
          const internship = /intern/i.test(`${title} ${commitment}`);
          const description = stripHtml(j.descriptionPlain || j.description).slice(0, 6000);
          if (!isEntryLevel(title, description)) continue;
          if (!isRelevantLocation(location)) continue;
          const lists = (j.lists ?? []).flatMap((l: any) => (l?.text ? [l.text] : []));
          const skills = extractSkills(`${title} ${description}`);
          if (!isTechRelevant(title, skills, description)) continue;
          jobs.push({
            externalId: `lever-${c}-${j.id}`,
            title,
            company: (c || '').replace(/(^|-)\w/g, (m: string) => m.replace('-', ' ').toUpperCase()),
            location,
            workMode: /remote/i.test(location) ? 'remote' : 'onsite',
            employmentType: isInternshipish(title, description, internship ? 'internship' : 'full-time') ? 'internship' : 'full-time',
            skills: [...lists.filter((s: string) => s && s.length < 24), ...skills],
            description,
            url: j.hostedUrl ?? j.applyUrl ?? '',
            postedAt: j.createdAt ? new Date(Math.floor(j.createdAt / 1000)).toISOString().slice(0, 10) : undefined,
          });
        }
      }
      return { jobs, sourceName: 'Lever', fetchedAt: new Date().toISOString() };
    },
  };
}

// ── Remotive: free public remote-jobs API (good for internships, worldwide) ──
export function remotiveAdapter(): JobSourceAdapter {
  return {
    name: 'Remotive',
    capabilities: { search: true, fetchDetails: true, supportsApply: false },
    isEnabled() { return true; },
    async fetchJobs(): Promise<AdapterResult> {
      const data = await getJson('https://remotive.com/api/remote-jobs?limit=100');
      const jobs: RawJob[] = [];
      for (const j of data?.jobs ?? []) {
        const title: string = j.title ?? '';
        if (!title) continue;
        const internship = /intern|internship|graduate|trainee/i.test(`${title} ${j.category ?? ''}`);
        const india = /india|hyderabad|bengaluru|bangalore|pune|delhi|noida|mumbai/i.test(j.candidate_required_location ?? '');
        if (!india && !/anywhere|worldwide/i.test(j.candidate_required_location ?? '')) continue;
        const description = stripHtml(j.description).slice(0, 6000);
        if (!isEntryLevel(title, description)) continue;
        const skills = extractSkills(`${title} ${description}`);
        if (!isTechRelevant(title, skills, description)) continue;
        jobs.push({
          externalId: `remotive-${j.id}`,
          title,
          company: j.company_name ?? 'Unknown',
          location: india ? (j.candidate_required_location ?? 'India') : 'Remote (Worldwide)',
          workMode: 'remote',
          employmentType: isInternshipish(title, description, internship ? 'internship' : 'full-time') ? 'internship' : 'full-time',
          skills: [...(Array.isArray(j.tags) ? j.tags.filter((t: any) => typeof t === 'string' && t.length < 24) : []), ...skills],
          description,
          url: j.url ?? '',
        });
      }
      return { jobs, sourceName: 'Remotive', fetchedAt: new Date().toISOString() };
    },
  };
}

// ── Keyless public remote-job APIs with strong tech/internship signal ──
function remoteAdapter(opts: { name: string; url: string; listPath: string }): JobSourceAdapter {
  return {
    name: opts.name,
    capabilities: { search: true, fetchDetails: true, supportsApply: false },
    isEnabled() { return true; },
    async fetchJobs(): Promise<AdapterResult> {
      const data: any = await getJson(opts.url);
      // APIs differ: some return an array, some wrap it ({jobs:[...]}, {data:[...]})
      const raw: any[] = Array.isArray(data) ? data : (data?.[opts.listPath] ?? data?.jobs ?? data?.data ?? []);
      const jobs: RawJob[] = [];
      for (const j of raw) {
        const title: string = j.title ?? j.position ?? '';
        const company: string = j.company?.name ?? j.company ?? j.company_name ?? 'Unknown';
        if (!title) continue;
        const location: string =
          j.candidate_required_location ?? j.location ?? j.job_location ?? (j.candidate_required_location?.name ?? '') ?? 'Remote';
        const description = stripHtml(j.description ?? j.job_description ?? j.excerpt ?? '').slice(0, 6000);
        if (!isEntryLevel(title, description)) continue;
        if (!isRelevantLocation(String(location))) continue;
        const skills = extractSkills(`${title} ${description}`);
        if (!isTechRelevant(title, skills, description)) continue;
        const internship = isInternshipish(title, description, 'full-time');
        jobs.push({
          externalId: `${opts.name.toLowerCase()}-${j.id ?? Math.random().toString(36).slice(2)}`,
          title,
          company: typeof company === 'string' ? company : company,
          location,
          workMode: 'remote',
          employmentType: internship ? 'internship' : 'full-time',
          skills,
          description,
          url: j.url ?? j.job_url ?? j.apply_url ?? '',
          postedAt: j.date ?? j.publication_date ?? j.created_at,
        });
      }
      return { jobs, sourceName: opts.name, fetchedAt: new Date().toISOString() };
    },
  };
}

export const himalayasAdapter = remoteAdapter({ name: 'Himalayas', url: 'https://himalayas.app/jobs/api?limit=100', listPath: 'jobs' });
export const remoteokAdapter = remoteAdapter({ name: 'RemoteOK', url: 'https://remoteok.com/api', listPath: 'jobs' });
export const arbeitnowAdapter = remoteAdapter({ name: 'Arbeitnow', url: 'https://www.arbeitnow.com/api/job-board-api', listPath: 'data' });
export const jobicyAdapter = remoteAdapter({ name: 'Jobicy', url: 'https://jobicy.com/api/v2/remote-jobs?count=100', listPath: 'jobs' });

export const realAdapters: JobSourceAdapter[] = [
  greenhouseRealAdapter(),
  leverRealAdapter(),
  remotiveAdapter(),
  himalayasAdapter,
  remoteokAdapter,
  arbeitnowAdapter,
  jobicyAdapter,
];
