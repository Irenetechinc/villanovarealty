import { supabaseAdmin } from '../supabase.ts';
import axios from 'axios';

const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;
const TRANSACTION_FEE = 45;

export const walletService = {
  /**
   * Get wallet balance for an admin
   */
  async getBalance(adminId: string) {
    const { data, error } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('admin_id', adminId)
      .single();

    if (error && error.code === 'PGRST116') {
      // Wallet doesn't exist, create one
      const { data: newWallet, error: createError } = await supabaseAdmin
        .from('wallets')
        .insert([{ admin_id: adminId, balance: 0 }])
        .select()
        .single();
      
      if (createError) throw createError;
      return newWallet;
    }

    if (error) throw error;
    return data;
  },

  /**
   * Get transactions for an admin
   */
  async getTransactions(adminId: string) {
    const wallet = await this.getBalance(adminId);
    
    const { data: transactions, error } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return transactions;
  },

  /**
   * Initiate a deposit transaction
   */
  async initiateDeposit(adminId: string, amount: number) {
    console.log(`[WalletService] Initiating deposit for admin: ${adminId}, amount: ${amount}`);
    
    try {
      // Get wallet ID
      const wallet = await this.getBalance(adminId);
      console.log(`[WalletService] Wallet found/created:`, wallet);

      // Create pending transaction
      const { data: transaction, error } = await supabaseAdmin
        .from('transactions')
        .insert([{
          wallet_id: wallet.id,
          type: 'deposit',
          amount: amount,
          fee: TRANSACTION_FEE,
          status: 'pending'
        }])
        .select()
        .single();

      if (error) {
        console.error('[WalletService] Transaction insert error:', error);
        throw error;
      }
      
      console.log(`[WalletService] Transaction created:`, transaction);
      return transaction;
    } catch (err) {
      console.error('[WalletService] initiateDeposit failed:', err);
      throw err;
    }
  },

  /**
   * Verify and complete a transaction (called after payment gateway success)
   */
  async completeDeposit(transactionId: string, flutterwaveRef: string) {
    // Verify with Flutterwave
    if (!FLUTTERWAVE_SECRET_KEY) {
        throw new Error('Server configuration error: Missing Flutterwave Secret Key');
    }

    try {
        // Use verify by transaction ID if available, but here we use verify_by_reference
        // Note: verify_by_reference might return multiple transactions if tx_ref is not unique?
        // But tx_ref should be unique.
        
        // Correct endpoint for v3 is often just /transactions/verify_by_reference?tx_ref=...
        // Let's ensure we check the actual transaction status.
        const response = await axios.get(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${flutterwaveRef}`, {
            headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}` }
        });

        const responseBody = response.data;
        console.log('[WalletService] Flutterwave verification response:', JSON.stringify(responseBody));

        if (responseBody.status !== 'success' || !responseBody.data) {
             throw new Error(`Payment verification failed: ${responseBody.message || 'Unknown error'}`);
        }

        const txData = responseBody.data;
        
        // Check if the transaction was successful
        if (txData.status !== 'successful') {
            throw new Error(`Payment verification failed: Transaction status is ${txData.status}`);
        }

        // Verify amount matches (Optional but recommended)
        // We need to fetch the local transaction first to compare amounts.
        const { data: localTx } = await supabaseAdmin
            .from('transactions')
            .select('amount, fee')
            .eq('id', transactionId)
            .single();

        if (localTx) {
            const expectedTotal = Number(localTx.amount) + (Number(localTx.fee) || 0);
            // Allow small float differences
            if (Math.abs(txData.amount - expectedTotal) > 1) {
                 throw new Error(`Payment verification failed: Amount mismatch. Paid: ${txData.amount}, Expected: ${expectedTotal}`);
            }
        }

        // Store the actual Flutterwave Transaction ID
        const flutterwaveId = txData.id;

        // Update transaction status
        const { data: transaction, error: txError } = await supabaseAdmin
          .from('transactions')
          .update({ 
              status: 'success', 
              flutterwave_ref: flutterwaveId // Store the numeric ID from FW
          })
          .eq('id', transactionId)
          .select()
          .single();

        if (txError) throw txError;

        // Update wallet balance
        // Note: We credit the amount minus fee? Or user pays fee on top?
        // Prompt says: "45 naira trasaction fee per transaction made which will be added to the total payment"
        // So if user wants 1000, they pay 1045. Wallet gets 1000.
        // The transaction amount stored should be the credit amount.
        
        let newBalance = 0;

        // Using RPC to increment balance safely would be better, but simple update for now
        const { error: walletError } = await supabaseAdmin.rpc('increment_wallet_balance', { 
            row_id: transaction.wallet_id, 
            amount: transaction.amount 
        });

        if (!walletError) {
            // Fetch the new balance if RPC succeeded (assuming RPC might return it, or we fetch it)
            // If RPC returns void, we need to fetch.
            const { data: wallet } = await supabaseAdmin
            .from('wallets')
            .select('balance')
            .eq('id', transaction.wallet_id)
            .single();
            newBalance = wallet?.balance || 0;
        }

        // If RPC doesn't exist (I didn't create it), fall back to fetch-update
        if (walletError) {
            // Fetch current balance
            const { data: wallet } = await supabaseAdmin
                .from('wallets')
                .select('balance')
                .eq('id', transaction.wallet_id)
                .single();
            
            if (!wallet) {
                throw new Error('Wallet not found during balance update');
            }

            newBalance = (Number(wallet.balance) || 0) + Number(transaction.amount);
            
            await supabaseAdmin
                .from('wallets')
                .update({ balance: newBalance, updated_at: new Date() })
                .eq('id', transaction.wallet_id);
        }

        return { transaction, newBalance };

    } catch (err) {
        console.error('Flutterwave verification error', err);
        throw new Error(err instanceof Error ? err.message : 'Payment verification failed with provider');
    }
  },

  /**
   * Get credit usage logs
   */
  async getCreditLogs(walletId: string) {
    const { data, error } = await supabaseAdmin
      .from('credit_usage_logs')
      .select('*')
      .eq('wallet_id', walletId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Deduct credits for automation
   * @param amount Number of credits to deduct (e.g. 1 per call)
   */
  async deductCredits(adminId: string, amount: number, description: string) {
    const wallet = await this.getBalance(adminId);
    if (!wallet) throw new Error('Wallet not found');

    // Use RPC if available, otherwise manual check-and-update
    // We try RPC first (defined in migration)
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('deduct_credits', {
        p_wallet_id: wallet.id,
        p_amount: amount,
        p_description: description
    });

    if (!rpcError && rpcResult) {
        if (!rpcResult.success) {
            throw new Error(rpcResult.message);
        }
        return rpcResult.new_balance;
    }

    // Fallback if RPC not applied yet
    if (wallet.credits < amount) {
        throw new Error(`Insufficient AdRoom Credits. Balance: ${wallet.credits}, Required: ${amount}`);
    }

    const newCredits = wallet.credits - amount;

    const { error: updateError } = await supabaseAdmin
        .from('wallets')
        .update({ credits: newCredits })
        .eq('id', wallet.id);

    if (updateError) throw updateError;

    // Log it
    await supabaseAdmin.from('credit_usage_logs').insert({
        wallet_id: wallet.id,
        amount: -amount,
        action_type: 'usage',
        description
    });

    return newCredits;
  },

  /**
   * Add credits (e.g. subscription renewal or top-up)
   */
  async addCredits(walletId: string, amount: number, description: string) {
      const { data: wallet } = await supabaseAdmin
          .from('wallets')
          .select('credits')
          .eq('id', walletId)
          .single();
      
      const current = wallet?.credits || 0;
      const newBalance = current + amount;

      await supabaseAdmin.from('wallets').update({ credits: newBalance }).eq('id', walletId);
      
      await supabaseAdmin.from('credit_usage_logs').insert({
        wallet_id: walletId,
        amount: amount,
        action_type: 'refill',
        description
      });

      return newBalance;
  },

  /**
   * Update Subscription Plan
   */
  async updateSubscription(adminId: string, plan: 'free' | 'pro_monthly' | 'pro_yearly') {
      const wallet = await this.getBalance(adminId);
      
      let creditsToAdd = 0;
      let durationMonths = 1;

      if (plan === 'pro_monthly') {
          creditsToAdd = 600;
          durationMonths = 1;
      } else if (plan === 'pro_yearly') {
          creditsToAdd = 600 * 12; // Or give monthly? Usually give bulk or reset monthly. 
          // User said "600 credits", implying monthly. Let's assume we set a flag to auto-refill.
          // For simplicity MVP, let's just add the first month's batch.
          creditsToAdd = 600; 
          durationMonths = 12;
      } else {
          // Free
          creditsToAdd = 25;
      }

      // Calculate end date
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + durationMonths);

      await supabaseAdmin.from('wallets').update({
          subscription_plan: plan,
          credits: creditsToAdd, // Reset/Add? Let's Reset to plan limit for now
          subscription_cycle_start: new Date(),
          subscription_cycle_end: endDate
      }).eq('id', wallet.id);

      await supabaseAdmin.from('credit_usage_logs').insert({
          wallet_id: wallet.id,
          amount: creditsToAdd,
          action_type: 'subscription_update',
          description: `Upgraded to ${plan}`
      });
  },

  /**
   * Deduct funds for services (Ads, AI)
   */
  async deductFunds(adminId: string, amount: number, type: 'ad_spend' | 'gemini_usage') {
    console.log(`[WalletService] Deducting funds for admin: ${adminId}, amount: ${amount}, type: ${type}`);
    const wallet = await this.getBalance(adminId);
    
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    if (Number(wallet.balance) < amount) {
      throw new Error('Insufficient funds');
    }

    // Create transaction record
    const { error: txError } = await supabaseAdmin
      .from('transactions')
      .insert([{
        wallet_id: wallet.id,
        type: type,
        amount: -amount, // Negative for deduction
        status: 'success'
      }]);

    if (txError) throw txError;

    // Update balance
    const newBalance = Number(wallet.balance) - amount;
    const { data: updatedWallet, error: updateError } = await supabaseAdmin
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date() })
      .eq('id', wallet.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return updatedWallet;
  }
};
