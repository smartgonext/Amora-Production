import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { FiCheck, FiX, FiDownload, FiShield } from 'react-icons/fi';

const planFeatures = {
  'Free Trial': ['1 Device', '3 Users', '100 MB Storage', '500 Bills Max', '15 Days Duration', 'Basic Modules'],
  'Starter': ['1 Device', '5 Users', '500 MB Storage', 'Unlimited Bills', 'All Core Modules', 'Email Support'],
  'Growth': ['2 Devices', '15 Users', '2 GB Storage', 'Unlimited Bills', 'All Modules', 'Priority Support', 'API Access'],
  'Enterprise': ['5 Devices', '50 Users', '10 GB Storage', 'Unlimited Bills', 'All Modules + Custom', 'Dedicated Support', 'API + White Label'],
  'Enterprise Annual': ['10 Devices', '100 Users', '50 GB Storage', 'Unlimited Bills', 'Everything', '24/7 Support', 'Custom Domain']
};

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [currentSub, setCurrentSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [plansRes, subRes] = await Promise.all([
        apiClient.get('/licensing/plans'),
        apiClient.get('/licensing/my-subscription').catch(() => null)
      ]);
      setPlans(plansRes.data.data);
      if (subRes) setCurrentSub(subRes.data.data);
    } catch (err) {
      console.error('Failed to load plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId) => {
    setUpgrading(true);
    try {
      await apiClient.post('/licensing/upgrade', {
        plan_id: planId,
        payment_ref: 'DEMO_' + Date.now(),
        amount: plans.find(p => p.id === planId)?.price || 0,
        provider: 'demo',
        payment_method: 'Demo'
      });
      alert('Plan upgraded successfully!');
      loadData();
    } catch (err) {
      alert('Upgrade failed: ' + (err.response?.data?.errors?.[0] || 'Error'));
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Subscription & Licensing</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your plan, devices, and license</p>
      </div>

      {/* Current Subscription */}
      {currentSub && (
        <div className="card">
          <h2 className="section-title">Current Subscription</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Plan</p>
              <p className="font-semibold">{currentSub.plan?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                currentSub.subscription?.status === 'active' || currentSub.subscription?.status === 'trial'
                  ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {currentSub.subscription?.status}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Days Remaining</p>
              <p className={`font-semibold ${currentSub.days_remaining <= 3 ? 'text-red-600' : ''}`}>
                {currentSub.days_remaining} days
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Devices</p>
              <p className="font-semibold">{currentSub.device_count} registered</p>
            </div>
          </div>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {plans.filter(p => p.name !== 'Free Trial').map((plan) => (
          <div key={plan.id} className="card flex flex-col">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h3>
              <p className="text-3xl font-bold text-primary-600 mt-2">
                ₹{plan.price.toLocaleString()}
                <span className="text-sm text-gray-500 font-normal">/{plan.billing_cycle === 'annual' ? 'yr' : 'mo'}</span>
              </p>
            </div>

            <div className="flex-1 space-y-2 mb-6">
              {planFeatures[plan.name]?.map((feature, i) => (
                <div key={i} className="flex items-center space-x-2 text-sm">
                  <FiCheck className="text-green-500 flex-shrink-0" />
                  <span className="text-gray-600 dark:text-gray-400">{feature}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => handleUpgrade(plan.id)}
              disabled={upgrading}
              className="btn-primary w-full text-center"
            >
              {upgrading ? 'Processing...' : currentSub?.plan?.id === plan.id ? 'Current Plan' : 'Upgrade'}
            </button>
          </div>
        ))}
      </div>

      {/* Desktop EXE Download */}
      <div className="card">
        <h2 className="section-title">Desktop EXE</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Download the desktop application for offline-capable ERP access.
        </p>
        <div className="flex flex-wrap gap-4">
          <button className="btn-primary flex items-center space-x-2">
            <FiDownload />
            <span>Download for Windows</span>
          </button>
          <button className="btn-secondary flex items-center space-x-2">
            <FiShield />
            <span>View License Key</span>
          </button>
        </div>
      </div>
    </div>
  );
}