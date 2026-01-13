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
          // Robust check for joined data
          const adminId = post.adroom_strategies?.admin_id;
          
          if (!adminId) {
             // Fallback: Try to fetch strategy directly if join failed
             const { data: strat } = await supabaseAdmin.from('adroom_strategies').select('admin_id').eq('id', post.strategy_id).single();
             if (!strat) {
                 logActivity(`Skipping post ${post.id}: Strategy not found.`, 'error');
                 await supabaseAdmin.from('adroom_posts').update({ status: 'failed' }).eq('id', post.id);
                 continue;
             }
             // Use the fetched adminId
             // But we need to assign it to a variable, let's refactor slightly below
          }
          
          const finalAdminId = adminId || (await supabaseAdmin.from('adroom_strategies').select('admin_id').eq('id', post.strategy_id).single()).data?.admin_id;

          const { data: settings } = await supabaseAdmin
            .from('adroom_settings')
            .select('*')
            .eq('admin_id', finalAdminId)
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
          const { error: updateError } = await supabaseAdmin
            .from('adroom_posts')
            .update({
              posted_time: new Date().toISOString(),
              status: 'posted',
              facebook_post_id: platformPostId,
              metrics: { reach: 0, engagement: 0 } // Initialize metrics
            })
            .eq('id', post.id);

          if (updateError) {
             console.error('Failed to update DB status to posted:', updateError);
          } else {
             logActivity(`Successfully published post ${post.id}. FB ID: ${platformPostId}`, 'success');
          }
        } catch (postError: any) {
          logActivity(`Failed to publish post ${post.id}: ${postError.message}`, 'error');
          await supabaseAdmin.from('adroom_posts').update({ status: 'failed' }).eq('id', post.id);
        }
      }
    }

    // 4. Check for New Messages/Comments and Auto-Reply (Autonomous Bot)
    // Handled by botService.ts (Webhook + Polling) to avoid race conditions.
    // We do not duplicate the check here.
  } catch (err: any) {
    console.error('Critical error in automation cron:', err);
    logActivity(`Automation system error: ${err.message}`, 'error');
  }
});

// Run Performance Monitor daily at Midnight (00:00)
cron.schedule('0 0 * * *', async () => {
    logActivity('Running Daily Strategy Performance Monitor...', 'info');
    await adRoomService.monitorAndAdjust();
    
    // Continuous Strategy Evaluation:
    // Check if we need to queue more content for tomorrow
    const { data: strategies } = await supabaseAdmin.from('adroom_strategies').select('*').eq('status', 'active');
    
    if (strategies) {
        for (const strategy of strategies) {
             const { count } = await supabaseAdmin
                 .from('adroom_posts')
                 .select('*', { count: 'exact', head: true })
                 .eq('strategy_id', strategy.id)
                 .eq('status', 'pending');
             
             if (count !== null && count < 5) {
                 logActivity(`Strategy ${strategy.id} is running low on content (${count} pending). Triggering regeneration...`, 'info');
                 // Trigger generation logic here or flag for admin
                 await adRoomService.generateMoreContent(strategy.id); 
             }
        }
    }
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
