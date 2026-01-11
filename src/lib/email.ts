import { supabase } from './supabaseClient';

interface EmailData {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends an email using Supabase Edge Functions.
 * Note: You need to deploy the 'send-email' function to Supabase first.
 */
export const sendEmail = async (data: EmailData) => {
  try {
    const { data: responseData, error } = await supabase.functions.invoke('send-email', {
      body: data,
    });

    if (error) {
      console.error('Edge Function email delivery failed:', error);
      
      // In development, if the function fails (e.g., not deployed), we simulate success
      if (import.meta.env.DEV) {
        console.warn('DEV MODE: Simulating successful email delivery despite error.');
        return { success: true, message: 'Dev mode simulation' };
      }
      
      throw error;
    }
    return responseData;
  } catch (error) {
    console.error('Error invoking email function:', error);
    
    // In development, fallback to success so the UI flow completes
    if (import.meta.env.DEV) {
      console.warn('DEV MODE: Simulating successful email delivery despite invocation error.');
      return { success: true, message: 'Dev mode simulation' };
    }
    
    throw error;
  }
};

export const sendAdminNotification = async (inquiry: any) => {
  const adminEmail = 'admin@villanovarealty.com'; // Replace with actual admin email
  
  await sendEmail({
    to: adminEmail,
    subject: `New Inquiry: ${inquiry.subject}`,
    html: `
      <h2>New Inquiry Received</h2>
      <p><strong>Name:</strong> ${inquiry.name}</p>
      <p><strong>Email:</strong> ${inquiry.email}</p>
      <p><strong>Phone:</strong> ${inquiry.phone || 'N/A'}</p>
      <p><strong>Subject:</strong> ${inquiry.subject}</p>
      <p><strong>Message:</strong></p>
      <blockquote style="background: #f9f9f9; padding: 10px; border-left: 4px solid #ccc;">
        ${inquiry.message}
      </blockquote>
      <p><strong>User Agent:</strong> ${inquiry.user_agent}</p>
      <a href="${window.location.origin}/admin/dashboard">View in Dashboard</a>
    `,
  });
};

export const sendUserConfirmation = async (inquiry: any) => {
  const referenceId = inquiry.id || inquiry.property_id?.slice(0, 8).toUpperCase() || 'REF-PENDING';
  
  await sendEmail({
    to: inquiry.email,
    subject: `Received: ${inquiry.subject} [Ref: ${referenceId}]`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #333;">Inquiry Received</h2>
        <p>Hello <strong>${inquiry.name}</strong>,</p>
        <p>Thank you for contacting Villanova Realty. We have successfully received your inquiry regarding <strong>"${inquiry.property_title || 'Property Inquiry'}"</strong>.</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Reference Number:</strong> ${referenceId}</p>
          <p style="margin: 0;"><strong>Expected Response Time:</strong> Within 24 hours</p>
        </div>

        <p>Our dedicated support agents are reviewing your details and will get back to you shortly.</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        
        <p style="color: #666; font-size: 12px;">
          Best regards,<br />
          <strong>The Villanova Realty Team</strong><br />
          <a href="${window.location.origin}" style="color: #EAB308; text-decoration: none;">www.villanovarealty.com</a>
        </p>
      </div>
    `,
  });
};

export const sendAgentInquiry = async (agentEmail: string, inquiry: any) => {
  if (!agentEmail) return;
  
  await sendEmail({
    to: agentEmail,
    subject: `New Property Inquiry: ${inquiry.property_title}`,
    html: `
      <h2>New Property Inquiry</h2>
      <p>You have received a new inquiry for <strong>${inquiry.property_title}</strong>.</p>
      
      <h3>Sender Details:</h3>
      <p><strong>Name:</strong> ${inquiry.name}</p>
      <p><strong>Email:</strong> <a href="mailto:${inquiry.email}">${inquiry.email}</a></p>
      
      <h3>Message:</h3>
      <blockquote style="background: #f9f9f9; padding: 10px; border-left: 4px solid #ccc;">
        ${inquiry.message}
      </blockquote>
      
      <p><strong>Property ID:</strong> ${inquiry.property_id}</p>
      <hr />
      <p><small>This email was sent from the Villanova Realty website.</small></p>
    `,
  });
};
