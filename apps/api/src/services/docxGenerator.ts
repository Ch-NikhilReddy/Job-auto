import docxDefault from 'docx';
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = (docxDefault as any).default ?? (docxDefault as any);
import { uploadToStorage } from './storage.js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { nikhilProfile } from '../data/profile.js';
import type { TailoredResume } from './resumeAgent.js';
import type { CoverLetter } from './coverLetterAgent.js';

const GENERATED_DIR = path.join(process.cwd(), 'generated');
if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR, { recursive: true });

export async function generateTailoredResumeDocx(job: { title: string; company: string }, tailored: TailoredResume): Promise<{ fileKey: string; filePath: string; fileName: string }> {
  const fileName = `Resume_${job.company.replace(/\s+/g,'_')}_${job.title.replace(/\s+/g,'_')}_${Date.now()}.docx`;
  const filePath = path.join(GENERATED_DIR, fileName);
  const fileKey = `generated/${fileName}`;

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 600, bottom: 600, left: 700, right: 700 } } },
      children: [
        new Paragraph({ alignment: 'center' as any, children: [new TextRun({ text: nikhilProfile.fullName.toUpperCase(), bold: true, size: 28, color: '1F3864' })], spacing: { after: 80 } }),
        new Paragraph({ alignment: 'center' as any, children: [new TextRun({ text: 'Full-Stack Developer  •  B.Tech IT Final Year (2027)', italics: true, size: 16, color: '595659' })], spacing: { after: 40 } }),
        new Paragraph({ alignment: 'center' as any, children: [new TextRun({ text: `+91 7995214340  |  nikhilreddynikhil988@gmail.com  |  linkedin.com/in/ch-nikhil-reddy  |  github.com/Ch-NikhilReddy`, size: 14, color: '333333' })], spacing: { after: 200 }, border: { bottom: { color: '1F3864', space: 1, style: 'single' as any, size: 6 } } }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: `TAILORED FOR: ${job.company} — ${job.title}`, bold: true, size: 18, color: '1F3864' })], spacing: { before: 120, after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: tailored.summary, size: 18 })], spacing: { after: 120 } }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'HIGHLIGHTED SKILLS (ATS)', bold: true, size: 18, color: '1F3864' })] }),
        new Paragraph({ children: [new TextRun({ text: tailored.atsKeywords.join('  •  ') || tailored.highlightedSkills.join('  •  '), size: 17 })], spacing: { after: 120 } }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'PROJECTS — REORDERED FOR THIS ROLE', bold: true, size: 18, color: '1F3864' })] }),
        ...tailored.reorderedProjects.slice(0, 5).flatMap(p => [
          new Paragraph({ children: [new TextRun({ text: p.name, bold: true, size: 18 }), new TextRun({ text: `  |  ${p.techStack.slice(0,4).join(', ')}`, size: 15, color: '5A5A5A' })], spacing: { before: 80, after: 20 } }),
          new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: p.reason, size: 17 })], spacing: { after: 40 } }),
        ]),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'CONTACT', bold: true, size: 18, color: '1F3864' })] }),
        new Paragraph({ children: [new TextRun({ text: `${nikhilProfile.portfolio}  |  ${nikhilProfile.github}  |  ${nikhilProfile.linkedin}`, size: 15 })] }),
        new Paragraph({ children: [new TextRun({ text: `Generated: ${new Date(tailored.generatedAt).toLocaleString()}  •  Source: ${tailored.source} — truthful (no invented skills per §23)`, size: 14, color: '707070', italics: true })], spacing: { before: 200 } }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const uploaded = await uploadToStorage(fileKey, buffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  if (!uploaded.s3) fs.writeFileSync(filePath, buffer); // fallback kept locally if S3 failed
  return { fileKey, filePath, fileName, s3: uploaded.s3 } as any;
}

export async function generateCoverLetterPdf(job: { title: string; company: string }, cover: CoverLetter): Promise<{ fileKey: string; filePath: string; fileName: string }> {
  const fileName = `Cover_${job.company.replace(/\s+/g,'_')}_${job.title.replace(/\s+/g,'_')}_${Date.now()}.pdf`;
  const filePath = path.join(GENERATED_DIR, fileName);
  const fileKey = `generated/${fileName}`;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();
  let y = height - 50;

  const sanitize = (s: string) => s.replace(/[•]/g, '-').replace(/[—–]/g, '-').replace(/[^\x20-\x7E\n]/g, '');
  const draw = (text: string, size = 9, color = rgb(0.2,0.2,0.2), isBold = false, maxWidth = 515) => {
    const clean = sanitize(text).replace(/\n/g, ' ');
    const f = isBold ? bold : font;
    const lines = wrapText(clean, maxWidth, f, size);
    for (const line of lines) {
      if (y < 50) { y = height - 50; }
      page.drawText(line, { x: 40, y, size, font: f, color });
      y -= size + 4;
    }
    y -= 4;
  };

  function wrapText(text: string, maxW: number, f: any, size: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      const width = f.widthOfTextAtSize(test, size);
      if (width > maxW) { if (line) lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  // Header
  draw(nikhilProfile.fullName.toUpperCase(), 14, rgb(0.12,0.22,0.39), true);
  draw('+91 7995214340  |  nikhilreddynikhil988@gmail.com  |  github.com/Ch-NikhilReddy', 7, rgb(0.35,0.35,0.35));
  y -= 6;
  // Line
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: rgb(0.12,0.22,0.39) });
  y -= 12;
  draw(new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }), 8, rgb(0.35,0.35,0.35));
  y -= 4;
  draw('Hiring Manager', 9, rgb(0,0,0), true);
  draw(job.company, 9);
  y -= 4;
  draw(cover.subject, 9, rgb(0.12,0.22,0.39), true);
  y -= 4;
  // Body paragraphs
  for (const para of cover.body.split('\n\n')) {
    if (para.trim()) draw(para.trim(), 9);
  }

  const bytes = await pdf.save();
  const uploaded = await uploadToStorage(fileKey, Buffer.from(bytes), 'application/pdf');
  if (!uploaded.s3) fs.writeFileSync(filePath, Buffer.from(bytes));
  return { fileKey, filePath, fileName, s3: uploaded.s3 } as any;
}
