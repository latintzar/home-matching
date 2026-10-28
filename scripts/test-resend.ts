/**
 * Test Resend Email Setup
 * Run: npx tsx scripts/test-resend.ts
 */

import { Resend } from 'resend';
import * as dotenv from 'dotenv';

// Load environment variables
// Recipient configuration is supplied by tools/runtime-env.py.
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendTestEmail() {
  console.log('📧 Sending test email via Resend...');
  console.log('API Key loaded:', process.env.RESEND_API_KEY ? '✅ Yes' : '❌ No');

  try {
    const { data, error } = await resend.emails.send({
      from: 'Leo <operator@example.invalid>',
      to: ['operator@example.invalid'],
      subject: '🦁 Skibidee doo bop!',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px;">
          <h1 style="color: #f59e0b; font-size: 48px;">SKIBIDEE! 🎉</h1>
          <p style="font-size: 24px;">Bop bop skibidi dop dop yes yes 🕺</p>
          <p style="font-size: 18px; color: #6b7280;">
            This email confirms that leo.casa is fully operational and ready to send some absolute bangers.
          </p>
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; margin: 20px 0;">
            <p style="color: white; font-size: 20px; margin: 0;">🦁 Leo says: "Skibidee is the way"</p>
          </div>
          <p style="color: #9ca3af; font-size: 12px;">
            Sent at: ${new Date().toISOString()}
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('❌ Error sending email:', error);
      return;
    }

    console.log('✅ Email sent successfully!');
    console.log('📬 Email ID:', data?.id);
  } catch (err) {
    console.error('❌ Exception:', err);
  }
}

sendTestEmail();

