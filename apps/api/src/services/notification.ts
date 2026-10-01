// Real notification delivery: Telegram Bot API + Resend email + dashboard (DB).
// All are optional — missing keys degrade gracefully to a console log.

import { getPrisma } from '../config/db.js';

export type NotifyPayload = {
  userId?: string;
  type: string;
  channel?: 'dashboard' | 'email' | 'telegram';
  title: string;
  message: string;
  payload?: any;
};

const DEFAULT_USER = 'user-demo-nikhil';

const quietHours = { start: 23, end: 7 };
function inQuietHours(d = new Date()): boolean {
  const h = d.getHours();
  return h >= quietHours.start || h < quietHours.end;
}

// ── Telegram ──
async function sendTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    if (!res.ok) {
      app_log('warn', `telegram failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (e: any) {
    app_log('warn', `telegram error: ${e.message}`);
    return false;
  }
}

// ── Email (Resend) ──
async function sendEmail(subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  const from = process.env.NOTIFY_FROM ?? 'CareerPilot <onboarding@resend.dev>';
  if (!key || !to) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!res.ok) {
      app_log('warn', `email failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (e: any) {
    app_log('warn', `email error: ${e.message}`);
    return false;
  }
}

function app_log(level: 'warn' | 'info', msg: string) {
  console[level === 'warn' ? 'warn' : 'log'](`[notify] ${msg}`);
}

export async function notify(p: NotifyPayload) {
  const prisma = getPrisma();
  const userId = p.userId ?? DEFAULT_USER;
  const channel = p.channel ?? 'dashboard';

  // Always persist for the dashboard feed
  if (prisma && process.env.DATABASE_URL) {
    try {
      await prisma.notification.create({
        data: { userId, type: p.type, channel, title: p.title, message: p.message, payload: p.payload ?? {} },
      });
    } catch (e: any) {
      app_log('warn', `DB persist failed: ${e.message}`);
    }
  }

  // High-signal types also push to Telegram/email
  const PUSH = new Set([
    'auto_apply_blocked', 'auto_apply_failed', 'application_submitted',
    'action_required', 'application_verified', 'high_match', 'approval_required',
  ]);
  const urgent = new Set(['auto_apply_blocked', 'auto_apply_failed', 'action_required', 'application_submitted']);

  if (PUSH.has(p.type)) {
    const icon = urgent.has(p.type) ? '🔔' : 'ℹ️';
    const text = `${icon} <b>${escapeHtml(p.title)}</b>\n${escapeHtml(p.message)}`;
    if (!(inQuietHours() && !urgent.has(p.type))) {
      await sendTelegram(text);
    }
    await sendEmail(`[CareerPilot] ${p.title}`, p.message);
  }

  app_log('info', `[${channel}] ${p.type}: ${p.title}`);
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const notifyHighMatch = (job: { title: string; company: string; score: number }) =>
  notify({ type: 'high_match', title: `High match: ${job.title} at ${job.company} (${job.score}%)`, message: 'New high-value opportunity ready for review.', payload: job });

export const notifyApprovalRequired = (appId: string, jobTitle: string) =>
  notify({ type: 'approval_required', title: `Approval required: ${jobTitle}`, message: `Application ${appId} needs your APPROVE.`, payload: { appId } });

export const notifyStatusChange = (appId: string, status: string) =>
  notify({ type: 'status_change', title: `Status → ${status}`, message: `Application ${appId} moved to ${status}.`, payload: { appId, status } });

export const notifyAutoApplyBlocked = (appId: string, company: string, reason: string, url?: string) =>
  notify({ type: 'auto_apply_blocked', title: `Human needed: ${company}`, message: `Auto-apply stopped — ${reason}. Apply manually: ${url ?? 'see dashboard'}`, payload: { appId, url } });
