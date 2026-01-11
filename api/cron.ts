import cron from 'node-cron';
import { supabaseAdmin } from './supabase.js';
import { facebookService } from './services/facebook.js';
import { logActivity } from './logger.js';
import { adRoomService } from './services/adRoomService.js';

// Run every minute to check for due posts
cron.schedule('* * * * *', async () => {
  // console.log('Running AdRoom automation check...'); 
  // Commented out to reduce console noise, relying on logActivity for admin view
  
  try {
    const now = new Date().toISOString();

    // 1. Fetch pending posts that are due
    const { data: duePosts, error } = await supabaseAdmin
      .from('adroom_posts')
      .select('*, adroom_strategies(admin_id)')
      .eq('status', 'pending') // Not yet posted
      .lte('scheduled_time', now); // Scheduled time has passed

    if (error) {
      console.error('Error fetching due posts:', error);
      return;
    }

    if (duePosts && duePosts.length > 0) {
      logActivity(`Found ${duePosts.length} posts scheduled for now. Initiating publishing sequence...`, 'info');

      for (const post of duePosts) {
        try {
          // Fetch Facebook settings for this admin
          const { data: settings } = await supabaseAdmin
            .from('adroom_settings')
            .select('*')
            .eq('admin_id', post.adroom_strategies.admin_id)
            .single();

          if (!settings || !settings.facebook_page_id || !settings.facebook_access_token) {
            logActivity(`Skipping post ${post.id}: Facebook settings not found for admin.`, 'error');
            await supabaseAdmin.from('adroom_posts').update({ status: 'failed' }).eq('id', post.id);
            continue;
          }

          // 2. Publish to Facebook
          logActivity(`Publishing post to Facebook Page ${settings.facebook_page_id}...`, 'info');
          
          const platformPostId = await facebookService.publishPost(
            settings.facebook_page_id,
            settings.facebook_access_token,
            post.content,
            post.image_url
          );

          // 3. Update post status
          await supabaseAdmin
            .from('adroom_posts')
            .update({
              posted_time: new Date().toISOString(),
              status: 'posted',
              facebook_post_id: platformPostId,
              metrics: { reach: 0, engagement: 0 } // Initialize metrics
            })
            .eq('id', post.id);

          logActivity(`Successfully published post ${post.id}. FB ID: ${platformPostId}`, 'success');
        } catch (postError: any) {
          logActivity(`Failed to publish post ${post.id}: ${postError.message}`, 'error');
          await supabaseAdmin.from('adroom_posts').update({ status: 'failed' }).eq('id', post.id);
        }
      }
    }

    // 4. Check for New Messages/Comments and Auto-Reply (Autonomous Bot)
    // We only check for admins who have an active strategy
    const { data: activeAdmins } = await supabaseAdmin
        .from('adroom_strategies')
        .select('admin_id')
        .eq('status', 'active');
    
    if (activeAdmins && activeAdmins.length > 0) {
        // De-duplicate admins
        const adminIds = [...new Set(activeAdmins.map(a => a.admin_id))];
        
        for (const adminId of adminIds) {
             const { data: settings } = await supabaseAdmin
                .from('adroom_settings')
                .select('*')
                .eq('admin_id', adminId)
                .single();
             
             if (!settings || !settings.facebook_page_id || !settings.facebook_access_token) continue;
             
             // Check for new messages (Last 5 mins)
             // Note: In production, we should store 'last_checked' timestamp in DB to avoid double-replying.
             // For this demo, we'll check recent conversations and rely on a flag or just simplistic logic.
             // A better way is to use Webhooks. Since we can't easily set up webhooks on localhost without ngrok, 
             // we'll poll recent conversations.
             
             // NOTE: Real-world implementation requires tracking "replied_to" state.
             // Here we simply log that we are "Monitoring" to simulate the bot's presence.
             // To implement actual auto-reply safely without infinite loops, we need a 'conversations' table sync.
             
             // logActivity(`[Bot] Monitoring inbox for Page ${settings.facebook_page_id}...`, 'info');
        }
    }

  } catch (err: any) {
    console.error('Critical error in automation cron:', err);
    logActivity(`Automation system error: ${err.message}`, 'error');
  }
});

// Run Performance Monitor daily at Midnight (00:00)
cron.schedule('0 0 * * *', async () => {
    logActivity('Running Daily Strategy Performance Monitor...', 'info');
    await adRoomService.monitorAndAdjust();
});

// Run daily report generation (Midnight)
cron.schedule('0 0 * * *', async () => {
    console.log('Running Daily Report Generation...');
    // Logic to fetch all active strategies, aggregate metrics from 'adroom_posts', and save to 'adroom_reports'
    // Placeholder implementation
});

export const automation = {
  start: () => console.log('AdRoom Automation System Started')
};
