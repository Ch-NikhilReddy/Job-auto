export type RawJob = {
  externalId: string;
  title: string;
  company: string;
  location: string;
  workMode: 'remote' | 'hybrid' | 'onsite';
  employmentType: 'internship' | 'full-time' | 'part-time' | 'contract';
  skills: string[];
  description: string;
  url: string;
  salaryMin?: number;
  salaryMax?: number;
  postedAt?: string;
};

export type AdapterResult = {
  jobs: RawJob[];
  sourceName: string;
  fetchedAt: string;
  error?: string;
};

export interface JobSourceAdapter {
  name: string; // matches JobSource.name in DB
  capabilities: { search: boolean; fetchDetails: boolean; supportsApply: boolean };
  isEnabled(): boolean;
  fetchJobs(query?: { role?: string; location?: string }): Promise<AdapterResult>;
}
