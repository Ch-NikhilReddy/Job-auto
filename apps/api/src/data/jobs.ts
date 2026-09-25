export type SeedJob = {
  id: string;
  sourceName: 'LinkedIn Jobs' | 'Internshala' | 'Greenhouse' | 'Official company page';
  title: string;
  company: string;
  location: string;
  workMode: 'remote' | 'hybrid' | 'onsite';
  employmentType: 'internship' | 'full-time' | 'part-time' | 'contract';
  skills: string[];
  description: string;
  salary?: { min?: number; max?: number; currency?: string };
  postedAt: string;
  url: string;
};

export const seededJobs: SeedJob[] = [
  {
    id: 'li-101',
    sourceName: 'LinkedIn Jobs',
    title: 'Frontend Engineer Intern',
    company: 'ByteForge',
    location: 'Hyderabad',
    workMode: 'hybrid',
    employmentType: 'internship',
    skills: ['React', 'TypeScript', 'JavaScript', 'CSS'],
    description: 'Build responsive product interfaces and work with design systems.',
    salary: { min: 20000, max: 40000, currency: 'INR' },
    postedAt: '2026-09-17',
    url: 'https://example.com/jobs/byteforge-frontend-intern',
  },
  {
    id: 'int-204',
    sourceName: 'Internshala',
    title: 'Full Stack Web Developer Internship',
    company: 'CloudNest',
    location: 'Remote',
    workMode: 'remote',
    employmentType: 'internship',
    skills: ['Node.js', 'Express', 'React', 'SQL'],
    description: 'Build internal tools, APIs, and dashboards for a growing startup.',
    salary: { min: 15000, max: 30000, currency: 'INR' },
    postedAt: '2026-09-16',
    url: 'https://example.com/jobs/cloudnest-fullstack-intern',
  },
  {
    id: 'gh-315',
    sourceName: 'Greenhouse',
    title: 'Software Engineer',
    company: 'OpenMinds',
    location: 'Bengaluru',
    workMode: 'onsite',
    employmentType: 'full-time',
    skills: ['Java', 'Spring Boot', 'SQL', 'Git'],
    description: 'Build and scale backend platforms supporting enterprise customers.',
    salary: { min: 900000, max: 1400000, currency: 'INR' },
    postedAt: '2026-09-15',
    url: 'https://example.com/jobs/openminds-software-engineer',
  },
  {
    id: 'of-412',
    sourceName: 'Official company page',
    title: 'Web Developer Intern',
    company: 'NextOrbit',
    location: 'Remote',
    workMode: 'remote',
    employmentType: 'internship',
    skills: ['JavaScript', 'Node.js', 'REST APIs', 'Git'],
    description: 'Work on internal products and learn modern web engineering workflows.',
    salary: { min: 18000, max: 25000, currency: 'INR' },
    postedAt: '2026-09-14',
    url: 'https://example.com/jobs/nextorbit-web-dev-intern',
  },
  {
    id: 'gh-515',
    sourceName: 'Greenhouse',
    title: 'Backend Engineer',
    company: 'SignalStack',
    location: 'Hyderabad',
    workMode: 'hybrid',
    employmentType: 'full-time',
    skills: ['Python', 'FastAPI', 'SQL', 'Docker'],
    description: 'Design APIs, observability, and data processing pipelines.',
    salary: { min: 1000000, max: 1500000, currency: 'INR' },
    postedAt: '2026-09-13',
    url: 'https://example.com/jobs/signalstack-backend-engineer',
  },
  {
    id: 'li-618',
    sourceName: 'LinkedIn Jobs',
    title: 'React Developer',
    company: 'PixelWorks',
    location: 'Remote',
    workMode: 'remote',
    employmentType: 'full-time',
    skills: ['React', 'TypeScript', 'Tailwind', 'Testing'],
    description: 'Design reusable front-end components and collaborate with product teams.',
    salary: { min: 800000, max: 1200000, currency: 'INR' },
    postedAt: '2026-09-10',
    url: 'https://example.com/jobs/pixelworks-react-developer',
  },
  {
    id: 'int-719',
    sourceName: 'Internshala',
    title: 'Java Developer Intern',
    company: 'DataForge Labs',
    location: 'Bengaluru',
    workMode: 'onsite',
    employmentType: 'internship',
    skills: ['Java', 'Spring Boot', 'SQL', 'Git'],
    description: 'Develop a Java backend for analytics and reporting features.',
    salary: { min: 20000, max: 35000, currency: 'INR' },
    postedAt: '2026-09-09',
    url: 'https://example.com/jobs/dataforge-java-intern',
  },
  {
    id: 'of-822',
    sourceName: 'Official company page',
    title: 'Software Engineering Intern',
    company: 'MotiveGrid',
    location: 'Remote',
    workMode: 'remote',
    employmentType: 'internship',
    skills: ['JavaScript', 'React', 'Node.js', 'Git'],
    description: 'Work across the stack with product, QA, and design on real customer features.',
    salary: { min: 18000, max: 32000, currency: 'INR' },
    postedAt: '2026-09-08',
    url: 'https://example.com/jobs/motivegrid-software-intern',
  },
];
