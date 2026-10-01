import { describe, it, expect } from 'vitest';
import { isEntryLevel, isTechRelevant, isRelevantLocation, extractSkills } from '../adapters/realAdapters.js';
import { scoreJobMatch, type JobPreference } from '../utils/jobMatcher.js';

describe('adapters — relevance gates', () => {
  it('rejects senior titles', () => {
    for (const t of ['Senior Software Engineer', 'Engineering Manager', 'Principal Architect', 'Sr Data Scientist', 'Head of Engineering']) {
      expect(isEntryLevel(t, '')).toBe(false);
    }
  });
  it('accepts entry-level titles', () => {
    for (const t of ['Software Engineer Intern', 'Junior Developer', 'Graduate Engineer Trainee', 'Associate Engineer', 'Full Stack Developer']) {
      expect(isEntryLevel(t, '')).toBe(true);
    }
  });
  it('keeps India and Remote, drops other regions', () => {
    expect(isRelevantLocation('Bengaluru, India')).toBe(true);
    expect(isRelevantLocation('Remote (Worldwide)')).toBe(true);
    expect(isRelevantLocation('New York, USA')).toBe(false);
  });
  it('rejects non-tech noise', () => {
    expect(isTechRelevant('B2B Sales Executive', [], '')).toBe(false);
    expect(isTechRelevant('Video Editor Intern', [], '')).toBe(false);
    expect(isTechRelevant('Software Engineer Intern', [], '')).toBe(true);
    expect(isTechRelevant('Backend Developer', ['node.js', 'sql'], '')).toBe(true);
  });
  it('extracts real skills only', () => {
    const s = extractSkills('We use React, Node.js, MongoDB and TypeScript daily');
    expect(s).toContain('react');
    expect(s).toContain('node.js');
    expect(s).toContain('mongodb');
    expect(extractSkills('a marketing role with no tech')).toHaveLength(0);
  });
});

describe('jobMatcher — transparent scoring', () => {
  const profile: JobPreference = {
    role: 'internship',
    preferredLocations: ['Hyderabad', 'Remote'],
    remoteOk: true,
    workMode: 'hybrid',
    preferredRoles: ['Software Engineer Intern', 'Full Stack Developer Intern'],
    skills: ['React.js', 'Node.js', 'Express.js', 'MongoDB', 'Java', 'Spring Boot', 'MySQL', 'JavaScript'],
    graduationYear: 2027,
    education: 'B.Tech IT',
  };

  it('scores a strong match highly with visible reasons', () => {
    const r = scoreJobMatch(profile, {
      id: '1', title: 'Software Engineer Intern', company: 'Acme', location: 'Hyderabad',
      workMode: 'hybrid', employmentType: 'internship',
      skills: ['React.js', 'Node.js', 'MongoDB'],
      description: 'Fresher role, 0-1 year experience. Work with React, Node.js and MongoDB.',
    });
    expect(r.score).toBeGreaterThan(60);
    expect(r.matchingSkills.length).toBeGreaterThan(2);
    expect(r.breakdown.education.eligible).toBe(true);
    expect(r.breakdown.experience.eligible).toBe(true);
    expect(r.reasoning.length).toBeGreaterThan(3);
  });

  it('hard-blocks senior requirements', () => {
    const r = scoreJobMatch(profile, {
      id: '2', title: 'Senior Engineer', company: 'X', location: 'Hyderabad',
      workMode: 'onsite', employmentType: 'full-time',
      skills: ['Java'], description: 'Requires 5+ years of experience with Java and Spring Boot.',
    });
    expect(r.hardBlockers.length).toBeGreaterThan(0);
  });

  it('flags off-location roles', () => {
    const r = scoreJobMatch(profile, {
      id: '3', title: 'Software Engineer Intern', company: 'X', location: 'Berlin, Germany',
      workMode: 'onsite', employmentType: 'internship',
      skills: ['React.js'], description: 'Internship in Berlin.',
    });
    expect(r.breakdown.location.compatible).toBe(false);
  });

  it('never exceeds 100 and always returns a recommended action', () => {
    const r = scoreJobMatch(profile, {
      id: '4', title: 'Full Stack Developer Intern', company: 'Y', location: 'Remote',
      workMode: 'remote', employmentType: 'internship',
      skills: ['React.js', 'Node.js', 'Express.js', 'MongoDB', 'MySQL', 'Java'],
      description: 'Full stack intern, 0-1 year, fresher eligible.',
    });
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.recommendedAction.length).toBeGreaterThan(0);
  });
});
