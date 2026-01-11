import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, subject, html }: EmailRequest = await req.json();

    if (!RESEND_API_KEY) {
      console.log("⚠️ RESEND_API_KEY is missing. Mocking email delivery.");
      console.log(`[MOCK EMAIL] To: ${to}, Subject: ${subject}`);
      
      return new Response(JSON.stringify({ 
        id: "mock_email_" + crypto.randomUUID(),
        message: "Email delivery simulated (missing API key)" 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Villanova Realty <onboarding@resend.dev>", // Use testing domain by default
        to,
        subject,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.message || 'Failed to send email via Resend');
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
