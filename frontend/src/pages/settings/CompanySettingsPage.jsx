import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiSave, FiUpload, FiTrash2, FiHome, FiGlobe, FiMail, FiPhone,
  FiMapPin, FiDollarSign, FiCalendar, FiImage, FiCheckCircle, FiAlertTriangle, FiSmartphone, FiFileText } from 'react-icons/fi';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';

// ─── Fetch company data ───────────────────────────────────────────────────────
const fetchCompany = (id) => apiClient.get(`/companies/${id}`).then((r) => r.data.data);

export default function CompanySettingsPage() {
  const { user } = useAuth();
  const { company, updateCompany, uploadLogo, deleteLogo, setCompany, updateSettings } = useCompany();
  const qc = useQueryClient();
  const fileInputRef = useRef();

  const companyId = user?.company_id;

  // Fetch full company data with settings
  const { data: fullCompany, isLoading } = useQuery({
    queryKey: ['company-full', companyId],
    queryFn: () => fetchCompany(companyId),
    enabled: !!companyId,
    initialData: company,
  });

  const [form, setForm] = useState({
    name: '', address: '', city: '', state: '', pincode: '', country: 'India',
    gstin: '', pan: '', email: '', phone: '', website: '', 
    std_code: '+91',
    currency: 'INR',
    financial_year_start_month: 4, timezone: 'Asia/Kolkata',
    default_language: 'en', business_type: '',
    business_catalog_type: 'both',
    invoice_format: 'Standard', quotation_format: 'Standard'
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [message, setMessage] = useState(null);

  // Sync form with fetched data
  useEffect(() => {
    if (fullCompany) {
      setForm({
        name: fullCompany.name || '',
        address: fullCompany.address || '',
        city: fullCompany.city || '',
        state: fullCompany.state || '',
        pincode: fullCompany.pincode || '',
        country: fullCompany.country || 'India',
        gstin: fullCompany.gstin || '',
        pan: fullCompany.pan || '',
        email: fullCompany.email || '',
        phone: fullCompany.phone || '',
        website: fullCompany.website || '',
        currency: fullCompany.currency || 'INR',
        financial_year_start_month: fullCompany.financial_year_start_month || 4,
        timezone: fullCompany.timezone || 'Asia/Kolkata',
        default_language: fullCompany.default_language || 'en',
        business_type: fullCompany.business_type || '',
        business_catalog_type: fullCompany.settings?.business_catalog_type || 'both',
        invoice_format: fullCompany.settings?.templates?.invoice_format || 'Standard',
        quotation_format: fullCompany.settings?.templates?.quotation_format || 'Standard',
      });
    }
  }, [fullCompany]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Company name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateCompany(companyId, {
        name: form.name,
        address: form.address,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        country: form.country,
        gstin: form.gstin,
        pan: form.pan,
        email: form.email,
        phone: form.phone,
        website: form.website,
        currency: form.currency,
        financial_year_start_month: form.financial_year_start_month,
        timezone: form.timezone,
        default_language: form.default_language,
        business_type: form.business_type
      });
      
      await updateSettings(companyId, {
        business_catalog_type: form.business_catalog_type,
        templates: {
          invoice_format: form.invoice_format,
          quotation_format: form.quotation_format
        }
      });
      
      setMessage({ type: 'success', text: 'Company details and print templates saved successfully!' });
      qc.invalidateQueries({ queryKey: ['company-full'] });
    } catch (err) {
      setMessage({ type: 'error', text: err?.response?.data?.errors?.[0] || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Logo must be under 5MB' });
      return;
    }

    // Validate type
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml'].includes(file.type)) {
      setMessage({ type: 'error', text: 'Logo must be PNG, JPG, GIF, or SVG' });
      return;
    }

    setUploadingLogo(true);
    setMessage(null);
    try {
      await uploadLogo(companyId, file);
      setMessage({ type: 'success', text: 'Logo uploaded successfully!' });
      qc.invalidateQueries(['company-full']);
    } catch (err) {
      setMessage({ type: 'error', text: err?.response?.data?.errors?.[0] || 'Upload failed' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoDelete = async () => {
    if (!confirm('Delete company logo?')) return;
    try {
      await deleteLogo(companyId);
      setMessage({ type: 'success', text: 'Logo deleted successfully!' });
      qc.invalidateQueries(['company-full']);
    } catch (err) {
      setMessage({ type: 'error', text: 'Delete failed' });
    }
  };

  const Field = ({ label, name, type = 'text', required, placeholder, span = 1 }) => (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <label className="label">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={form[name] || ''}
        onChange={(e) => set(name, e.target.value)}
        placeholder={placeholder}
        className={`input-field ${errors[name] ? 'border-red-500' : ''}`}
      />
      {errors[name] && <p className="error-text">{errors[name]}</p>}
    </div>
  );

  const Select = ({ label, name, options, required }) => (
    <div>
      <label className="label">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <select value={form[name]} onChange={(e) => set(name, e.target.value)} className="input-field">
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="page-title">Company Settings</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Configure your company profile, branding, and system preferences
        </p>
      </div>

      {/* Message banner */}
      {message && (
        <div
          className={`flex items-center space-x-3 p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <FiCheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <FiAlertTriangle className="w-5 h-5 flex-shrink-0" />
          )}
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      {/* Logo section */}
      <div className="card">
        <h2 className="section-title flex items-center space-x-2">
          <FiImage className="w-5 h-5" />
          <span>Company Logo</span>
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Upload your company logo. It will appear in the sidebar and on all invoices, reports, and documents.
        </p>
        <div className="flex items-start space-x-6">
          {/* Preview */}
          <div className="flex-shrink-0">
            {fullCompany?.logo_url ? (
              <div className="relative group">
                <img
                  src={fullCompany.logo_url}
                  alt="Company logo"
                  className="w-32 h-32 rounded-lg object-contain border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                />
                <button
                  onClick={handleLogoDelete}
                  className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete logo"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="w-32 h-32 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                <FiImage className="w-8 h-8 text-gray-400" />
              </div>
            )}
          </div>

          {/* Upload controls */}
          <div className="flex-1 space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/gif,image/svg+xml"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingLogo}
              className="btn-primary flex items-center space-x-2"
            >
              <FiUpload className="w-4 h-4" />
              <span>{uploadingLogo ? 'Uploading…' : fullCompany?.logo_url ? 'Change Logo' : 'Upload Logo'}</span>
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Accepted: PNG, JPG, GIF, SVG • Max size: 5MB • Recommended: 512×512px square
            </p>
          </div>
        </div>
      </div>

      {/* Company information */}
      <form onSubmit={handleSave} className="card">
        <h2 className="section-title flex items-center space-x-2">
          <FiHome className="w-5 h-5" />
          <span>Company Information</span>
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Company Name" name="name" required span={2} />
          <Field label="Email" name="email" type="email" required />
          <Field label="Phone" name="phone" type="tel" />
          <div>
            <label className="label">STD Code (for WhatsApp)</label>
            <select
              value={form.std_code || '+91'}
              onChange={(e) => set('std_code', e.target.value)}
              className="input-field"
            >
              <option value="+91">+91 (India)</option>
              <option value="+1">+1 (US)</option>
              <option value="+44">+44 (UK)</option>
              <option value="+971">+971 (UAE)</option>
              <option value="+61">+61 (Australia)</option>
              <option value="+65">+65 (Singapore)</option>
              <option value="+92">+92 (Pakistan)</option>
              <option value="+880">+880 (Bangladesh)</option>
              <option value="+977">+977 (Nepal)</option>
              <option value="+94">+94 (Sri Lanka)</option>
            </select>
          </div>
          <Field label="Website" name="website" type="url" placeholder="https://example.com" />
          <Select
            label="Business Type"
            name="business_type"
            options={[
              { value: '', label: '— Select Type —' },
              { value: 'Retail Shop', label: 'Retail Shop' },
              { value: 'Wholesale', label: 'Wholesale Distribution' },
              { value: 'Restaurant', label: 'Restaurant / Cafe' },
              { value: 'Spa', label: 'Spa / Salon' },
              { value: 'Hospital', label: 'Hospital / Clinic' },
              { value: 'School', label: 'School / College' },
              { value: 'Manufacturing', label: 'Manufacturing' },
              { value: 'Construction', label: 'Construction' },
              { value: 'Crane & Forklift', label: 'Crane & Forklift' },
            ]}
          />

          <Select
            label="Business Catalog Mode"
            name="business_catalog_type"
            options={[
              { value: 'both', label: 'Products + Services (Hybrid Catalog)' },
              { value: 'product', label: 'Products Only (Physical Inventory)' },
              { value: 'service', label: 'Services Only (Billable & Hourly Services)' }
            ]}
          />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
          <strong>Catalog Mode Explanation:</strong> Choosing <em>Products Only</em> restricts catalog features to physical inventory trackables. <em>Services Only</em> optimizes forms, terms, and billing units for pure service-oriented models. <em>Products + Services</em> enables managing both simultaneously across inventory and POS billing.
        </p>

        <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3 flex items-center space-x-2">
          <FiMapPin className="w-4 h-4" />
          <span>Address Details</span>
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Street Address" name="address" span={2} />
          <Field label="City" name="city" />
          <Field label="State / Province" name="state" />
          <Field label="Postal Code" name="pincode" />
          <Field label="Country" name="country" />
        </div>

        <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3 flex items-center space-x-2">
          <FiDollarSign className="w-4 h-4" />
          <span>Tax & Compliance</span>
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="GSTIN" name="gstin" placeholder="22AAAAA0000A1Z5" />
          <Field label="PAN" name="pan" placeholder="AAAAA0000A" />
        </div>

        <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3 flex items-center space-x-2">
          <FiGlobe className="w-4 h-4" />
          <span>Regional Settings</span>
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Currency"
            name="currency"
            options={[
              { value: 'INR', label: '₹ Indian Rupee (INR)' },
              { value: 'USD', label: '$ US Dollar (USD)' },
              { value: 'EUR', label: '€ Euro (EUR)' },
              { value: 'GBP', label: '£ British Pound (GBP)' },
            ]}
          />
          <Select
            label="Language"
            name="default_language"
            options={[
              { value: 'en', label: 'English' },
              { value: 'hi', label: 'Hindi' },
              { value: 'ta', label: 'Tamil' },
              { value: 'te', label: 'Telugu' },
            ]}
          />
          <Select
            label="Financial Year Starts"
            name="financial_year_start_month"
            options={[
              { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
              { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
              { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
              { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
            ]}
          />
          <Select
            label="Timezone"
            name="timezone"
            options={[
              { value: 'Asia/Kolkata', label: 'India (IST)' },
              { value: 'America/New_York', label: 'New York (EST)' },
              { value: 'Europe/London', label: 'London (GMT)' },
              { value: 'Asia/Dubai', label: 'Dubai (GST)' },
            ]}
          />
        </div>
        
        <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3 flex items-center space-x-2">
          <FiFileText className="w-4 h-4" />
          <span>Print & Document Templates</span>
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Invoice Print Format"
            name="invoice_format"
            options={[
              { value: 'Standard', label: 'Standard Invoice (A4/Letter)' },
              { value: 'Thermal', label: 'Thermal Receipt (3-inch / 80mm)' },
              { value: 'Sleek', label: 'Sleek Corporate Design (A4)' },
            ]}
          />
          <Select
            label="Quotation Print Format"
            name="quotation_format"
            options={[
              { value: 'Standard', label: 'Standard Quotation (A4)' },
              { value: 'Thermal', label: 'Thermal Quotation (3-inch / 80mm)' },
              { value: 'Sleek', label: 'Sleek Corporate Design (A4)' },
            ]}
          />
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-6 border-t border-gray-200 dark:border-gray-700 mt-6">
          <button type="submit" disabled={saving} className="btn-primary flex items-center space-x-2">
            <FiSave className="w-4 h-4" />
            <span>{saving ? 'Saving…' : 'Save Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
