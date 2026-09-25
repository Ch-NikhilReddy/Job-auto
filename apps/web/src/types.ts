export type Metric = {
  label: string;
  value: number | string;
  trend: string;
};

export type JobItem = {
  id: string;
  title: string;
  company: string;
  location: string;
  match: number;
  status: string;
  reason: string;
  skills: string[];
};

export type SkillGap = {
  skill: string;
  coverage: number;
};

export type DashboardData = {
  profile: {
    fullName: string;
    education: string;
    academicStatus: string;
    currentCity: string;
    objective: string;
    preferredWork: string;
    availability: string;
  };
  metrics: Metric[];
  jobs: JobItem[];
  skillGaps: SkillGap[];
  resume: {
    atsHealth: number;
    strengths: string[];
    improvements: string[];
  };
  automation: {
    mode: string;
    sources: string[];
    approvalRequired: boolean;
    lastRun: string;
    nextRun: string;
  };
  notifications: string[];
};
