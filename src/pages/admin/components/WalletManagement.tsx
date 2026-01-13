import React, { useState, useEffect } from 'react';
import { Wallet, CreditCard, ArrowUpRight, ArrowDownLeft, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useFlutterwave, closePaymentModal } from 'flutterwave-react-v3';

const WalletManagement = () => {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    fetchWalletData();
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserEmail(user.email || '');
      setUserName(user.user_metadata?.name || 'Admin User');
    }
  };

  const fetchWalletData = async (forceRefresh = false) => {
    setIsLoading(true);
    const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    const API_PREFIX = BASE_URL ? `${BASE_URL}/api` : '/api';
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const headers: HeadersInit = {};
      if (forceRefresh) {
        headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        headers['Pragma'] = 'no-cache';
        headers['Expires'] = '0';
      }

      // Add timestamp to URL to prevent caching
      const url = `${API_PREFIX}/wallet/${user.id}${forceRefresh ? `?t=${Date.now()}` : ''}`;
      
      const balanceRes = await fetch(url, { headers });
      if (balanceRes.ok) {
        const wallet = await balanceRes.json();
        setBalance(Number(wallet.balance));
      }

      // Fetch transactions from API instead of Supabase client to bypass RLS
      const txRes = await fetch(`${API_PREFIX}/wallet/${user.id}/transactions`, { headers });
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData || []);
      }

    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <WalletManagementContent 
      balance={balance}
      setBalance={setBalance}
      transactions={transactions}
      isLoading={isLoading}
      fetchWalletData={fetchWalletData}
      userEmail={userEmail}
      userName={userName}
    />
  );
};

const WalletManagementContent = ({ balance, setBalance, transactions, isLoading, fetchWalletData, userEmail, userName }: any) => {
  const [depositAmount, setDepositAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [readyToPay, setReadyToPay] = useState(false);
  const [transactionFee, setTransactionFee] = useState(0);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const [fwConfig, setFwConfig] = useState<any>(null);

  const onPaymentSuccess = (response: any) => {
    closePaymentModal();
    if (response.status === "successful") {
      verifyPayment(response);
    } else {
      setIsDepositing(false);
      setReadyToPay(false);
      alert("Payment was not successful");
    }
  };

  const onPaymentClose = () => {
    setIsDepositing(false);
    setReadyToPay(false);
  };

  const verifyPayment = async (fwResponse: any) => {
    try {
      const response = await fetch(`${API_URL}/api/wallet/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transaction_id: transactionId, 
          // We must send the tx_ref (UUID) for verify_by_reference to work.
          // fwResponse.tx_ref contains our transaction UUID.
          flutterwave_ref: fwResponse.tx_ref 
        }),
      });
      
      if (!response.ok) {
        throw new Error('Verification failed');
      }

      const { newBalance } = await response.json();
      
      alert("Deposit successful!");
      
      // Update balance directly from response
      if (typeof newBalance === 'number') {
        setBalance(newBalance);
      }
      
      setDepositAmount('');
      // Force refresh data with cache busting
      fetchWalletData(true);
    } catch (error) {
      console.error("Verification failed", error);
      alert("Payment successful but verification failed. Please contact support.");
    } finally {
      setIsDepositing(false);
      setReadyToPay(false);
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(depositAmount);
    if (!amount || amount < 100) {
      alert('Minimum deposit is ₦100');
      return;
    }

    setIsDepositing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const response = await fetch(`${API_URL}/api/wallet/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: user?.id, amount }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Deposit initiation failed');
      }

      const transaction = await response.json();
      
      const fee = Number(transaction.fee) || 0;
      setTransactionFee(fee);
      const totalAmount = amount + fee;

      setTransactionId(transaction.id);
      
      // Refresh list to show pending transaction
      fetchWalletData(true);

      setFwConfig({
        public_key: import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY || '',
        tx_ref: transaction.id,
        amount: totalAmount,
        currency: 'NGN',
        payment_options: 'card,mobilemoney,ussd',
        customer: {
          email: userEmail || 'user@example.com',
          phone_number: '',
          name: userName || 'User',
        },
        customizations: {
          title: 'AdRoom Wallet Deposit',
          description: 'Funding AdRoom Wallet',
          logo: 'https://st2.depositphotos.com/4403291/7418/v/450/depositphotos_74189661-stock-illustration-online-shop-log.jpg',
        },
      });
      setReadyToPay(true);
      setIsDepositing(false); // Stop loading, show Pay button

    } catch (error) {
      console.error('Deposit error:', error);
      alert(error instanceof Error ? error.message : 'Failed to initiate deposit');
      setIsDepositing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg shadow-cyan-500/20 col-span-2 border border-cyan-500/30 relative overflow-hidden group">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
          
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-cyan-100 font-medium mb-1 tracking-wide text-sm uppercase">Available Balance</p>
              <h2 className="text-4xl font-bold tracking-tight">₦{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
            </div>
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20 shadow-inner">
              <Wallet className="h-8 w-8 text-white" />
            </div>
          </div>
          <div className="relative z-10 mt-8 flex space-x-4">
            <div className="text-xs bg-black/30 px-3 py-1.5 rounded-full flex items-center border border-white/10 backdrop-blur-sm">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse shadow-[0_0_8px_#4ade80]"></span>
              Wallet Active
            </div>
            <div className="text-xs text-cyan-100 flex items-center bg-black/10 px-3 py-1.5 rounded-full">
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Auto-renew: Off
            </div>
          </div>
        </div>

        {/* Quick Deposit Form */}
        <div className="bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-800 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-800/50 to-transparent rounded-2xl pointer-events-none"></div>
          <div className="relative z-10">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                <CreditCard className="h-5 w-5 mr-2 text-cyan-400" />
                Quick Deposit
            </h3>
            <form onSubmit={handleDeposit} className="space-y-4">
                <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Amount (₦)</label>
                <div className="relative group">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors">₦</span>
                    <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => {
                        setDepositAmount(e.target.value);
                        setReadyToPay(false);
                    }}
                    disabled={readyToPay || isDepositing}
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 disabled:opacity-50 text-white placeholder-slate-600 transition-all shadow-inner"
                    placeholder="0.00"
                    min="100"
                    />
                </div>
                </div>
                
                {readyToPay ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner">
                    <div className="flex justify-between text-xs text-slate-400 mb-2">
                        <span>Deposit:</span>
                        <span className="font-mono">₦{Number(depositAmount).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 mb-2">
                        <span>Fee:</span>
                        <span className="font-mono text-orange-400">₦{transactionFee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold text-white pt-2 border-t border-slate-800">
                        <span>Total:</span>
                        <span className="font-mono text-cyan-400">₦{(Number(depositAmount) + transactionFee).toLocaleString()}</span>
                    </div>
                    </div>
                    {fwConfig && (
                    <FlutterwavePaymentButton 
                        config={fwConfig} 
                        onSuccess={onPaymentSuccess} 
                        onClose={onPaymentClose}
                        text={`Pay ₦${(Number(depositAmount) + transactionFee).toLocaleString()}`}
                    />
                    )}
                </div>
                ) : (
                <button
                    type="submit"
                    disabled={isDepositing}
                    className="w-full bg-cyan-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-cyan-500 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-900/20"
                >
                    {isDepositing ? (
                        <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Processing...
                        </>
                    ) : (
                    <>
                        Add Funds
                        <ArrowUpRight className="h-4 w-4 ml-1" />
                    </>
                    )}
                </button>
                )}
                <div className="flex justify-center items-center space-x-1 text-[10px] text-slate-600">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Secured by Flutterwave</span>
                </div>
            </form>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <h3 className="text-lg font-bold text-white">Transaction History</h3>
          <button 
            onClick={fetchWalletData} 
            className="text-slate-400 hover:text-cyan-400 p-2 hover:bg-slate-800 rounded-lg transition-all"
            title="Refresh Data"
          >
            <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-950/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Ref ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900">
              {transactions.length > 0 ? (
                transactions.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-slate-800/80 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`p-2 rounded-lg mr-3 ${
                          tx.type === 'deposit' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {tx.type === 'deposit' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                        </div>
                        <span className="capitalize font-medium text-slate-300 group-hover:text-white transition-colors">
                          {tx.type === 'gemini_usage' ? 'AI Usage' : tx.type.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`font-mono font-medium ${
                        tx.type === 'deposit' ? 'text-green-400' : 'text-slate-300'
                      }`}>
                        {tx.type === 'deposit' ? '+' : '-'}₦{Math.abs(tx.amount).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 inline-flex text-[10px] uppercase font-bold tracking-wide rounded-full border ${
                        tx.status === 'success' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                        tx.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400 font-mono">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 font-mono group-hover:text-slate-500 transition-colors">
                      {tx.flutterwave_ref || '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-500">
                        <div className="h-12 w-12 bg-slate-800 rounded-full flex items-center justify-center mb-3">
                            <RefreshCw className="h-6 w-6 opacity-50" />
                        </div>
                        <p>No transactions found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Component to handle Flutterwave button and hook isolation
const FlutterwavePaymentButton = ({ config, onSuccess, onClose, text }: any) => {
  const handleFlutterwavePayment = useFlutterwave(config);

  return (
    <button
      type="button"
      onClick={() => {
        handleFlutterwavePayment({
          callback: onSuccess,
          onClose: onClose,
        });
      }}
      className="w-full bg-green-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-green-500 transition-all flex items-center justify-center shadow-lg shadow-green-900/20"
    >
      <CreditCard className="h-4 w-4 mr-2" />
      {text}
    </button>
  );
};

export default WalletManagement;