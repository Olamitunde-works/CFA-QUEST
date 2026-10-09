// Runs every hour. Sends each subscriber their day's plan at their chosen local hour.
import { getStore } from '@netlify/blobs';
import { localParts, reminderEmail, sendEmail } from '../lib/email.mjs';

export default async () => {
  const store = getStore('reminders');
  const site = process.env.URL || '';
  const { blobs } = await store.list();
  let sent = 0;
  for (const { key } of blobs) {
    try {
      const sub = await store.get(key, { type: 'json' });
      if (!sub) continue;
      const { date, hour } = localParts(sub.tz);
      if (sub.exam && date > sub.exam) { await store.delete(key); continue; } // exam is over
      if (hour !== sub.hour || sub.lastSent === date) continue;
      const day = sub.schedule?.[date];
      sub.lastSent = date;
      if (day && day.p !== 'rest') {
        const unsubUrl = `${site}/api/reminders?unsub=${key}`;
        const { subject, html } = reminderEmail({ name: sub.name, day, date, exam: sub.exam, site, unsubUrl });
        await sendEmail({ to: sub.email, subject, html, unsubUrl });
        sent++;
      }
      await store.setJSON(key, sub);
    } catch (e) {
      console.error('reminder failed for', key, e.message);
    }
  }
  console.log(`reminders sent: ${sent}`);
};

export const config = { schedule: '@hourly' };
