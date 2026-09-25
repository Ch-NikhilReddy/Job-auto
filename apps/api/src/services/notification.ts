import { getPrisma } from '../config/db.js';

export type NotifyPayload = {
  userId?: string;
  type: string; // high_match, approval_required, status_change, failure, discovery_complete
  channel?: 'dashboard' | 'email' | 'telegram';
  title: string;
  message: string;
  payload?: any;
};

function getUserId(): string { return 'user-demo-nikhil'; }

export async function notify(payload: NotifyPayload) {
  const prisma = getPrisma();
  const userId = payload.userId ?? getUserId();
  const channel = payload.channel ?? 'dashboard';

  // Persist to DB for dashboard (always)
  if (prisma && process.env.DATABASE_URL) {
    try {
      await prisma.notification.create({
        data: {
          userId,
          type: payload.type,
          channel,
          title: payload.title,
          message: payload.message,
          payload: payload.payload ?? {},
        },
      });
    } catch (e: any) {
      console.warn('[Notify] DB fail:', e.message);
    }
  }

  // Email via console (Phase 9 MVP) — replace with Resend/SMTP when EMAIL_API_KEY set
  if (channel === 'email' || process.env.EMAIL_API_KEY) {
    const email = process.env.NOTIFY_EMAIL ?? 'nikhilreddynikhil988@gmail.com';
    console.log(`[Notify][Email] to ${email} — ${payload.title}: ${payload.message}`);
    // TODO: integrate Resend/SendGrid when EMAIL_API_KEY present
  }

  // Browser push would be handled by web polling GET /notifications — no extra server work
  console.log(`[Notify][${channel}] ${payload.type}: ${payload.title}`);
}

// Helpers per §16 triggers
export const notifyHighMatch = (job: { title: string; company: string; score: number }) =>
  notify({ type: 'high_match', title: `High match: ${job.title} at ${job.company} (${job.score}%)`, message: `New high-value opportunity requires review`, payload: job });

export const notifyApprovalRequired = (appId: string, jobTitle: string) =>
  notify({ type: 'approval_required', title: `Approval required: ${jobTitle}`, message: `Application ${appId} needs your APPROVE before submit`, payload: { appId } });

export const notifyStatusChange = (appId: string, status: string) =>
  notify({ type: 'status_change', title: `Status → ${status}`, message: `Application ${appId} moved to ${status}`, payload: { appId, status } });
