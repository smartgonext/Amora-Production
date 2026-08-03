import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { FiCheck, FiChevronRight, FiChevronLeft } from 'react-icons/fi';
import toast from 'react-hot-toast';

const BUSINESS_TYPES = [
  'Retail Shop', 'Wholesale Distribution', 'Restaurant', 'Cafe', 'Bakery',
  'Spa', 'Salon', 'Equipment Rental', 'Hospital', 'Clinic',
  'School', 'College', 'Apartment Management', 'Hostel Management',
  'Hotel', 'Lodge', 'Manufacturing Unit', 'Textile Business',
  'Finance', 'Microfinance', 'Construction', 'Repair Shop',
  'Vehicle Service', 'Mobile Shop', 'Medical Shop', 'Pharmacy',
  'Jewellery Shop', 'Supermarket', 'Crane & Forklift'
];

const steps = [
  'Company Profile', 'Business Type', 'Tax Setup', 'Invoice Template',
  'Agreement Template', 'Receipt Template', 'Quotation Template',
  'PO Template', 'Challan Template', 'Finish'
];

const defaultTemplates = {
  invoice: `<h3>INVOICE</h3><p><strong>Billed To:</strong> {Customer}</p><p><strong>Date:</strong> {Date}</p><p><strong>Grand Total:</strong> {Amount}</p><hr/><p>Thank you for your business!</p>`,
  agreement: `<h3>LEASE AGREEMENT</h3><p>This contract confirms equipment leasing terms to <strong>{Customer}</strong> commencing on {Date}.</p><p><strong>Agreed Amount:</strong> {Amount}</p><hr/><p>Authorized Signature: __________________</p>`,
  receipt: `<h3>RECEIPT</h3><p>Received payment from {Customer} on {Date}.</p><p><strong>Paid Sum:</strong> {Amount}</p>`,
  quotation: `<h3>QUOTATION ESTIMATE</h3><p>Quote valid for {Customer} for 30 days starting {Date}.</p><p><strong>Estimated Quote:</strong> {Amount}</p>`,
  purchase_order: `<h3>PURCHASE ORDER</h3><p>Issued to Supplier for purchase requisition on {Date}.</p><p><strong>PO Total:</strong> {Amount}</p>`,
  delivery_challan: `<h3>DELIVERY CHALLAN</h3><p>Goods receipt dispatch verification for {Customer} on {Date}.</p>`
};

export default function SetupWizardPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState({
    name: 'SmartGoNext ERP Corp', address: '123 Business Way', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001',
    gstin: '33AABCC1234D1Z5', pan: 'ABCDE1234F', email: 'hello@smartgonext.com', phone: '+91 98765 43210', currency: 'INR',
    financial_year_start_month: 4, timezone: 'Asia/Kolkata'
  });
  const [businessType, setBusinessType] = useState('Retail Shop');
  const [tax, setTax] = useState({
    gst_enabled: true, cgst_rate: 9, sgst_rate: 9, igst_rate: 18,
    default_discount_type: 'percentage', round_off_rule: 'nearest', default_gst_rate: 18
  });
  
  // Custom templates state
  const [templates, setTemplates] = useState(defaultTemplates);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/setup/status').then(res => {
      if (res.data.data.setup_completed) {
        navigate('/dashboard');
      }
    }).catch(() => {});
  }, []);

  const handleNext = async () => {
    setError('');
    setLoading(true);
    try {
      if (currentStep === 0) {
        await apiClient.put('/setup/company', company);
      } else if (currentStep === 1) {
        await apiClient.put('/setup/business-type', { business_type: businessType });
      } else if (currentStep === 2) {
        await apiClient.put('/setup/tax-settings', tax);
      } else if (currentStep >= 3 && currentStep <= 8) {
        // Save template updates
        const templateKeys = ['invoice', 'agreement', 'receipt', 'quotation', 'purchase_order', 'delivery_challan'];
        const key = templateKeys[currentStep - 3];
        await apiClient.put('/setup/template', { type: key, html_content: templates[key] });
      } else if (currentStep === 9) {
        await apiClient.post('/setup/finish');
        toast.success('ERP Activated successfully!');
        navigate('/dashboard');
        return;
      }
      
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    } catch (err) {
      setError(err.response?.data?.errors?.[0] || 'Error saving data');
    } finally {
      setLoading(false);
    }
  };

  const updateTemplateContent = (key, text) => {
    setTemplates({
      ...templates,
      [key]: text
    });
  };

  const getParsedPreview = (html) => {
    if (!html) return '';
    return html
      .replace(/{Company}/g, company.name || '[Company]')
      .replace(/{Customer}/g, 'Acme Corp Private Ltd')
      .replace(/{Date}/g, new Date().toLocaleDateString())
      .replace(/{Amount}/g, '₹ 45,000.00');
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Company Name *</label>
              <input value={company.name} onChange={e => setCompany({...company, name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-sm" placeholder="Your Business Name" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Address</label>
              <textarea value={company.address} onChange={e => setCompany({...company, address: e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-sm" rows={2} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">City</label>
              <input value={company.city} onChange={e => setCompany({...company, city: e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">State</label>
              <input value={company.state} onChange={e => setCompany({...company, state: e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">GSTIN / Tax ID</label>
              <input value={company.gstin} onChange={e => setCompany({...company, gstin: e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Contact Phone</label>
              <input value={company.phone} onChange={e => setCompany({...company, phone: e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-sm" />
            </div>
          </div>
        );

      case 1:
        return (
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Select Business Sector *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 max-h-60 overflow-y-auto">
              {BUSINESS_TYPES.map(bt => (
                <button
                  key={bt}
                  onClick={() => setBusinessType(bt)}
                  className={`p-3 rounded-lg border text-xs text-left transition-colors ${
                    businessType === bt
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20'
                      : 'border-slate-200 dark:border-slate-750'
                  }`}
                >
                  {bt}
                </button>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="flex items-center space-x-2">
                <input type="checkbox" checked={tax.gst_enabled} onChange={e => setTax({...tax, gst_enabled: e.target.checked})} className="rounded" />
                <span className="text-xs font-bold text-slate-500 uppercase">GST Registration Active</span>
              </label>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">CGST Rate (%)</label>
              <input type="number" value={tax.cgst_rate} onChange={e => setTax({...tax, cgst_rate: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">SGST Rate (%)</label>
              <input type="number" value={tax.sgst_rate} onChange={e => setTax({...tax, sgst_rate: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-sm" />
            </div>
          </div>
        );

      case 3: case 4: case 5: case 6: case 7: case 8:
        const templateNames = ['Invoice', 'Agreement', 'Receipt', 'Quotation', 'Purchase Order', 'Delivery Challan'];
        const templateKeys = ['invoice', 'agreement', 'receipt', 'quotation', 'purchase_order', 'delivery_challan'];
        const idx = currentStep - 3;
        const currentKey = templateKeys[idx];
        return (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Customize the {templateNames[idx]} print template. Dynamic tags like <code>{"{Company}"}</code>, <code>{"{Customer}"}</code>, <code>{"{Date}"}</code>, and <code>{"{Amount}"}</code> are replaced automatically.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">HTML Document Design</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-750 bg-slate-950 text-emerald-400 font-mono text-xs rounded-lg mt-1"
                  rows={10}
                  value={templates[currentKey]}
                  onChange={(e) => updateTemplateContent(currentKey, e.target.value)}
                />
              </div>
              <div className="border border-slate-150 dark:border-slate-800 rounded-lg p-4 bg-slate-50 dark:bg-slate-850 overflow-y-auto max-h-72">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Real-time Formatted Preview</span>
                <div
                  className="bg-white text-black p-4 rounded border border-slate-200 shadow-sm text-xs space-y-2 min-h-60"
                  dangerouslySetInnerHTML={{ __html: getParsedPreview(templates[currentKey]) }}
                />
              </div>
            </div>
          </div>
        );

      case 9:
        return (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/20 rounded-full flex items-center justify-center mx-auto">
              <FiCheck className="text-2xl text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Setup Configuration Complete!</h2>
            <p className="text-xs text-slate-500">All configurations are validated. Click Activate to launch the main workspace.</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 flex items-center justify-center">
      <div className="max-w-3xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">SmartGoNext Setup Wizard</h1>
          <p className="text-xs text-slate-450">Step {currentStep + 1} of {steps.length}: {steps[currentStep]}</p>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
          <div className="bg-indigo-600 h-full transition-all" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} />
        </div>

        <div>
          {error && <div className="p-3 bg-rose-50 text-rose-600 rounded-lg text-xs mb-4">{error}</div>}
          {renderStep()}
        </div>

        <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg disabled:opacity-50"
          >
            ← Previous
          </button>
          <button onClick={handleNext} disabled={loading} className="px-5 py-2 bg-indigo-650 hover:bg-indigo-755 text-white rounded-lg shadow">
            {loading ? 'Saving...' : currentStep === 9 ? 'Activate Workspace' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}