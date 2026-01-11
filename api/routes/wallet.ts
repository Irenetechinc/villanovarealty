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

export default router;
