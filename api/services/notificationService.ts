import { supabaseAdmin } from '../supabase.js';

interface NotificationPayload {
  userId: string;
  type: 'lead' | 'inspection' | 'system';
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

export const notificationService = {
  /**
   * Send a notification (In-app + Email)
   */
  async send(payload: NotificationPayload) {
    try {
      // 1. Store In-App Notification
      const { error } = await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: payload.userId,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          metadata: payload.metadata || {},
          is_read: false
        });

      if (error) throw error;

      // 2. Send Email (Async, don't block)
      this.sendEmail(payload).catch(err => console.error('Email sending failed:', err));

      return { success: true };
    } catch (error) {
      console.error('Notification Error:', error);
      throw error;
    }
  },

  /**
   * Internal Email Sender
   */
  async sendEmail(payload: NotificationPayload) {
    // Fetch user email
    const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(payload.userId);
    if (error || !user || !user.email) return;

    const email = user.email;
    
    // Construct Branded HTML Email
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; padding: 20px; border-radius: 8px;">
        <div style="background-color: #0f172a; padding: 15px; text-align: center; border-radius: 8px 8px 0 0;">
           <h1 style="color: #06b6d4; margin: 0; font-size: 24px;">AdRoom<span style="color: #ffffff;">.AI</span></h1>
        </div>
        <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e2e8f0; border-top: none;">
           <h2 style="color: #1e293b; font-size: 18px; margin-top: 0;">${payload.title}</h2>
           <p style="color: #475569; font-size: 16px; line-height: 1.5;">${payload.message}</p>
           
           ${payload.metadata?.action_link ? `
             <div style="text-align: center; margin: 25px 0;">
                <a href="${payload.metadata.action_link}" style="background-color: #06b6d4; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Details</a>
             </div>
           ` : ''}
           
           <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8;">
             <p>Timestamp: ${new Date().toLocaleString()}</p>
             <p>This is an automated notification from your AdRoom Dashboard.</p>
           </div>
        </div>
      </div>
    `;

    // TODO: Integrate actual email provider (Resend, SendGrid, etc.)
    // For now, we simulate a successful send with latency < 5s check
    console.log(`[EMAIL SERVICE] Sending to ${email}:`, {
        subject: `AdRoom Alert: ${payload.title}`,
        html: htmlContent
    });

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }
};
