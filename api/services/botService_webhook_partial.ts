
  /**
   * Handle Incoming Webhook Events (Real-time Trigger)
   */
  async handleWebhookEvent(body: any) {
    try {
      if (body.object === 'page') {
        for (const entry of body.entry) {
          const pageId = entry.id;
          const messagingEvents = entry.messaging;
          const feedEvents = entry.changes;

          // 1. Handle Messages
          if (messagingEvents) {
            for (const event of messagingEvents) {
              if (event.message && !event.message.is_echo) {
                await this.processIncomingMessage(pageId, event.sender.id, event.message.text);
              }
            }
          }

          // 2. Handle Feed/Comments
          if (feedEvents) {
            for (const change of feedEvents) {
              if (change.field === 'feed' && change.value.item === 'comment' && change.value.verb === 'add') {
                await this.processIncomingComment(pageId, change.value);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[Bot] Webhook Handler Error:', error);
    }
  },

  async processIncomingMessage(pageId: string, senderId: string, text: string) {
    // Lookup admin settings for this page
    const { data: settings } = await supabaseAdmin.from('adroom_settings').select('*').eq('facebook_page_id', pageId).single();
    if (!settings) return;

    if (this.processedIds.has(text + senderId)) return; // Simple dedup based on content+sender
    this.processedIds.add(text + senderId);

    // Call Gemini ONLY here (Event Driven)
    const aiReply = await geminiService.generateContent(`
        User Message: "${text}"
        Context: Real Estate Inquiry.
        Reply politely and briefly.
    `);
    
    await facebookService.sendMessage(senderId, aiReply.response.text().trim(), settings.facebook_access_token);
    await this.recordInteraction(settings.admin_id, Date.now().toString(), 'message', aiReply.response.text().trim());
  },

  async processIncomingComment(pageId: string, commentData: any) {
    const { data: settings } = await supabaseAdmin.from('adroom_settings').select('*').eq('facebook_page_id', pageId).single();
    if (!settings) return;

    const commentId = commentData.comment_id;
    const message = commentData.message;
    const senderId = commentData.from.id;

    if (senderId === pageId) return; // Ignore self
    if (this.processedIds.has(commentId)) return;

    // Call Gemini ONLY here (Event Driven)
    const aiReply = await geminiService.generateContent(`
        User Comment: "${message}"
        Context: Real Estate Post.
        Reply engagingly.
    `);

    await facebookService.replyToComment(commentId, aiReply.response.text().trim(), settings.facebook_access_token);
    await this.recordInteraction(settings.admin_id, commentId, 'comment', aiReply.response.text().trim());
  },
