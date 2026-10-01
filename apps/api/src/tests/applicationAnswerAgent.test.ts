import { describe, it, expect } from 'vitest';
import { answerQuestion, answerQuestions, DEFAULT_QUESTIONS } from '../services/applicationAnswerAgent.js';

const job = { title: 'Backend Intern', company: 'Acme', description: 'Node.js and Express role' };

describe('applicationAnswerAgent — §19 never guess', () => {
  it('answers from verified profile', () => {
    const a = answerQuestion(job, { key: 'edu', text: 'What is your education?' });
    expect(a.needsUser).toBe(false);
    expect(a.source).toBe('PROFILE');
    expect(a.answer).toMatch(/B\.Tech/i);
    expect(a.answer).toMatch(/2027/);
  });

  it('answers motivation with job + company context', () => {
    const a = answerQuestion(job, { key: 'why', text: 'Why are you interested in this role?' });
    expect(a.needsUser).toBe(false);
    expect(a.answer).toContain('Backend Intern');
    expect(a.answer).toContain('Acme');
  });

  const mustAskUser = [
    'Do you require visa sponsorship?',
    'Are you authorized to work in the United States?',
    'What is your expected salary?',
    'What is your expected CTC?',
    'How many years of professional experience do you have?',
    'Are you willing to relocate?',
    'Do you consent to a background check?',
    'What is your gender?',
    'Do you have a disability?',
  ];
  for (const q of mustAskUser) {
    it(`FLAGS for user instead of guessing: "${q}"`, () => {
      const a = answerQuestion(job, { key: 'k', text: q });
      expect(a.needsUser).toBe(true);
      expect(a.source).toBe('UNKNOWN');
      expect(a.answer).toBe('');
    });
  }

  it('flags an unrecognised question rather than inventing', () => {
    const a = answerQuestion(job, { key: 'odd', text: 'Describe your favourite childhood pet in detail' });
    expect(a.needsUser).toBe(true);
    expect(a.answer).toBe('');
  });

  it('batches questions and counts blockers', () => {
    const all = answerQuestions(job, [...DEFAULT_QUESTIONS, { key: 'visa', text: 'Visa sponsorship?' }]);
    expect(all.length).toBe(3);
    expect(all.filter((a) => a.needsUser).length).toBe(1);
  });
});
