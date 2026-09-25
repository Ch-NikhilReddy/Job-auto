import type { JobSourceAdapter, AdapterResult } from './types.js';
import { seededJobs } from '../data/jobs.js';

// Greenhouse is the only adapter enabled for real discovery in Phase 2
// Others are discovery/link-out stubs per §3 (ToS-safe). Greenhouse uses public board pattern.
// Phase 2: uses seededJobs as mock Greenhouse feed; replace with fetch('https://boards-api.greenhouse.io/v1/boards/{board}/jobs') when boards are configured.

export const greenhouseAdapter: JobSourceAdapter = {
  name: 'Greenhouse',
  capabilities: { search: true, fetchDetails: true, supportsApply: false },
  isEnabled() { return true; },
  async fetchJobs(): Promise<AdapterResult> {
    // Filter to Greenhouse-seeded jobs as mock feed
    const jobs = seededJobs.filter(j => j.sourceName === 'Greenhouse').map(j => ({
      externalId: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
      workMode: j.workMode,
      employmentType: j.employmentType,
      skills: j.skills,
      description: j.description,
      url: j.url,
      salaryMin: j.salary?.min,
      salaryMax: j.salary?.max,
      postedAt: j.postedAt,
    }));
    return { jobs, sourceName: this.name, fetchedAt: new Date().toISOString() };
  },
};

export const stubAdapters: JobSourceAdapter[] = [
  {
    name: 'LinkedIn Jobs',
    capabilities: { search: false, fetchDetails: false, supportsApply: false },
    isEnabled() { return false; }, // ToS-gated — discovery/link-out only
    async fetchJobs() { return { jobs: [], sourceName: 'LinkedIn Jobs', fetchedAt: new Date().toISOString(), error: 'Adapter disabled — requires permitted integration (see §3.1). Use manual import.' }; },
  },
  {
    name: 'Internshala',
    capabilities: { search: false, fetchDetails: false, supportsApply: false },
    isEnabled() { return false; },
    async fetchJobs() { return { jobs: [], sourceName: 'Internshala', fetchedAt: new Date().toISOString(), error: 'ToS-gated — discovery/link-out only.' }; },
  },
  {
    name: 'Official company page',
    capabilities: { search: false, fetchDetails: false, supportsApply: false },
    isEnabled() { return false; },
    async fetchJobs() { return { jobs: [], sourceName: 'Official company page', fetchedAt: new Date().toISOString(), error: 'Generic connector requires per-company allowlist.' }; },
  },
];

export const allAdapters: JobSourceAdapter[] = [greenhouseAdapter, ...stubAdapters];
