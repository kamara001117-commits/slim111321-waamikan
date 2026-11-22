import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';
import { db } from '@/src/lib/firebase';
import { COMPANY_INFO } from '@/src/constants/auth';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreError';
import {
  Settings as SettingsIcon,
  Building2,
  Wallet,
  Shield,
  Globe,
  Save,
  Check,
} from 'lucide-react';

interface SystemSettings {
  company: {
    name: string;
    address: string;
    taxId: string;
    currency: string;
  };
  workflow: {
    requireQuoteApproval: boolean;
    autoGenerateInvoices: boolean;
    enableLogistics: boolean;
  };
  tax: {
    vatRate: number;
    enabled: boolean;
  };
}

const Settings = () => {
  const { currentUserRole } = useOutletContext<{ currentUserRole: string | null }>();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'Company' | 'Workflows' | 'Tax'>('Company');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!currentUserRole) return;

    const unsub = onSnapshot(
      doc(db, 'settings', 'system'),
      (snap) => {
        if (snap.exists()) {
          setSettings(snap.data() as SystemSettings);
        } else {
          setSettings({
            company: {
              name: COMPANY_INFO.name,
              address: COMPANY_INFO.address,
              taxId: '',
              currency: 'GHC',
            },
            workflow: {
              requireQuoteApproval: true,
              autoGenerateInvoices: false,
              enableLogistics: true,
            },
            tax: { vatRate: 15, enabled: true },
          });
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'settings/system');
      }
    );
    return () => unsub();
  }, [currentUserRole]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'system'), {
        ...settings,
        updatedAt: new Date().toISOString(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/system');
      alert('Failed to save settings. Ensure you have Admin permissions.');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <div className="p-8 text-gray-500">Loading settings...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0B3C5D] flex items-center gap-3">
            <SettingsIcon size={30} />
            System Settings
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Configure your ERP preferences and company profile
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-[#0B3C5D] text-white px-6 py-3 rounded-xl hover:bg-[#1d4b6d] transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 font-bold text-sm"
        >
          {saving ? (
            <Globe className="animate-spin" size={18} />
          ) : saved ? (
            <Check size={18} />
          ) : (
            <Save size={18} />
          )}
          {saved ? 'Saved' : saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Navigation */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setActiveTab('Company')}
            className={`w-full text-left px-6 py-4 rounded-2xl flex items-center gap-3 transition-all ${
              activeTab === 'Company'
                ? 'bg-white text-[#0B3C5D] shadow-md border-l-4 border-[#0B3C5D] font-bold'
                : 'text-gray-500 hover:bg-white hover:shadow-sm'
            }`}
          >
            <Building2 size={20} />
            <span>Company Profile</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('Workflows')}
            className={`w-full text-left px-6 py-4 rounded-2xl flex items-center gap-3 transition-all ${
              activeTab === 'Workflows'
                ? 'bg-white text-[#0B3C5D] shadow-md border-l-4 border-[#0B3C5D] font-bold'
                : 'text-gray-500 hover:bg-white hover:shadow-sm'
            }`}
          >
            <Shield size={20} />
            <span>Workflows</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('Tax')}
            className={`w-full text-left px-6 py-4 rounded-2xl flex items-center gap-3 transition-all ${
              activeTab === 'Tax'
                ? 'bg-white text-[#0B3C5D] shadow-md border-l-4 border-[#0B3C5D] font-bold'
                : 'text-gray-500 hover:bg-white hover:shadow-sm'
            }`}
          >
            <Wallet size={20} />
            <span>Tax &amp; Currency</span>
          </button>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100">
            {activeTab === 'Company' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Company Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Legal Business Name
                    </label>
                    <input
                      type="text"
                      value={settings.company.name}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          company: { ...settings.company, name: e.target.value },
                        })
                      }
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0B3C5D] outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Tax ID / VAT Number
                    </label>
                    <input
                      type="text"
                      value={settings.company.taxId}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          company: { ...settings.company, taxId: e.target.value },
                        })
                      }
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0B3C5D] outline-none transition-all"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Business Address
                    </label>
                    <textarea
                      rows={3}
                      value={settings.company.address}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          company: { ...settings.company, address: e.target.value },
                        })
                      }
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0B3C5D] outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'Workflows' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Operational Workflows</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl gap-4">
                    <div>
                      <p className="font-semibold text-gray-800">Quotation Approval</p>
                      <p className="text-sm text-gray-500">
                        Require manager approval before converting quotes to orders
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.workflow.requireQuoteApproval}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          workflow: {
                            ...settings.workflow,
                            requireQuoteApproval: e.target.checked,
                          },
                        })
                      }
                      className="w-6 h-6 rounded border-gray-300 text-[#0B3C5D] focus:ring-[#0B3C5D] shrink-0"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl gap-4">
                    <div>
                      <p className="font-semibold text-gray-800">Auto-Invoice Generation</p>
                      <p className="text-sm text-gray-500">
                        Automatically create invoices when orders are fulfilled
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.workflow.autoGenerateInvoices}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          workflow: {
                            ...settings.workflow,
                            autoGenerateInvoices: e.target.checked,
                          },
                        })
                      }
                      className="w-6 h-6 rounded border-gray-300 text-[#0B3C5D] focus:ring-[#0B3C5D] shrink-0"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'Tax' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Tax Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Default Currency
                    </label>
                    <select
                      value={settings.company.currency}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          company: { ...settings.company, currency: e.target.value },
                        })
                      }
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0B3C5D] outline-none transition-all"
                    >
                      <option value="GHC">GHC (₵)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      VAT / Tax Rate (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={settings.tax.vatRate}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          tax: { ...settings.tax, vatRate: Number(e.target.value) || 0 },
                        })
                      }
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0B3C5D] outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
