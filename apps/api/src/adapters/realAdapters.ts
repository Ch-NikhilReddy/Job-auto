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
  'leader', 'architect', 'vp', 'vice president', 'chief', 'partner', 'counsel',
  'experienced', 'expert', 'associate director', 'associate vice',
  'general manager', 'associate partner', 'supervisor',
];

// Numbered/roman seniority ladders that the substring list above misses.
// Verified against live data: "Software Engineer 3" (MongoDB Gurugram) and
// "Lead, Platform Engineering" both passed the old gate — the old 'lead ' entry
// required a trailing space, so "Lead," never matched. These are not applyable
// by a 2027-graduate intern seeker.
const SENIOR_LEVEL_RE = [
  /\blead\b/,                                  // Lead, / Team Lead / Lead Engineer
  /\b(?:ii|iii|iv|v)\b/,                        // SWE II / Engineer III
  /\b(?:l|sw|eng|software|developer)?\s*(?:level\s*)?[2-5]\b(?!\.\d)/, // L3 / Engineer 3 / SWE2
];

export function isEntryLevel(title: string, description: string): boolean {
  const t = title.toLowerCase();
  if (SENIOR_BLOCKLIST.some((s) => t.includes(s))) return false;
  if (SENIOR_LEVEL_RE.some((re) => re.test(t))) return false;
  return true;
}

const ENTRY_HINTS = [
  'intern', 'internship', 'trainee', 'graduate', 'fresher', 'entry', 'junior', 'jr.',
  'campus', 'apprentice', 'co-op', 'coop', 'new grad', '0-1', '0 - 1', 'associate',
  'engineer i', 'software engineer', 'developer', 'sde', 'engineer',
];

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

// A bare "remote" match is not enough. Verified against live data: MongoDB's
// "Remote - United States", Twilio's "Remote - United Kingdom", Replit's
// "Remote - Japan" and Ramp's "Remote (US)" all passed the old gate because the
// string contains "remote" — none of them are applyable from Hyderabad.
const REMOTE_ANYWHERE_RE = /worldwide|world wide|global|anywhere|india|apac|asia/i;
const REGION_LOCKED_RE = /united states|\busa\b|\bus\b|canada|ontario|toronto|vancouver|quebec|calgary|united kingdom|\buk\b|ireland|france|germany|netherlands|spain|portugal|italy|austria|sweden|norway|denmark|finland|poland|australia|new zealand|japan|singapore|brazil|mexico|latam|latin|\bamer\b|emea|colombia|argentina|chile|turkey|israel|dubai|\buae\b|qatar|saudi|hong kong|taiwan|philippines|indonesia|vietnam|thailand|malaysia|south africa|nigeria|kenya|ghana|egypt|california|san francisco|\bnyc\b|new york|texas|seattle|portland|denver|austin|boston|chicago|san jose|los angeles|atlanta|miami|dallas|philadelphia|bay area|pacific|mountain time|central time|eastern time/;

export function isRelevantLocation(location: string): boolean {
  const l = (location ?? '').toLowerCase();
  if (!l) return true; // unknown → keep, matcher scores it later
  if (INDIA_RE.test(l)) return true;
  if (!REMOTE_RE.test(l)) return false;
  // Remote, but scoped — keep only if it is genuinely worldwide / APAC / India.
  if (REMOTE_ANYWHERE_RE.test(l)) return true;
  return !REGION_LOCKED_RE.test(l);
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

// VERIFIED 2026-10-03 by probing boards-api.greenhouse.io directly.
// The previous list of 29 was almost entirely dead: 26 of 29 returned HTTP 404.
// Company names are NOT Greenhouse board tokens, and most of these companies do
// not use Greenhouse at all. Only the tokens below were confirmed HTTP 200.
// Override with GREENHOUSE_BOARDS to add your own.
const GREENHOUSE_BOARDS = envList(process.env.GREENHOUSE_BOARDS, [
  'mongodb', 'gitlab', 'twilio', 'samsara', 'planetscale', 'vercel',
  'databricks', 'mixpanel', 'slice', 'groww',
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
// VERIFIED 2026-10-03 against api.lever.co. Previous list of 14 had 11 dead
// tokens (404). Override with LEVER_COMPANIES.
const LEVER_COMPANIES = envList(process.env.LEVER_COMPANIES, [
  'meesho', 'cred', 'fi',
]);

// Ashby — public, keyless posting API. Was NOT integrated at all before.
// VERIFIED 2026-10-03: these tokens return HTTP 200 AND survive the India/remote
// gates. Notion (Hyderabad), cursor (Bengaluru), cognition (India) and openai
// (Delhi) are genuine India-eligible hits.
const ASHBY_BOARDS = envList(process.env.ASHBY_BOARDS, [
  'Notion', 'cursor', 'cognition', 'openai', 'Supabase', 'runpod',
]);

export function ashbyRealAdapter(): JobSourceAdapter {
  return {
    name: 'Ashby',
    capabilities: { search: true, fetchDetails: true, supportsApply: true },
    isEnabled() { return ASHBY_BOARDS.length > 0; },
    async fetchJobs(): Promise<AdapterResult> {
      const jobs: RawJob[] = [];
      const results = await Promise.all(
        ASHBY_BOARDS.map(async (token) => ({ token, data: await getJson(`https://api.ashbyhq.com/posting-api/job-board/${token}`) }))
      );
      for (const { token, data } of results) {
        for (const j of data?.jobs ?? []) {
          const title: string = j?.title ?? '';
          if (!title) continue;
          const loc = j?.location ?? 'Remote';
          const description = stripHtml(j?.descriptionHtml ?? j?.descriptionPlain ?? j?.description ?? '').slice(0, 6000);
          if (!isEntryLevel(title, description)) continue;
          if (!isRelevantLocation(loc)) continue;
          const skills = extractSkills(`${title} ${description}`);
          if (!isTechRelevant(title, skills, description)) continue;
          jobs.push({
            externalId: `ashby-${token}-${j.id}`,
            title,
            company: token,
            location: loc,
            workMode: /remote/i.test(loc) ? 'remote' : 'hybrid',
            employmentType: isInternshipish(title, description, 'full-time') ? 'internship' : 'full-time',
            skills,
            description,
            url: j?.jobUrl ?? j?.applyUrl,
            postedAt: j?.publishedAt ? String(j.publishedAt).slice(0, 10) : undefined,
          });
        }
      }
      return { jobs, sourceName: 'Ashby', fetchedAt: new Date().toISOString() };
    },
  };
}

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
  ashbyRealAdapter(),
  remotiveAdapter(),
  himalayasAdapter,
  remoteokAdapter,
  arbeitnowAdapter,
  jobicyAdapter,
];
