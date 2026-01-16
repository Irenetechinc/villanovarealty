import { Router } from 'express';
import { walletService } from '../services/wallet.ts';

const router = Router();

// Get Wallet Balance
router.get('/:adminId', async (req, res) => {
  try {
    const { adminId } = req.params;
    const wallet = await walletService.getBalance(adminId);
    res.json(wallet);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get Wallet Transactions
router.get('/:adminId/transactions', async (req, res) => {
  try {
    const { adminId } = req.params;
    const transactions = await walletService.getTransactions(adminId);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Initiate Deposit
router.post('/deposit', async (req, res) => {
  try {
    const { admin_id, amount } = req.body;
    const transaction = await walletService.initiateDeposit(admin_id, amount);
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Verify Transaction
router.post('/verify', async (req, res) => {
  try {
    const { transaction_id, flutterwave_ref } = req.body;
    const result = await walletService.completeDeposit(transaction_id, flutterwave_ref);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update Subscription (after payment)
router.post('/subscription', async (req, res) => {
    try {
        const { admin_id, plan, transaction_id } = req.body;
        
        if (!admin_id || !plan) {
            return res.status(400).json({ error: 'Missing admin_id or plan' });
        }

        // 1. Verify Payment with Flutterwave (Recommended)
        // For now, we trust the transaction_id if provided, or verify if we have keys.
        // Ideally: walletService.verifySubscriptionPayment(transaction_id)
        
        // 2. Update Plan
        await walletService.updateSubscription(admin_id, plan);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get Credit Logs
router.get('/:adminId/credit-logs', async (req, res) => {
    try {
        const { adminId } = req.params;
        const wallet = await walletService.getBalance(adminId);
        const logs = await walletService.getCreditLogs(wallet.id);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;
