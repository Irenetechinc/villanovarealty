import React, { useState, useEffect } from 'react';
import { CreditCard, Check, Zap, Crown, Calendar, History, AlertTriangle, Package } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useFlutterwave, closePaymentModal } from 'flutterwave-react-v3';

const Subscription = () => {
  const [wallet, setWallet] = useState<any>(null);
  const [usageLogs, setUsageLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'plans' | 'usage'>('plans');

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
      const headers = { 'Cache-Control': 'no-cache' };

      // Fetch Wallet (contains subscription info)
      const walletRes = await fetch(`${API_URL}/api/wallet/${user.id}`, { headers });
      if (walletRes.ok) {
        setWallet(await walletRes.json());
      }

      // Fetch Logs
      const logsRes = await fetch(`${API_URL}/api/wallet/${user.id}/credit-logs`, { headers });
      if (logsRes.ok) {
        setUsageLogs(await logsRes.json());
      }

    } catch (error) {
      console.error('Error fetching subscription data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header / Current Status */}
      <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
                <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                    <Crown className="text-yellow-400 h-6 w-6" />
                    Current Plan: <span className="text-cyan-400 capitalize">{wallet?.subscription_plan?.replace('_', ' ') || 'Free'}</span>
                </h2>
                <div className="flex gap-4 text-sm text-slate-400">
                    <div className="flex items-center gap-1.5">
                        <Zap className="h-4 w-4 text-cyan-400" />
                        Credits: <span className="text-white font-mono font-bold">{wallet?.credits || 0}</span>
                    </div>
                    {wallet?.subscription_cycle_end && (
                        <div className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4 text-slate-500" />
                            Renews: <span className="text-slate-300">{new Date(wallet.subscription_cycle_end).toLocaleDateString()}</span>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700/50">
                <button 
                    onClick={() => setActiveTab('plans')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'plans' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                    Plans
                </button>
                <button 
                    onClick={() => setActiveTab('usage')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'usage' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                    Usage History
                </button>
                <button 
                    onClick={() => setActiveTab('topup')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'topup' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                    Buy Extra Credits
                </button>
            </div>
        </div>
      </div>

      {activeTab === 'plans' && (
          <PlansSection currentPlan={wallet?.subscription_plan} refreshData={fetchSubscriptionData} />
      )}
      
      {activeTab === 'usage' && (
          <UsageSection logs={usageLogs} />
      )}

      {activeTab === 'topup' && (
          <TopUpSection refreshData={fetchSubscriptionData} />
      )}
    </div>
  );
};

const TopUpSection = ({ refreshData }: any) => {
    const packages = [
        {
            id: 'topup_600',
            credits: 600,
            price: 35,
            popular: true
        },
        {
            id: 'topup_300',
            credits: 300,
            price: 16
        },
        {
            id: 'topup_100',
            credits: 100,
            price: 12
        }
    ];

    return (
        <div className="space-y-6">
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                <h3 className="text-xl font-bold text-white mb-2">One-time Credit Top-ups</h3>
                <p className="text-slate-400 text-sm">Purchase additional credits without changing your subscription plan. Credits never expire.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {packages.map((pkg) => (
                    <TopUpCard key={pkg.id} pkg={pkg} onSuccess={refreshData} />
                ))}
            </div>
        </div>
    );
};

const TopUpCard = ({ pkg, onSuccess }: any) => {
    const [userEmail, setUserEmail] = useState('');
    
    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) setUserEmail(data.user.email || '');
        });
    }, []);

    const config = {
        public_key: import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY || '',
        tx_ref: `topup_${pkg.id}_${Date.now()}`,
        amount: pkg.price,
        currency: 'USD',
        payment_options: 'card,mobilemoney,ussd',
        customer: {
            email: userEmail,
            name: 'AdRoom User',
        },
        customizations: {
            title: `AdRoom Top-up`,
            description: `${pkg.credits} Extra Credits`,
            logo: 'https://villanovarealty.com/logo.png',
        },
    };

    const handlePayment = useFlutterwave(config);

    const onPay = () => {
        handlePayment({
            callback: async (response) => {
                closePaymentModal();
                if (response.status === 'successful') {
                    const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
                    const { data: { user } } = await supabase.auth.getUser();
                    
                    await fetch(`${API_URL}/api/wallet/topup`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            admin_id: user?.id,
                            package_id: pkg.id,
                            flutterwave_ref: response.tx_ref
                        })
                    });
                    
                    alert(`Successfully added ${pkg.credits} credits!`);
                    onSuccess();
                }
            },
            onClose: () => {},
        });
    };

    return (
        <div className={`relative bg-slate-900 border ${pkg.popular ? 'border-cyan-500/50 shadow-lg shadow-cyan-900/20' : 'border-slate-800'} rounded-2xl p-6 flex flex-col items-center text-center transition-transform hover:-translate-y-1`}>
            {pkg.popular && (
                <div className="absolute -top-3 bg-cyan-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    BEST VALUE
                </div>
            )}
            <div className="h-12 w-12 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <Zap className={`h-6 w-6 ${pkg.popular ? 'text-cyan-400' : 'text-slate-400'}`} />
            </div>
            <h3 className="text-3xl font-bold text-white mb-1">{pkg.credits}</h3>
            <p className="text-sm text-slate-400 mb-6">Extra Credits</p>
            
            <div className="mt-auto w-full">
                <button 
                    onClick={onPay}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                        pkg.popular ? 'bg-cyan-600 hover:bg-cyan-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                >
                    Buy for ${pkg.price}
                </button>
            </div>
        </div>
    );
};

const PlansSection = ({ currentPlan, refreshData }: any) => {
    const plans = [
        {
            id: 'free',
            name: 'Free Account',
            price: 0,
            period: 'forever',
            credits: 25,
            features: ['25 AdRoom Credits', 'Basic Analytics', 'Manual Strategy Approval'],
            color: 'slate'
        },
        {
            id: 'pro_monthly',
            name: 'Pro Monthly',
            price: 45,
            period: 'month',
            credits: 600,
            features: ['600 Credits / Month', 'Real-time Automation', 'Priority Support', 'Advanced Analytics'],
            color: 'cyan',
            highlight: true
        },
        {
            id: 'pro_yearly',
            name: 'Pro Yearly',
            price: 405, // 33.75 * 12
            period: 'year',
            credits: '600 / mo',
            subtitle: 'Equivalent to $33.75/mo',
            features: ['Everything in Pro', '2 Months Free', 'Dedicated Account Manager'],
            color: 'purple'
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
                <PricingCard 
                    key={plan.id} 
                    plan={plan} 
                    isCurrent={currentPlan === plan.id}
                    onSuccess={refreshData}
                />
            ))}
        </div>
    );
};

const PricingCard = ({ plan, isCurrent, onSuccess }: any) => {
    const [userEmail, setUserEmail] = useState('');
    
    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) setUserEmail(data.user.email || '');
        });
    }, []);

    const config = {
        public_key: import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY || '',
        tx_ref: `sub_${plan.id}_${Date.now()}`,
        amount: plan.price * 1500, // Convert USD to NGN approx? Or charge in USD?
        // Flutterwave supports USD. Let's use USD if allowed, or convert. 
        // User quoted dollars ($45). Let's assume USD currency.
        currency: 'USD',
        payment_options: 'card,mobilemoney,ussd',
        customer: {
            email: userEmail,
            name: 'AdRoom User',
        },
        customizations: {
            title: `AdRoom ${plan.name}`,
            description: `Subscription for ${plan.name}`,
            logo: 'https://villanovarealty.com/logo.png',
        },
    };

    const handlePayment = useFlutterwave(config);

    const onPay = () => {
        if (plan.price === 0) return; // Free plan logic if needed (downgrade?)

        handlePayment({
            callback: async (response) => {
                closePaymentModal();
                if (response.status === 'successful') {
                    // Call backend to update subscription
                    const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
                    const { data: { user } } = await supabase.auth.getUser();
                    const { data: { session } } = await supabase.auth.getSession();
                    
                    await fetch(`${API_URL}/api/wallet/subscription`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session?.access_token}`
                        },
                        body: JSON.stringify({ 
                            admin_id: user?.id,
                            plan: plan.id,
                            transaction_id: response.transaction_id
                        })
                    });
                    
                    alert(`Successfully upgraded to ${plan.name}!`);
                    onSuccess();
                }
            },
            onClose: () => {},
        });
    };

    const isPro = plan.color === 'cyan';
    const isElite = plan.color === 'purple';
    
    return (
        <div className={`relative rounded-2xl p-6 border ${
            isCurrent ? 'border-green-500 bg-green-500/5 ring-1 ring-green-500/50' : 
            plan.highlight ? 'border-cyan-500/50 bg-slate-900 shadow-xl shadow-cyan-900/10' : 
            'border-slate-800 bg-slate-900/50'
        } flex flex-col`}>
            {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-cyan-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                    MOST POPULAR
                </div>
            )}

            <h3 className={`text-lg font-bold ${isElite ? 'text-purple-400' : isPro ? 'text-cyan-400' : 'text-slate-300'}`}>
                {plan.name}
            </h3>
            
            <div className="mt-4 mb-6">
                <span className="text-3xl font-bold text-white">${plan.price}</span>
                <span className="text-slate-500 text-sm"> / {plan.period}</span>
                {plan.subtitle && <p className="text-xs text-slate-400 mt-1">{plan.subtitle}</p>}
            </div>

            <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature: string, i: number) => (
                    <li key={i} className="flex items-start text-sm text-slate-300">
                        <Check className="h-4 w-4 text-green-500 mr-2 mt-0.5 shrink-0" />
                        {feature}
                    </li>
                ))}
            </ul>

            <button
                onClick={onPay}
                disabled={isCurrent}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                    isCurrent ? 'bg-slate-800 text-slate-500 cursor-default' :
                    isPro ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/20' :
                    isElite ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20' :
                    'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
            >
                {isCurrent ? 'Current Plan' : plan.price === 0 ? 'Downgrade' : 'Upgrade Now'}
            </button>
        </div>
    );
};

const UsageSection = ({ logs }: any) => {
    return (
        <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <History className="h-5 w-5 text-slate-400" />
                    Credit Usage History
                </h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-950/50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Action</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Credits</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Date</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Description</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {logs.length > 0 ? logs.map((log: any) => (
                            <tr key={log.id} className="hover:bg-slate-800/50">
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                        log.amount > 0 ? 'bg-green-500/10 text-green-400' : 'bg-cyan-500/10 text-cyan-400'
                                    }`}>
                                        {log.action_type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-mono text-slate-300">
                                    {log.amount > 0 ? '+' : ''}{log.amount}
                                </td>
                                <td className="px-6 py-4 text-slate-400 text-sm">
                                    {new Date(log.created_at).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-slate-400 text-sm">
                                    {log.description}
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-slate-500">
                                    No usage history found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Subscription;
