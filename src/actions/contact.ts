'use server';

import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s()\-]{7,20}$/;

// Spam limits: per sender and across the whole form, within a short window
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_EMAIL = 3;
const MAX_TOTAL = 30;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendContactEmail(formData: FormData) {
  try {
    const name = (formData.get('name') as string | null)?.trim() ?? '';
    const email = (formData.get('email') as string | null)?.trim() ?? '';
    const phone = (formData.get('phone') as string | null)?.trim() ?? '';
    const message = (formData.get('message') as string | null)?.trim() ?? '';

    // Hidden field a real visitor never fills in. Pretend it worked so bots don't retry.
    if ((formData.get('website') as string | null)?.trim()) {
      return { success: true };
    }

    if (!name || !email || !phone || !message) {
      return { success: false, error: 'All fields are required' };
    }
    if (!EMAIL_RE.test(email)) {
      return { success: false, error: 'Please enter a valid email address' };
    }
    if (!PHONE_RE.test(phone)) {
      return { success: false, error: 'Please enter a valid phone number' };
    }
    if (name.length > 100 || email.length > 254 || message.length > 5000) {
      return { success: false, error: 'One of the fields is too long' };
    }

    // 1. Persist FIRST. The DB row is the source of truth, the admin can
    //    always recover the lead via the Submissions tab even if email fails.
    const supabase = createServiceClient();

    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const [{ count: fromEmail }, { count: total }] = await Promise.all([
      supabase.from('contact_submissions').select('id', { count: 'exact', head: true }).eq('email', email).gte('created_at', since),
      supabase.from('contact_submissions').select('id', { count: 'exact', head: true }).gte('created_at', since),
    ]);
    if ((fromEmail ?? 0) >= MAX_PER_EMAIL || (total ?? 0) >= MAX_TOTAL) {
      return { success: false, error: 'Too many messages right now. Please try again in a few minutes.' };
    }

    const { data: inserted, error: insertError } = await supabase
      .from('contact_submissions')
      .insert({ name, email, phone, message })
      .select('id')
      .single();

    if (insertError || !inserted) {
      console.error('contact_submissions insert failed:', insertError);
      return { success: false, error: 'Failed to save your message. Please try again.' };
    }

    revalidatePath('/[locale]/admin', 'page');

    // 2. Attempt email. A failure here is non-fatal, we still return success
    //    and just record the failure on the row.
    const apiKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_CONTACT_EMAIL;
    const fromAddress = process.env.RESEND_FROM ?? 'Contact Form <onboarding@resend.dev>';

    if (!apiKey || !adminEmail) {
      const missing = !apiKey ? 'RESEND_API_KEY' : 'ADMIN_CONTACT_EMAIL';
      console.error(`Email skipped: ${missing} not set`);
      await supabase
        .from('contact_submissions')
        .update({ email_sent: false, email_error: `env ${missing} not set` })
        .eq('id', inserted.id);
      return { success: true, emailWarning: true };
    }

    try {
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from: fromAddress,
        to: [adminEmail],
        subject: `New Project Proposal from ${name}`,
        replyTo: email,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #111;">
            <h2>New Project Proposal</h2>
            <p><strong>Name:</strong> ${escapeHtml(name)}</p>
            <p><strong>Email:</strong> ${escapeHtml(email)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p><strong>Project Details:</strong></p>
            <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
          </div>
        `,
      });

      if (error) {
        console.error('Resend error:', error);
        await supabase
          .from('contact_submissions')
          .update({ email_sent: false, email_error: error.message ?? 'unknown resend error' })
          .eq('id', inserted.id);
        return { success: true, emailWarning: true };
      }

      await supabase
        .from('contact_submissions')
        .update({ email_sent: true })
        .eq('id', inserted.id);
      return { success: true };
    } catch (mailErr) {
      const errMsg = mailErr instanceof Error ? mailErr.message : String(mailErr);
      console.error('Resend threw:', mailErr);
      await supabase
        .from('contact_submissions')
        .update({ email_sent: false, email_error: errMsg })
        .eq('id', inserted.id);
      return { success: true, emailWarning: true };
    }
  } catch (err) {
    console.error('Contact form submission error:', err);
    return { success: false, error: 'Failed to send message' };
  }
}
