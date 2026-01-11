import React, { useState, useEffect } from 'react';
import { Wallet, CreditCard, ArrowUpRight, ArrowDownLeft, RefreshCw } from 'lucide-react';
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
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
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
      const url = `${API_URL}/api/wallet/${user.id}${forceRefresh ? `?t=${Date.now()}` : ''}`;
      
      const balanceRes = await fetch(url, { headers });
      if (balanceRes.ok) {
        const wallet = await balanceRes.json();
        setBalance(Number(wallet.balance));
      }

      // Fetch transactions from API instead of Supabase client to bypass RLS
      const txRes = await fetch(`${API_URL}/api/wallet/${user.id}/transactions`, { headers });
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
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-6 text-white shadow-lg col-span-2">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-100 font-medium mb-1">Available Balance</p>
              <h2 className="text-4xl font-bold">₦{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
            </div>
            <div className="p-3 bg-white/10 rounded-lg backdrop-blur-sm">
              <Wallet className="h-8 w-8 text-white" />
            </div>
          </div>
          <div className="mt-8 flex space-x-4">
            <div className="text-sm bg-white/20 px-3 py-1 rounded-full flex items-center">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
              Active
            </div>
            <div className="text-sm text-blue-100 flex items-center">
              <RefreshCw className="h-4 w-4 mr-1" />
              Auto-renew disabled
            </div>
          </div>
        </div>

        {/* Quick Deposit Form */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Deposit</h3>
          <form onSubmit={handleDeposit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₦)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => {
                    setDepositAmount(e.target.value);
                    setReadyToPay(false);
                  }}
                  disabled={readyToPay || isDepositing}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder="0.00"
                  min="100"
                />
              </div>
            </div>
            
            {readyToPay ? (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Deposit Amount:</span>
                    <span>₦{Number(depositAmount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Transaction Fee:</span>
                    <span>₦{transactionFee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-800 pt-2 border-t border-gray-200">
                    <span>Total to Pay:</span>
                    <span>₦{(Number(depositAmount) + transactionFee).toLocaleString()}</span>
                  </div>
                </div>
                {fwConfig && (
                  <FlutterwavePaymentButton 
                    config={fwConfig} 
                    onSuccess={onPaymentSuccess} 
                    onClose={onPaymentClose}
                    text={`Proceed to Payment (₦${(Number(depositAmount) + transactionFee).toLocaleString()})`}
                  />
                )}
              </div>
            ) : (
              <button
                type="submit"
                disabled={isDepositing}
                className="w-full bg-black text-white py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDepositing ? 'Processing...' : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Add Funds
                  </>
                )}
              </button>
            )}
            <p className="text-xs text-gray-500 text-center">Secured by Flutterwave</p>
          </form>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800">Transaction History</h3>
          <button 
            onClick={fetchWalletData} 
            className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-full"
          >
            <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.length > 0 ? (
                transactions.map((tx: any) => (
                  <tr key={tx.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`p-2 rounded-full mr-3 ${
                          tx.type === 'deposit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                        }`}>
                          {tx.type === 'deposit' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                        </div>
                        <span className="capitalize font-medium text-gray-900">
                          {tx.type === 'gemini_usage' ? 'AI Usage' : tx.type.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`font-medium ${
                        tx.type === 'deposit' ? 'text-green-600' : 'text-gray-900'
                      }`}>
                        {tx.type === 'deposit' ? '+' : '-'}₦{Math.abs(tx.amount).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        tx.status === 'success' ? 'bg-green-100 text-green-800' : 
                        tx.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400 font-mono">
                      {tx.flutterwave_ref || '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    No transactions found
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
      className="w-full bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center"
    >
      <CreditCard className="h-4 w-4 mr-2" />
      {text}
    </button>
  );
};

export default WalletManagement;
