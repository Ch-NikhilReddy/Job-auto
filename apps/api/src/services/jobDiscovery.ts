import { seededJobs } from '../data/jobs.js';

export type DiscoveryFilter = {
  query?: string;
  location?: string;
  employmentType?: string;
  workMode?: string;
};

export function discoverJobs(filter: DiscoveryFilter = {}) {
  const normalizedQuery = (filter.query ?? '').trim().toLowerCase();
  const normalizedLocation = (filter.location ?? '').trim().toLowerCase();

  return seededJobs
    .filter((job) => {
      const text = `${job.title} ${job.company} ${job.description} ${job.skills.join(' ')}`.toLowerCase();
      const matchesQuery = !normalizedQuery || text.includes(normalizedQuery);
      const matchesLocation = !normalizedLocation || job.location.toLowerCase().includes(normalizedLocation) || job.workMode.toLowerCase() === normalizedLocation;
      const matchesEmployment = !filter.employmentType || job.employmentType === filter.employmentType;
      const matchesWorkMode = !filter.workMode || job.workMode === filter.workMode;

      return matchesQuery && matchesLocation && matchesEmployment && matchesWorkMode;
    })
    .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
}
