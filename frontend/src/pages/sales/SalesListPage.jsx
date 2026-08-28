import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiFileText, FiSearch, FiEye, FiX, FiPrinter, FiDollarSign, 
  FiCalendar, FiCreditCard, FiPlus, FiTag, FiTruck, FiRotateCcw 
} from 'react-icons/fi';
import apiClient from '../../api/client';
import { formatINR } from '../../utils/format';
import toast from 'react-hot-toast';
import { useCompany } from '../../context/CompanyContext';
import CustomTemplateRenderer from '../../components/templates/CustomTemplateRenderer';

export default function SalesListPage() {
  const queryClient = useQueryClient();
  const { company } = useCompany();
  const [activeTab, setActiveTab] = useState('invoices');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [printedDocument, setPrintedDocument] = useState(null);
  const [printFormat, setPrintFormat] = useState('Standard');

  // Form states
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [rate, setRate] = useState('');

  // --- Queries ---
  const { data: invoicesResponse, isLoading: isLoadingInvoices } = useQuery({
    queryKey: ['invoices', searchTerm],
    queryFn: async () => {
      const response = await apiClient.get('/invoices', { params: { search: searchTerm } });
      return response.data;
    }
  });
  const invoices = invoicesResponse?.data || [];

  const { data: productsResponse } = useQuery({
    queryKey: ['products-mini'],
    queryFn: async () => {
      const response = await apiClient.get('/products');
      return response.data;
    }
  });
  const products = productsResponse?.data || [];

  const { data: invoiceDetailResponse, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['invoice-detail', selectedInvoice?.id, selectedInvoice?.type],
    queryFn: async () => {
      if (!selectedInvoice?.id) return null;
      const url = selectedInvoice.type === 'quotation'
        ? `/sales/quotations/${selectedInvoice.id}`
        : `/invoices/${selectedInvoice.id}`;
      const response = await apiClient.get(url);
      return response.data;
    },
    enabled: !!selectedInvoice?.id
  });
  const invoiceDetail = invoiceDetailResponse?.data;

  const { data: customersResponse } = useQuery({
    queryKey: ['customers-mini'],
    queryFn: async () => {
      const response = await apiClient.get('/customers');
      return response.data;
    }
  });
  const customers = customersResponse?.data || [];

  const { data: quotationsResponse } = useQuery({
    queryKey: ['quotations'],
    queryFn: async () => {
      const response = await apiClient.get('/sales/quotations');
      return response.data;
    }
  });
  const quotations = quotationsResponse?.data || [];

  const { data: ordersResponse } = useQuery({
    queryKey: ['sales-orders'],
    queryFn: async () => {
      const response = await apiClient.get('/sales/orders');
      return response.data;
    }
  });
  const orders = ordersResponse?.data || [];

  const { data: challansResponse } = useQuery({
    queryKey: ['challans'],
    queryFn: async () => {
      const response = await apiClient.get('/sales/challans');
      return response.data;
    }
  });
  const challans = challansResponse?.data || [];

  const { data: returnsResponse } = useQuery({
    queryKey: ['returns'],
    queryFn: async () => {
      const response = await apiClient.get('/sales/returns');
      return response.data;
    }
  });
  const returns = returnsResponse?.data || [];

  // --- Mutations ---
  const createQuotationMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/sales/quotations', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Quotation generated successfully!');
      setIsCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    }
  });

  const createOrderMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/sales/orders', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Sales Order registered!');
      setIsCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    }
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/invoices', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Tax Invoice generated & FEFO stock deducted!');
      setIsCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to generate tax invoice');
    }
  });

  const createChallanMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/sales/challans', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Delivery Challan generated!');
      setIsCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['challans'] });
    }
  });

  const createReturnMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/sales/returns', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Sales Return / Credit Note generated!');
      setIsCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['returns'] });
    }
  });

  // Convert a saved quotation to an invoice without re-entering data.
  // Uses the existing quotation data (customer, product, qty, rate, tax,
  // totals) and deducts finished-goods stock with batch allocation.
  const convertQuotationMutation = useMutation({
    mutationFn: async ({ quotationId, payload }) => {
      const response = await apiClient.post(
        `/sales/quotations/${quotationId}/convert-to-invoice`,
        payload
      );
      return response.data;
    },
    onSuccess: (res) => {
      toast.success(`Quotation converted to invoice ${res?.data?.invoice_number || ''}`);
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to convert quotation');
    }
  });

  const resetForm = () => {
    setCustomerId('');
    setAmount('');
    setNotes('');
    setProductId('');
    setQty('1');
    setRate('');
  };

  const handlePrint = () => {
    if (!invoiceDetail) return;
    const isQuote = selectedInvoice?.type === 'quotation';
    const format = isQuote
      ? (company?.settings?.templates?.quotation_format || 'Standard')
      : (company?.settings?.templates?.invoice_format || 'Standard');
    setPrintFormat(format);
    setPrintedDocument({
      type: isQuote ? 'Quotation' : (invoiceDetail.type || 'Sales'),
      data: invoiceDetail
    });
    setIsDetailOpen(false);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!customerId) return toast.error('Please select a customer.');

    const selectedProd = products.find(p => p.id === parseInt(productId));
    const itemRate = rate ? parseFloat(rate) : (selectedProd?.selling_price || 0);

    const items = productId ? [
      {
        product_id: parseInt(productId),
        product_name: selectedProd?.name,
        qty: parseFloat(qty) || 1,
        rate: itemRate,
        tax_percent: 18
      }
    ] : [];

    const payload = {
      customer_id: parseInt(customerId),
      subtotal: items.length > 0 ? items[0].qty * items[0].rate : (parseFloat(amount) || 0),
      total_amount: items.length > 0 ? items[0].qty * items[0].rate * 1.18 : (parseFloat(amount) || 0),
      notes,
      items
    };

    if (activeTab === 'invoices') {
      createInvoiceMutation.mutate(payload);
    } else if (activeTab === 'quotations') {
      createQuotationMutation.mutate(payload);
    } else if (activeTab === 'orders') {
      createOrderMutation.mutate(payload);
    } else if (activeTab === 'challans') {
      createChallanMutation.mutate({ ...payload, delivery_address: notes });
    } else if (activeTab === 'returns') {
      createReturnMutation.mutate({ ...payload, reason: notes });
    }
  };

  const renderPrintTemplate = (doc, format) => {
    const { type, data } = doc;
    const customerObj = customers.find(c => c.id === data.customer_id) || {};
    
    if (format === 'Custom') {
      const docTypeKey = type === 'Quotation' ? 'quotation' : 'invoice';
      return (
        <CustomTemplateRenderer 
          docType={docTypeKey}
          documentData={data}
          company={company}
          customer={customerObj}
        />
      );
    }
    
    const itemsList = data.items || [];
    const subtotal = parseFloat(data.subtotal || 0);
    const discount = parseFloat(data.discount_amount || 0);
    const cgst = parseFloat(data.cgst_amount || 0);
    const sgst = parseFloat(data.sgst_amount || 0);
    const total = parseFloat(data.total_amount || 0);
    const formattedDate = new Date(data.invoice_date || data.quotation_date || Date.now()).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });

    if (format === 'Thermal') {
      return (
        <div className="w-[80mm] p-2 bg-white text-black font-mono text-[11px] leading-tight select-none">
          <div className="text-center space-y-1 mb-3">
            <h2 className="text-sm font-bold uppercase">{company?.name || 'SmartGoNext'}</h2>
            <p className="text-[10px]">{company?.address}</p>
            {company?.gstin && <p className="text-[10px]">GSTIN: {company.gstin}</p>}
          </div>
          <div className="border-t border-dashed border-black py-1.5 space-y-0.5 text-[10px]">
            <p className="flex justify-between"><strong>{type.toUpperCase()}:</strong> <span>{data.invoice_number || data.quotation_number}</span></p>
            <p className="flex justify-between"><strong>DATE:</strong> <span>{formattedDate}</span></p>
            <p className="flex justify-between"><strong>CUST:</strong> <span>{customerObj.name || 'Walk-In'}</span></p>
          </div>
          <div className="border-t border-dashed border-black py-1">
            <div className="grid grid-cols-12 font-bold mb-1 border-b border-dashed border-black pb-0.5">
              <span className="col-span-6">ITEM</span>
              <span className="col-span-2 text-right">QTY</span>
              <span className="col-span-2 text-right">RATE</span>
              <span className="col-span-2 text-right">TOTAL</span>
            </div>
            {itemsList.map((itm, idx) => (
              <div key={idx} className="grid grid-cols-12">
                <span className="col-span-6 truncate">{itm.description || `Product #${itm.product_id}`}</span>
                <span className="col-span-2 text-right">{itm.quantity}</span>
                <span className="col-span-2 text-right">₹{parseFloat(itm.rate).toFixed(0)}</span>
                <span className="col-span-2 text-right">₹{parseFloat(itm.total_amount || (itm.quantity * itm.rate)).toFixed(0)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-dashed border-black pt-1.5 space-y-1 text-[10px]">
            <div className="flex justify-between"><span>Subtotal:</span><span>₹{subtotal.toFixed(2)}</span></div>
            {discount > 0 && <div className="flex justify-between text-red-650"><span>Discount:</span><span>-₹{discount.toFixed(2)}</span></div>}
            {cgst > 0 && <div className="flex justify-between"><span>CGST:</span><span>₹{cgst.toFixed(2)}</span></div>}
            {sgst > 0 && <div className="flex justify-between"><span>SGST:</span><span>₹{sgst.toFixed(2)}</span></div>}
            <div className="flex justify-between font-bold text-xs pt-1 border-t border-dashed border-black"><span>NET AMOUNT:</span><span>₹{total.toFixed(2)}</span></div>
          </div>
        </div>
      );
    }

    if (format === 'Sleek') {
      return (
        <div className="w-full bg-white text-slate-800 p-8 font-sans select-none rounded-xl">
          <div className="flex justify-between items-start border-b-4 border-indigo-600 pb-6 mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{company?.name || 'SmartGoNext'}</h2>
              <p className="text-xs text-slate-500 mt-1">{company?.address}</p>
              {company?.gstin && <p className="text-xs text-slate-500">GSTIN: {company.gstin}</p>}
            </div>
            <div className="text-right">
              <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full uppercase tracking-wider">{type}</span>
              <h1 className="text-lg font-black text-indigo-900 mt-2">{data.invoice_number || data.quotation_number}</h1>
              <p className="text-xs text-slate-500 mt-1">Date: {formattedDate}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider">Billed To</h3>
              <p className="font-bold text-slate-800 text-base">{customerObj.name || 'Walk-In Customer'}</p>
              {customerObj.address && <p className="text-slate-500 mt-0.5">{customerObj.address}</p>}
            </div>
          </div>
          <table className="w-full text-left border-collapse mb-6">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase border-b border-slate-150">
                <th className="py-2.5 px-4 w-[45%]">Item & Description</th>
                <th className="py-2.5 px-4 text-center w-[15%]">Qty</th>
                <th className="py-2.5 px-4 text-right w-[20%]">Rate</th>
                <th className="py-2.5 px-4 text-right w-[20%]">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {itemsList.map((itm, idx) => (
                <tr key={idx}>
                  <td className="py-2.5 px-4 font-medium text-slate-800">{itm.description || `Product #${itm.product_id}`}</td>
                  <td className="py-2.5 px-4 text-center">{itm.quantity}</td>
                  <td className="py-2.5 px-4 text-right">₹{parseFloat(itm.rate).toFixed(2)}</td>
                  <td className="py-2.5 px-4 text-right font-semibold">₹{parseFloat(itm.total_amount || (itm.quantity * itm.rate)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end pt-4 border-t border-slate-150">
            <div className="w-80 space-y-2 text-sm">
              <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
              {cgst > 0 && <div className="flex justify-between text-slate-500"><span>CGST</span><span>₹{cgst.toFixed(2)}</span></div>}
              {sgst > 0 && <div className="flex justify-between text-slate-500"><span>SGST</span><span>₹{sgst.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold text-base text-slate-900 border-t border-slate-150 pt-2"><span>Net Total</span><span className="text-indigo-650">₹{total.toFixed(2)}</span></div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full bg-white text-slate-800 p-8 font-sans select-none rounded-xl">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{company?.name || 'SmartGoNext'}</h2>
            <p className="text-xs text-slate-500 mt-1">{company?.address}</p>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-black text-slate-900">{type.toUpperCase()}</h1>
            <p className="text-sm font-semibold text-slate-600 mt-1">Number: {data.invoice_number || data.quotation_number}</p>
            <p className="text-xs text-slate-500 mt-1">Date: {formattedDate}</p>
          </div>
        </div>
        <table className="w-full text-left border-collapse text-xs mb-6">
          <thead>
            <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-250">
              <th className="py-2.5 px-3 w-[55%]">Item Description</th>
              <th className="py-2.5 px-3 text-center w-[15%]">Qty</th>
              <th className="py-2.5 px-3 text-right w-[15%]">Rate</th>
              <th className="py-2.5 px-3 text-right w-[15%]">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {itemsList.map((itm, idx) => (
              <tr key={idx}>
                <td className="py-2 px-3 font-semibold text-slate-800">{itm.description || `Product #${itm.product_id}`}</td>
                <td className="py-2 px-3 text-center">{itm.quantity}</td>
                <td className="py-2 px-3 text-right">₹{parseFloat(itm.rate).toFixed(2)}</td>
                <td className="py-2 px-3 text-right font-semibold">₹{parseFloat(itm.total_amount || (itm.quantity * itm.rate)).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end pt-4 border-t border-slate-150">
          <div className="w-80 space-y-2 text-xs">
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-sm text-slate-900 border-t border-slate-150 pt-2"><span>Total</span><span>₹{total.toFixed(2)}</span></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header section with Premium Indigo-Slate Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 p-8 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Sales & Receivables</h1>
            <p className="text-slate-300 mt-2 text-sm max-w-xl">
              Unified workspace for Invoices, Quotations, Sales Orders, Delivery Challans, and Returns.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center justify-center space-x-2 px-5 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold rounded-xl shadow-lg"
          >
            <FiPlus className="text-lg" />
            <span>Create {activeTab === 'invoices' ? 'Tax Invoice' : activeTab.slice(0, -1)}</span>
          </motion.button>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6 text-sm">
        {[
          { id: 'invoices', label: 'Billed Invoices', icon: FiFileText },
          { id: 'quotations', label: 'Quotations / Offers', icon: FiTag },
          { id: 'orders', label: 'Sales Orders', icon: FiCreditCard },
          { id: 'challans', label: 'Delivery Challans', icon: FiTruck },
          { id: 'returns', label: 'Returns & Credits', icon: FiRotateCcw }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 pb-4 font-semibold border-b-2 transition-all ${
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <tab.icon />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl overflow-hidden shadow-sm">
        
        {activeTab === 'invoices' && (
          <div className="overflow-x-auto text-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-xs font-bold tracking-wider">
                  <th className="py-4 px-6">Invoice No.</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Type</th>
                  <th className="py-4 px-6">Payment Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-4 px-6 font-semibold font-mono text-slate-900 dark:text-white">{inv.invoice_number}</td>
                    <td className="py-4 px-6">{new Date(inv.invoice_date).toLocaleDateString('en-IN')}</td>
                    <td className="py-4 px-6">{inv.type}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        inv.payment_status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                      }`}>{inv.payment_status}</span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button onClick={() => { setSelectedInvoice({ id: inv.id, type: 'invoice' }); setIsDetailOpen(true); }} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400">
                        <FiEye className="text-lg" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'quotations' && (
          <div className="overflow-x-auto text-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-xs font-bold tracking-wider">
                  <th className="py-4 px-6">Quotation No.</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Total Amount</th>
                  <th className="py-4 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {quotations.map((q) => (
                  <tr key={q.id}>
                    <td className="py-4 px-6 font-mono text-white">{q.quotation_number}</td>
                    <td className="py-4 px-6">{new Date(q.quotation_date).toLocaleDateString('en-IN')}</td>
                    <td className="py-4 px-6"><span className="text-amber-400">{q.status}</span></td>
                    <td className="py-4 px-6 text-right font-bold text-white">{formatINR(q.total_amount)}</td>
                    <td className="py-4 px-6 text-right flex items-center justify-end gap-2">
                      <button onClick={() => { setSelectedInvoice({ id: q.id, type: 'quotation' }); setIsDetailOpen(true); }} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400">
                        <FiEye className="text-lg" />
                      </button>
                      {q.converted_to_invoice_id ? (
                        <span className="text-[11px] text-emerald-400 font-semibold">Converted</span>
                      ) : (
                        <button
                          onClick={() => convertQuotationMutation.mutate({
                            quotationId: q.id,
                            payload: { payment_method: 'Credit', payment_status: 'Unpaid' },
                          })}
                          disabled={convertQuotationMutation.isPending}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-xs font-bold shadow disabled:opacity-50"
                        >
                          Convert
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="overflow-x-auto text-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-xs font-bold tracking-wider">
                  <th className="py-4 px-6">Order No.</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-4 px-6 font-mono text-white">{o.order_number}</td>
                    <td className="py-4 px-6">{new Date(o.order_date).toLocaleDateString('en-IN')}</td>
                    <td className="py-4 px-6"><span className="text-indigo-400">{o.status}</span></td>
                    <td className="py-4 px-6 text-right font-bold text-white">{formatINR(o.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'challans' && (
          <div className="overflow-x-auto text-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-xs font-bold tracking-wider">
                  <th className="py-4 px-6">Challan No.</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Vehicle Number</th>
                  <th className="py-4 px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {challans.map((c) => (
                  <tr key={c.id}>
                    <td className="py-4 px-6 font-mono text-white">{c.challan_number}</td>
                    <td className="py-4 px-6">{new Date(c.challan_date).toLocaleDateString('en-IN')}</td>
                    <td className="py-4 px-6">{c.vehicle_number || 'N/A'}</td>
                    <td className="py-4 px-6 text-emerald-400">{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'returns' && (
          <div className="overflow-x-auto text-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-xs font-bold tracking-wider">
                  <th className="py-4 px-6">Return Number</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Reason</th>
                  <th className="py-4 px-6 text-right">Credit Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {returns.map((r) => (
                  <tr key={r.id}>
                    <td className="py-4 px-6 font-mono text-white">{r.return_number}</td>
                    <td className="py-4 px-6">{new Date(r.return_date).toLocaleDateString('en-IN')}</td>
                    <td className="py-4 px-6">{r.reason || 'N/A'}</td>
                    <td className="py-4 px-6 text-right text-rose-400">{formatINR(r.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* CREATE MODAL */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setIsCreateOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 z-10 space-y-4 shadow-2xl"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white">Create New {activeTab.slice(0, -1)}</h3>
                <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white"><FiX /></button>
              </div>
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Select Customer</label>
                  <select
                    required
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {(activeTab === 'invoices' || activeTab === 'quotations' || activeTab === 'orders') && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Finished Product</label>
                      <select
                        value={productId}
                        onChange={(e) => setProductId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                      >
                        <option value="">-- Choose Finished Ice Cream / Product --</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.current_stock})</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Dispatch Quantity</label>
                        <input
                          type="number"
                          value={qty}
                          onChange={(e) => setQty(e.target.value)}
                          placeholder="Qty"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Unit Selling Price (INR)</label>
                        <input
                          type="number"
                          value={rate}
                          onChange={(e) => setRate(e.target.value)}
                          placeholder="Unit Rate"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                        />
                      </div>
                    </div>
                  </>
                )}

                {!productId && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Total Invoice/Order Amount (INR)</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Total Value"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">
                    {activeTab === 'challans' ? 'Delivery Address / Vehicle No.' : 'Memo / Notes'}
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Details"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
                <button type="submit" className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold rounded-xl shadow-lg text-sm">
                  Generate {activeTab === 'invoices' ? 'Tax Invoice' : activeTab.slice(0, -1)}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAIL INVOICE MODAL */}
      <AnimatePresence>
        {isDetailOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setIsDetailOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl p-6 z-10 space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white">
                  {selectedInvoice?.type === 'quotation' ? 'Quotation' : 'Invoice'} Details — {invoiceDetail?.invoice_number || invoiceDetail?.quotation_number}
                </h3>
                <button onClick={() => setIsDetailOpen(false)} className="text-slate-400 hover:text-white"><FiX /></button>
              </div>
              {isLoadingDetail ? (
                <div className="py-8 text-center text-slate-400">Loading details...</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 text-xs text-slate-400">
                    <div>Date: <span className="text-white font-semibold">{new Date(invoiceDetail?.invoice_date || invoiceDetail?.quotation_date || Date.now()).toLocaleDateString()}</span></div>
                    <div>{selectedInvoice?.type === 'quotation' ? 'Status' : 'Payment Method'}: <span className="text-white font-semibold">{invoiceDetail?.payment_method || invoiceDetail?.status}</span></div>
                    <div>Total: <span className="text-white font-semibold">{formatINR(invoiceDetail?.total_amount)}</span></div>
                  </div>
                  <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-850 text-slate-400 font-bold">
                        <tr>
                          <th className="p-2">Item</th>
                          <th className="p-2 text-right">Qty</th>
                          <th className="p-2 text-right">Rate</th>
                          <th className="p-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceDetail?.items?.map(itm => (
                          <tr key={itm.id} className="border-t border-slate-800 text-slate-300">
                            <td className="p-2">{itm.description || `Product #${itm.product_id}`}</td>
                            <td className="p-2 text-right">{itm.quantity}</td>
                            <td className="p-2 text-right">{formatINR(itm.rate)}</td>
                            <td className="p-2 text-right text-white font-bold">{formatINR(itm.total_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button onClick={handlePrint} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5">
                      <FiPrinter /> Print Receipt
                    </button>
                    <button onClick={() => setIsDetailOpen(false)} className="px-4 py-2 bg-slate-850 text-slate-400 hover:text-white rounded-lg text-xs">Close</button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {printedDocument && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setPrintedDocument(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-slate-50 dark:bg-slate-950 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col md:flex-row overflow-hidden border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full md:w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between space-y-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FiPrinter className="text-indigo-500" />
                    <span>Print Document</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Preview and select your output preferences.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Print Format</label>
                    <select
                      value={printFormat}
                      onChange={(e) => setPrintFormat(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-250 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="Standard">Standard Invoice (A4)</option>
                      <option value="Thermal">Thermal Receipt (80mm)</option>
                      <option value="Sleek">Sleek Corporate (A4)</option>
                      <option value="Custom">Custom Designer Layout (A4)</option>
                    </select>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-150 dark:border-slate-800 space-y-2 text-xs">
                    <p className="flex justify-between"><span className="text-slate-500">Document No:</span> <span className="font-bold text-slate-800 dark:text-white">{printedDocument.data.invoice_number || printedDocument.data.quotation_number}</span></p>
                    <p className="flex justify-between"><span className="text-slate-500">Document Type:</span> <span className="font-semibold text-indigo-500">{printedDocument.type}</span></p>
                    <p className="flex justify-between"><span className="text-slate-500">Net Total:</span> <span className="font-bold text-slate-800 dark:text-white">{formatINR(printedDocument.data.total_amount)}</span></p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-md"
                >
                  <FiPrinter />
                  <span>Print Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintedDocument(null)}
                  className="w-full py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-350 font-semibold rounded-lg text-xs"
                >
                  Close Preview
                </button>
              </div>
            </div>

            <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-y-auto max-h-[75vh] flex justify-center p-4">
              <div id="print-area" className="w-full flex justify-center">
                <style>{`
                  ${printFormat === 'Thermal' ? `
                    @media print {
                      body * { visibility: hidden; }
                      #print-area, #print-area * { visibility: visible; }
                      #print-area {
                        position: absolute; left: 0; top: 0; width: 80mm;
                        margin: 0; padding: 4mm; font-family: monospace; font-size: 11px;
                      }
                    }
                    @page { size: 80mm auto; margin: 0; }
                  ` : printFormat === 'Custom' ? `
                    @media print {
                      body * { visibility: hidden; }
                      #print-area, #print-area * { visibility: visible; }
                      #print-area {
                        position: absolute; left: 0; top: 0; width: 595px; height: 842px;
                        margin: 0; padding: 0; background: white;
                      }
                    }
                    @page { size: A4 portrait; margin: 0; }
                  ` : `
                    @media print {
                      body * { visibility: hidden; }
                      #print-area, #print-area * { visibility: visible; }
                      #print-area {
                        position: absolute; left: 0; top: 0; width: 100%;
                        margin: 0; padding: 10mm; background: white;
                      }
                    }
                    @page { size: A4; margin: 15mm; }
                  `}
                `}</style>
                {renderPrintTemplate(printedDocument, printFormat)}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
