import { useEffect, useMemo, useState } from 'react';
import type { DashboardData } from './types';

const initialData: DashboardData = {
  profile: {
    fullName: 'Nikhil Reddy Chittepu',
    education: 'B.Tech — Information Technology, Anurag University, Hyderabad',
    academicStatus: 'Final Year (Expected Graduation 2027)',
    currentCity: 'Hyderabad, Telangana, India',
    objective: 'Seeking Software Engineer Intern / Full-Stack Developer roles — available for 6-month internships + full-time from mid-2027.',
    preferredWork: 'Hybrid / Remote / On-site (Hyderabad preferred)',
    availability: 'Immediate joiner — Hyderabad, Remote',
  },
  metrics: [
    { label: 'New matching jobs', value: 24, trend: '+12%' },
    { label: 'Jobs awaiting review', value: 8, trend: '+3' },
    { label: 'Applications submitted', value: 12, trend: '+2' },
    { label: 'Interviews', value: 3, trend: '+1' },
    { label: 'Resume ATS health', value: '89%', trend: '+8%' },
    { label: 'Skill gaps', value: 4, trend: '-1' },
  ],
  jobs: [
    {
      id: 'job-1',
      title: 'Frontend Engineer Intern',
      company: 'ByteForge',
      location: 'Hyderabad',
      match: 92,
      status: 'High priority',
      reason: 'Strong React + TypeScript alignment',
      skills: ['React', 'TypeScript', 'UI Systems'],
    },
    {
      id: 'job-2',
      title: 'Full Stack Developer',
      company: 'CloudNest',
      location: 'Remote',
      match: 85,
      status: 'Strong fit',
      reason: 'Excellent backend and API experience fit',
      skills: ['Node.js', 'Express', 'SQL'],
    },
    {
      id: 'job-3',
      title: 'Software Engineer Intern',
      company: 'OpenMinds',
      location: 'Bengaluru',
      match: 78,
      status: 'Needs review',
      reason: 'Good technical fit with a few missing skills',
      skills: ['Java', 'System Design'],
    },
  ],
  skillGaps: [
    { skill: 'System Design', coverage: 56 },
    { skill: 'AWS', coverage: 48 },
    { skill: 'Docker', coverage: 62 },
    { skill: 'Data Structures', coverage: 71 },
  ],
  resume: {
    atsHealth: 89,
    strengths: ['Strong React and full-stack foundation', 'Clear project stories and GitHub footprint', 'Good alignment with internship targets'],
    improvements: ['Add AWS and Docker keywords', 'Clarify internship impact metrics', 'Add one more project with leadership angle'],
  },
  automation: {
    mode: 'Discovery mode',
    sources: ['LinkedIn Jobs', 'Internshala', 'Greenhouse', 'Official company pages'],
    approvalRequired: true,
    lastRun: '2 minutes ago',
    nextRun: 'In 30 minutes',
  },
  notifications: ['3 new high-priority matches', 'Resume review recommended for 2 roles', 'Application approval needed for one internship'],
};

export default function App() {
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [employmentType, setEmploymentType] = useState('all');
  const [workMode, setWorkMode] = useState('all');
  const [applications, setApplications] = useState<any[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [manualForm, setManualForm] = useState({ title: '', company: '', location: 'Hyderabad', description: '' });
  const [showManual, setShowManual] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [prepared, setPrepared] = useState<any>(null);
  const [approvalPkg, setApprovalPkg] = useState<any>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await fetch(`http://localhost:4000/jobs?query=${encodeURIComponent(query)}&employmentType=${encodeURIComponent(employmentType === 'all' ? '' : employmentType)}&workMode=${encodeURIComponent(workMode === 'all' ? '' : workMode)}`);
        const jobsResponse = await fetch('http://localhost:4000/dashboard');
        if (!response.ok || !jobsResponse.ok) {
          throw new Error('Unable to load dashboard');
        }

        const jobsPayload = await response.json();
        const dashboardPayload = await jobsResponse.json();

        setData({
          ...dashboardPayload.data,
          jobs: jobsPayload.jobs.map((job: any) => ({
            id: job.id,
            title: job.title,
            company: job.company,
            location: job.location,
            match: Math.min(98, Math.max(50, 90 - (job.skills.length * 2))),
            status: job.sourceName,
            reason: `${job.workMode} ${job.employmentType} opportunity from ${job.sourceName}`,
            skills: job.skills.slice(0, 4),
          })),
        });
      } catch (error) {
        console.warn('Using fallback mock data because the API is not running yet.', error);
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, [query, employmentType, workMode]);

  const [liveNotifications, setLiveNotifications] = useState<any[]>([]);
  useEffect(() => {
    const loadApps = async () => {
      try {
        const r = await fetch('http://localhost:4000/applications');
        if (r.ok) { const j = await r.json(); setApplications(j.applications ?? []); }
      } catch {}
    };
    void loadApps();
  }, []);

  useEffect(() => {
    const loadNotifs = async () => {
      try {
        const r = await fetch('http://localhost:4000/notifications');
        if (r.ok) { const j = await r.json(); if (j.notifications?.length) setLiveNotifications(j.notifications); }
      } catch {}
    };
    void loadNotifs();
    const id = setInterval(loadNotifs, 30000);
    return () => clearInterval(id);
  }, []);

  const profileBlocks = useMemo(
    () => [
      ['Education', data.profile.education],
      ['Academic status', data.profile.academicStatus],
      ['Location', data.profile.currentCity],
      ['Goal', data.profile.objective],
      ['Work preference', data.profile.preferredWork],
      ['Availability', data.profile.availability],
    ],
    [data],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-400">CareerPilot AI</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Career dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">{data.automation.mode}</span>
            <button onClick={() => setShowManual(v => !v)} className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700">+ Manual job</button>
            <button className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">Run discovery</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {data.metrics.map((metric) => (
            <div key={metric.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg shadow-cyan-950/20">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{metric.label}</div>
              <div className="mt-3 text-3xl font-bold text-cyan-400">{metric.value}</div>
              <div className="mt-2 text-xs text-emerald-300">{metric.trend}</div>
            </div>
          ))}
        </section>

        {showManual && (
          <section className="mt-6 rounded-2xl border border-cyan-800 bg-slate-900 p-5">
            <h3 className="text-sm font-semibold text-white">Manual job import (Phase 1C)</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <input value={manualForm.title} onChange={e => setManualForm({ ...manualForm, title: e.target.value })} placeholder="Title *" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input value={manualForm.company} onChange={e => setManualForm({ ...manualForm, company: e.target.value })} placeholder="Company *" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input value={manualForm.location} onChange={e => setManualForm({ ...manualForm, location: e.target.value })} placeholder="Location" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <button onClick={async () => {
                if (!manualForm.title || !manualForm.company) return alert('Title and Company required');
                const r = await fetch('http://localhost:4000/jobs/manual-import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...manualForm, skills: [], workMode: 'hybrid', employmentType: 'internship' }) });
                const j = await r.json();
                if (!r.ok) alert(j.error + (j.existingId ? ` (${j.existingId})` : ''));
                else { setManualForm({ title: '', company: '', location: 'Hyderabad', description: '' }); setShowManual(false); location.reload(); }
              }} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950">Import</button>
            </div>
            <input value={manualForm.description} onChange={e => setManualForm({ ...manualForm, description: e.target.value })} placeholder="Description *" className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
          </section>
        )}

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search jobs, skills, or companies"
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none ring-0 placeholder:text-slate-500"
            />
            <select value={employmentType} onChange={(event) => setEmploymentType(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none">
              <option value="all">All types</option>
              <option value="internship">Internship</option>
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="contract">Contract</option>
            </select>
            <select value={workMode} onChange={(event) => setWorkMode(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none">
              <option value="all">All modes</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
            </select>
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Recommended jobs</h2>
              <span className="text-sm text-slate-400">{data.jobs.length} results</span>
            </div>
            <div className="space-y-4">
              {data.jobs.map((job) => (
                <div key={job.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="text-lg font-semibold">{job.title}</h3>
                        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-violet-300">{job.status}</span>
                      </div>
                      <p className="text-sm text-slate-400">{job.company} • {job.location}</p>
                    </div>
                    <div className="text-left md:text-right">
                      <div className="text-xl font-bold text-cyan-400">{job.match}%</div>
                      <div className="text-xs text-slate-400">match score</div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-300">{job.reason}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {job.skills.map((skill) => (
                      <span key={skill} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-300">{skill}</span>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button onClick={async () => {
                      setMatchLoading(true);
                      try {
                        const r = await fetch(`http://localhost:4000/jobs/${job.id}/match`);
                        const j = await r.json();
                        setSelectedMatch(j.match ? { ...j, jobId: job.id } : j);
                      } catch { alert('Match fetch failed'); }
                      setMatchLoading(false);
                    }} className="rounded-md border border-cyan-700 bg-cyan-950 px-3 py-1 text-xs text-cyan-300 hover:bg-cyan-900">{matchLoading && selectedMatch?.jobId === job.id ? 'Analyzing…' : '🔍 Analyze Match'}</button>
                    <button onClick={async () => {
                      const r = await fetch(`http://localhost:4000/jobs/${job.id}/save`, { method: 'POST' });
                      const j = await r.json();
                      setSavedIds(prev => { const n = new Set(prev); if (j.isSaved) n.add(job.id); else n.delete(job.id); return n; });
                    }} className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700">{savedIds.has(job.id) ? '★ Saved' : '☆ Save'}</button>
                    <button onClick={async () => {
                      const r = await fetch(`http://localhost:4000/jobs/${job.id}/prepare`, { method: 'POST' });
                      const j = await r.json();
                      setPrepared({ ...j, jobId: job.id });
                      if (!r.ok && j.error === 'QA_BLOCKED') alert('QA Blocked: ' + j.qa.blockers.join(' | '));
                    }} className="rounded-md border border-violet-700 bg-violet-950 px-3 py-1 text-xs text-violet-300 hover:bg-violet-900">Tailor Resume + Cover</button>
                    <button onClick={async () => {
                      const r = await fetch('http://localhost:4000/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: job.id, company: job.company, title: job.title }) });
                      const j = await r.json();
                      if (!r.ok) alert(j.error); else { const r2 = await fetch('http://localhost:4000/applications'); const j2 = await r2.json(); setApplications(j2.applications ?? []); }
                    }} className="rounded-md bg-cyan-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-cyan-400">Prepare Application</button>
                  </div>
                  {selectedMatch?.jobId === job.id && selectedMatch.match && (
                    <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900 p-4 text-xs">
                      <div className="flex justify-between items-center"><span className="font-bold text-white">Match: {selectedMatch.match.score ?? selectedMatch.score}%</span><span className="text-slate-400">{selectedMatch.match.recommendedAction ?? selectedMatch.recommendedAction}</span></div>
                      {selectedMatch.match.breakdown && (
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
                          <div className={`rounded-lg p-2 border ${selectedMatch.match.breakdown.skills.missing.length > 2 ? 'border-amber-700 bg-amber-950/30' : 'border-emerald-800 bg-emerald-950/20'}`}>Skills: {selectedMatch.match.breakdown.skills.matching.length}✓ / {selectedMatch.match.breakdown.skills.missing.length}⚠️<div className="text-slate-400 truncate">✓{selectedMatch.match.breakdown.skills.matching.slice(0,3).join(', ')} {selectedMatch.match.breakdown.skills.missing.length ? `⚠️${selectedMatch.match.breakdown.skills.missing.slice(0,2).join(', ')}` : ''}</div></div>
                          <div className={`rounded-lg p-2 border ${selectedMatch.match.breakdown.education.eligible ? 'border-emerald-800 bg-emerald-950/20' : 'border-red-800 bg-red-950/30'}`}>Education: {selectedMatch.match.breakdown.education.eligible ? '✓' : '✗'}<div className="text-slate-400">{selectedMatch.match.breakdown.education.reason.slice(0,50)}</div></div>
                          <div className={`rounded-lg p-2 border ${selectedMatch.match.breakdown.experience.eligible ? 'border-emerald-800 bg-emerald-950/20' : 'border-red-800 bg-red-950/30'}`}>Exp: {selectedMatch.match.breakdown.experience.eligible ? '✓ Fresher' : `✗ ${selectedMatch.match.breakdown.experience.requiredYears}y`}</div>
                          <div className={`rounded-lg p-2 border ${selectedMatch.match.breakdown.location.compatible ? 'border-emerald-800 bg-emerald-950/20' : 'border-amber-700 bg-amber-950/30'}`}>Location: {selectedMatch.match.breakdown.location.compatible ? '✓' : '⚠️'}<div className="text-slate-400">{selectedMatch.match.breakdown.location.reason.slice(0,40)}</div></div>
                          <div className={`rounded-lg p-2 border ${selectedMatch.match.breakdown.role.relevant ? 'border-emerald-800 bg-emerald-950/20' : 'border-slate-700 bg-slate-800'}`}>Role: {selectedMatch.match.breakdown.role.relevant ? '✓ Relevant' : '○ Limited'}</div>
                          <div className="rounded-lg p-2 border border-slate-700 bg-slate-800">Grad: ✓ 2027 eligible</div>
                        </div>
                      )}
                      {selectedMatch.match.hardBlockers?.length > 0 && <div className="mt-2 rounded-lg bg-red-950/40 border border-red-800 p-2 text-red-300">⛔ {selectedMatch.match.hardBlockers.join(' • ')}</div>}
                      <div className="mt-2 text-slate-400">{selectedMatch.match.reasoning?.join(' • ')}</div>
                      <button onClick={() => setSelectedMatch(null)} className="mt-2 text-slate-500 hover:text-slate-300">Close</button>
                    </div>
                  )}
                  {prepared?.jobId === job.id && (
                    <div className={`mt-3 rounded-xl border p-4 text-xs ${prepared.ok === false ? 'border-red-800 bg-red-950/20' : 'border-violet-800 bg-violet-950/20'}`}>
                      {prepared.ok === false ? (
                        <>
                          <div className="font-bold text-red-300">⛔ QA Blocked — fix before approval</div>
                          <div className="mt-2 text-red-300">{prepared.qa.blockers.join(' • ')}</div>
                          {prepared.qa.warnings.length > 0 && <div className="mt-1 text-amber-300">⚠️ {prepared.qa.warnings.join(' • ')}</div>}
                          <div className="mt-2 text-slate-400">Checks: {prepared.qa.checks.map((c:any)=> `${c.name}: ${c.passed?'✓':'✗'}`).join(' | ')}</div>
                        </>
                      ) : (
                        <>
                          <div className="font-bold text-white">Tailored Resume ✓ — {prepared.tailoredResume.atsKeywords.slice(0,4).join(', ')}</div>
                          <div className="mt-1 text-slate-300">{prepared.tailoredResume.summary}</div>
                          <div className="mt-2 text-slate-400">Projects reordered: {prepared.tailoredResume.reorderedProjects.slice(0,3).map((p:any)=>`${p.name} (${p.reason})`).join(' → ')}</div>
                          {prepared.qa?.warnings?.length > 0 && <div className="mt-2 text-amber-300">⚠️ {prepared.qa.warnings.join(' • ')}</div>}
                          <div className="mt-3 flex gap-2">
                            <a href={`http://localhost:4000${prepared.files.download.resumeUrl}`} target="_blank" className="rounded-md bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-500">⬇ Resume DOCX</a>
                            <a href={`http://localhost:4000${prepared.files.download.coverUrl}`} target="_blank" className="rounded-md bg-violet-600 px-3 py-1 text-white hover:bg-violet-500">⬇ Cover PDF</a>
                          </div>
                          <div className="mt-3 rounded-lg bg-slate-900 p-3 border border-slate-700 whitespace-pre-wrap text-slate-200">{prepared.coverLetter.body.slice(0,600)}...</div>
                          <div className="mt-1 text-[10px] text-emerald-400">{prepared.truthfulness}</div>
                        </>
                      )}
                      <button onClick={() => setPrepared(null)} className="mt-2 text-slate-500 hover:text-slate-300">Close</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold text-white">Profile snapshot</h2>
              <div className="mt-5 space-y-3">
                {profileBlocks.map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
                    <div className="mt-1 text-sm text-slate-200">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold text-white">Automation</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <div><span className="text-slate-500">Mode:</span> {data.automation.mode}</div>
                <div><span className="text-slate-500">Sources:</span> {data.automation.sources.join(', ')}</div>
                <div><span className="text-slate-500">Approval required:</span> {data.automation.approvalRequired ? 'Yes' : 'No'}</div>
                <div><span className="text-slate-500">Last run:</span> {data.automation.lastRun}</div>
                <div><span className="text-slate-500">Next run:</span> {data.automation.nextRun}</div>
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold text-white">Resume intelligence</h2>
            <div className="mt-4 text-4xl font-bold text-cyan-400">{data.resume.atsHealth}%</div>
            <div className="mt-4 text-sm text-slate-400">ATS-oriented health estimate</div>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              {data.resume.strengths.map((strength) => (
                <li key={strength}>• {strength}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold text-white">Skill gaps</h2>
            <div className="mt-5 space-y-4">
              {data.skillGaps.map((gap) => (
                <div key={gap.skill}>
                  <div className="mb-1 flex items-center justify-between text-sm text-slate-300">
                    <span>{gap.skill}</span>
                    <span>{gap.coverage}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-cyan-500" style={{ width: `${gap.coverage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex justify-between items-center"><h2 className="text-xl font-semibold text-white">Notifications</h2><span className="text-xs bg-cyan-900 text-cyan-300 px-2 py-0.5 rounded-full">{liveNotifications.length || data.notifications.length} total</span></div>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              {(liveNotifications.length ? liveNotifications : data.notifications.map((n:any)=> ({ title: n, message: n }))).slice(0,5).map((n:any, i:number) => (
                <li key={n.id ?? i} className={`rounded-lg border p-3 ${n.isRead===false ? 'border-cyan-800 bg-cyan-950/20' : 'border-slate-800 bg-slate-950'}`}>
                  <div className="font-semibold text-white">{n.title ?? n}</div>
                  {n.message && n.message !== n.title && <div className="text-xs text-slate-400">{n.message}</div>}
                  {n.isRead===false && <button onClick={async()=>{ await fetch(`http://localhost:4000/notifications/${n.id}/read`, { method: 'PATCH' }); setLiveNotifications(prev=>prev.map(x=> x.id===n.id ? {...x, isRead:true}:x)); }} className="mt-1 text-[10px] text-cyan-400">Mark read</button>}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Applications tracker (Phase 1C)</h2>
            <span className="text-sm text-slate-400">{applications.length} tracked</span>
          </div>
          {applications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 p-6 text-sm text-slate-400">No applications yet — use "Prepare Application" on any job card. Pipeline: DISCOVERED → MATCHED → READY → APPROVAL_REQUIRED → APPROVED → APPLIED → INTERVIEW → OFFER</div>
          ) : (
            <div className="space-y-3">
              {applications.map((a: any) => (
                <div key={a.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div><div className="font-semibold">{a.title ?? a.job?.title} — {a.company ?? a.job?.companyName}</div><div className="text-xs text-slate-500">{a.jobId} • {new Date(a.createdAt ?? a.firstSeenAt).toLocaleDateString()}</div></div>
                    <span className="mt-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-300 md:mt-0">{a.status}</span>
                  </div>
                  {a.events && <div className="mt-2 text-xs text-slate-400">History: {a.events.map((e: any) => e.type ?? e.eventType).join(' → ')}</div>}
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button onClick={async () => {
                      const r = await fetch(`http://localhost:4000/applications/${a.id}/prepare`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questions: [{ key: 'why_interested', text: 'Why are you interested in this role?' }, { key: 'visa', text: 'Do you require visa sponsorship?' }] }) });
                      const j = await r.json(); setApprovalPkg({ ...j, appId: a.id });
                    }} className="rounded-md border border-violet-700 bg-violet-950 px-3 py-1 text-xs text-violet-300">View Approval Package</button>
                    <button onClick={async () => {
                      const r = await fetch(`http://localhost:4000/applications/${a.id}/check`); const j = await r.json(); setApprovalPkg({ ...j, appId: a.id, isCheck: true });
                    }} className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1 text-xs text-slate-300">Check Submit</button>
                    {a.status === 'APPROVAL_REQUIRED' && (
                      <button onClick={async () => {
                        const r = await fetch(`http://localhost:4000/applications/${a.id}/approve`, { method: 'POST' });
                        if (r.ok) { const r2 = await fetch('http://localhost:4000/applications'); const j2 = await r2.json(); setApplications(j2.applications ?? []); }
                      }} className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950">✓ APPROVE</button>
                    )}
                    {a.status === 'APPROVED' && (
                      <button onClick={async () => {
                        const r = await fetch(`http://localhost:4000/applications/${a.id}/submit`, { method: 'POST' });
                        const j = await r.json();
                        if (!r.ok) { setApprovalPkg({ ...j, appId: a.id, isCheck: true }); alert('Submit blocked: ' + (j.checks?.filter((c:any)=>c.blocker && !c.passed).map((c:any)=>c.reason).join(' | ') ?? j.error)); }
                        else { const r2 = await fetch('http://localhost:4000/applications'); const j2 = await r2.json(); setApplications(j2.applications ?? []); }
                      }} className="rounded-md bg-cyan-500 px-3 py-1 text-xs font-semibold text-slate-950">→ SUBMIT (permitted)</button>
                    )}
                    <button onClick={async () => {
                      const r = await fetch(`http://localhost:4000/applications/${a.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'WITHDRAWN', note: 'Skipped by user' }) });
                      if (r.ok) { const r2 = await fetch('http://localhost:4000/applications'); const j2 = await r2.json(); setApplications(j2.applications ?? []); }
                    }} className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1 text-xs text-slate-300">SKIP</button>
                  </div>
                  {approvalPkg?.appId === a.id && (
                    <div className={`mt-3 rounded-xl border p-4 text-xs ${approvalPkg.isCheck ? 'border-cyan-800 bg-cyan-950/20' : 'border-slate-700 bg-slate-900'}`}>
                      <div className="font-bold text-white">{approvalPkg.isCheck ? 'Submit Check — Safe Criteria' : `Approval Package — ${approvalPkg.job.company} — ${approvalPkg.job.title}`}</div>
                      {approvalPkg.isCheck ? (
                        <>
                          <div className={`mt-2 font-bold ${approvalPkg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{approvalPkg.ok ? '✓ PASS — can submit after APPROVE' : '⛔ BLOCKED'}</div>
                          {approvalPkg.checks?.map((c:any, i:number) => (
                            <div key={i} className={`mt-1 rounded p-2 border text-[11px] ${c.passed ? 'border-emerald-800 bg-emerald-950/20' : c.blocker ? 'border-red-800 bg-red-950/30' : 'border-slate-700'}`}>{c.passed ? '✓' : c.blocker ? '⛔' : '○'} {c.reason}</div>
                          ))}
                        </>
                      ) : (
                        <>
                          <div className="mt-1 text-slate-400">Mode: {approvalPkg.mode} • Needs user: {approvalPkg.needsUser?.length ?? 0}</div>
                          {approvalPkg.answers?.map((ans:any) => (
                            <div key={ans.key} className={`mt-2 rounded-lg p-3 border ${ans.needsUser ? 'border-amber-700 bg-amber-950/30' : 'border-emerald-800 bg-emerald-950/20'}`}>
                              <div className="font-semibold">{ans.question} {ans.needsUser && <span className="text-amber-400">⚠️ FLAG FOR USER</span>}</div>
                              <div className="mt-1 text-slate-300">{ans.answer || <span className="text-slate-500">— empty (needs your input) —</span>}</div>
                              <div className="mt-1 text-[10px] text-slate-500">Source: {ans.source} • {ans.reason ?? ''}</div>
                            </div>
                          ))}
                        </>
                      )}
                      <button onClick={() => setApprovalPkg(null)} className="mt-2 text-slate-500 hover:text-slate-300">Close</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {loading && (
          <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
            Loading live discovery data...
          </div>
        )}
      </main>
    </div>
  );
}
