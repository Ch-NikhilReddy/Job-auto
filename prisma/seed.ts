import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding CareerPilot DB for Nikhil Reddy Chittepu...');

  // Upsert user
  const user = await prisma.user.upsert({
    where: { email: 'nikhilreddynikhil988@gmail.com' },
    update: { fullName: 'Nikhil Reddy Chittepu' },
    create: {
      id: 'user-demo-nikhil',
      email: 'nikhilreddynikhil988@gmail.com',
      fullName: 'Nikhil Reddy Chittepu',
    },
  });
  console.log('User:', user.id);

  // Upsert profile
  const profile = await prisma.profile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      fullName: 'Nikhil Reddy Chittepu',
      currentCity: 'Hyderabad, Telangana, India',
      portfolioUrl: 'https://nikhilreddy.dpdns.org',
      githubUrl: 'https://github.com/Ch-NikhilReddy',
      linkedinUrl: 'https://linkedin.com/in/ch-nikhil-reddy',
      preferredLocations: ['Hyderabad', 'Remote', 'Bengaluru'],
      willingnessToRelocate: false,
      remoteOk: true,
      educationDegree: 'B.Tech',
      educationBranch: 'Information Technology',
      university: 'Anurag University, Hyderabad',
      graduationYear: 2027,
      cgpa: '6.78 / 10.0',
    },
  });
  console.log('Profile:', profile.id);

  // Skills — from verified resume (never invent beyond this)
  const skills = [
    'React.js','Next.js','JavaScript','TypeScript','HTML5','CSS3','Bootstrap','Tailwind CSS',
    'Node.js','Express.js','Spring Boot','MongoDB','MySQL','REST APIs','JWT Authentication','Role-Based Access Control',
    'Git','GitHub','Postman','Vercel','Leaflet.js','Zustand','Axios',
  ];
  for (const name of skills) {
    await prisma.skill.upsert({
      where: { profileId_name: { profileId: profile.id, name } },
      update: {},
      create: { profileId: profile.id, name, category: 'verified', source: 'resume' },
    });
  }
  console.log('Skills seeded:', skills.length);

  // Projects
  const projects = [
    { name: 'Smart Hostel Complaint & Maintenance Management System', description: 'Role-based hostel management with Spring Boot + React + MySQL', url: 'https://github.com/Ch-NikhilReddy/Smart-Hostel', techStack: ['React.js','Spring Boot','MySQL'] },
    { name: 'Gas Agency Management System', description: 'MERN booking with JWT + email notifications', url: 'https://github.com/Ch-NikhilReddy/Gas-Agency', techStack: ['MongoDB','Express.js','React.js','Node.js'] },
    { name: 'Civic Issues Portal', description: 'Hackathon Winner — MLRIT — Leaflet geolocated reporting, 3-tier roles', url: 'https://github.com/Ch-NikhilReddy/civic', techStack: ['React','Tailwind','Leaflet','Node.js','Express','MongoDB'] },
    { name: 'Student-Teacher Appointment Booking System', description: 'MERN scheduling with secure auth', url: 'https://github.com/Ch-NikhilReddy/Student-Teacher', techStack: ['MERN'] },
    { name: 'Ecoyaan Checkout System', description: 'Next.js SSR checkout flow', url: 'https://github.com/Ch-NikhilReddy/ecoyaan-checkout', techStack: ['Next.js','React'] },
    { name: 'Adaptive Cognitive Firewall (ACF)', description: 'Mini Project — Anurag University — offline-first host security + local ML + conversational assistant', url: null, techStack: ['Python','ML','Security'] },
    { name: 'Custom OS Bootloader & Language Interpreter', description: 'Independent systems project — NASM/QEMU bootloader', url: null, techStack: ['NASM','QEMU','JavaScript'] },
  ];
  for (const p of projects) {
    const existing = await prisma.project.findFirst({ where: { profileId: profile.id, name: p.name } });
    if (!existing) {
      await prisma.project.create({ data: { profileId: profile.id, name: p.name, description: p.description, url: p.url, techStack: p.techStack } });
    }
  }
  console.log('Projects seeded:', projects.length);

  // Job sources (§3 modular connectors)
  const sources = [
    { name: 'LinkedIn Jobs', adapterName: 'LinkedInConnector', capabilities: { search: false, fetchDetails: false, supportsApply: false } },
    { name: 'Internshala', adapterName: 'InternshalaConnector', capabilities: { search: false, fetchDetails: false, supportsApply: false } },
    { name: 'Greenhouse', adapterName: 'GreenhouseConnector', capabilities: { search: true, fetchDetails: true, supportsApply: false } },
    { name: 'Official company page', adapterName: 'GenericCareerSiteConnector', capabilities: { search: false, fetchDetails: false, supportsApply: false } },
    { name: 'Manual import', adapterName: 'ManualConnector', capabilities: { search: true, fetchDetails: true, supportsApply: false } },
  ];
  for (const s of sources) {
    await prisma.jobSource.upsert({ where: { name: s.name }, update: { adapterName: s.adapterName, capabilities: s.capabilities }, create: s });
  }
  console.log('JobSources seeded:', sources.length);

  // Master resume placeholder
  await prisma.resume.upsert({
    where: { id: 'resume-master-nikhil' },
    update: {},
    create: { id: 'resume-master-nikhil', profileId: profile.id, title: 'Nikhil_Resume_Final_Job_Internship.docx', isMaster: true, version: 1, fileType: 'docx' },
  });
  console.log('Resume seeded');

  console.log('✅ Seed complete — DB is now persistent (not in-memory)');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
