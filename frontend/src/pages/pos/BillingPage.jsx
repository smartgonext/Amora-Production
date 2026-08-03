import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlus, FiPrinter, FiCheck, FiX, FiAlertTriangle, FiUser, FiInfo, FiTag, FiPhoneCall, FiTrendingUp, FiSearch, FiUserPlus, FiMail, FiMapPin, FiHome, FiGlobe, FiLock, FiDollarSign, FiCalendar, FiEdit3, FiFileText, FiList } from 'react-icons/fi';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';
import LineItemsEditor from '../../components/shared/LineItemsEditor';
import { useCompany } from '../../context/CompanyContext';

const EMPTY_SALES_ITEM = {
  type: 'Sales',
  product_id: null,
  product_name: '',
  hsn_code: '',
  qty: 1,
  unit: 'Nos',
  rate: 0,
  discount_percent: 0,
  tax_percent: 18
};

const EMPTY_RENTAL_ITEM = {
  type: 'Rental',
  product_id: null,
  product_name: '',
  hsn_code: '',
  rental_period: 'Daily',
  from_date: new Date().toISOString().split('T')[0],
  to_date: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0], // 5 days from now
  duration: 5,
  qty: 1,
  rate: 0,
  discount_percent: 0,
  tax_percent: 18
};

const EMPTY_AMC_ITEM = {
  type: 'AMC',
  product_id: null,
  product_name: '',
  hsn_code: '',
  contract_period: '1 Year',
  start_date: new Date().toISOString().split('T')[0],
  end_date: new Date(Date.now() + 86400000 * 365).toISOString().split('T')[0], // 1 year from now
  frequency: 'Annual',
  rate: 0, // amount
  discount_percent: 0,
  tax_percent: 18
};

function calculateRentalDuration(fromStr, toStr, period) {
  if (!fromStr || !toStr) return 1;
  const from = new Date(fromStr);
  const to = new Date(toStr);
  const diffTime = to.getTime() - from.getTime();
  if (diffTime < 0) return 0;
  
  // calculate days (include both start and end days or exact diff)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}

function computeItem(item) {
  const qty = parseFloat(item.qty || 1);
  const rate = parseFloat(item.rate || 0);
  let baseAmount = qty * rate;

  if (item.type === 'Rental') {
    const duration = parseFloat(item.duration || 1);
    baseAmount = duration * qty * rate;
  } else if (item.type === 'AMC') {
    baseAmount = rate;
  }

  const discPct = parseFloat(item.discount_percent || 0);
  const discountAmount = (baseAmount * discPct) / 100;
  
  const taxableAmount = baseAmount - discountAmount;
  const taxPct = parseFloat(item.tax_percent || 18);
  const taxAmount = (taxableAmount * taxPct) / 100;
  
  return {
    ...item,
    amount: baseAmount,
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    line_total: taxableAmount + taxAmount
  };
}

function encodeDescription(item) {
  if (item.type === 'Rental') {
    return `${item.product_name} [RENTAL:${item.rental_period || ''};${item.from_date || ''};${item.to_date || ''};${item.duration || 1}]`;
  }
  if (item.type === 'AMC') {
    return `${item.product_name} [AMC:${item.contract_period || ''};${item.start_date || ''};${item.end_date || ''};${item.frequency || ''}]`;
  }
  return `${item.product_name} [SALES]`;
}

function decodeDescription(desc, type) {
  if (!desc) return { name: '', type: type || 'Sales' };
  
  const rentalMatch = desc.match(/(.*)\s+\[RENTAL:(.*?);(.*?);(.*?);(.*?)\]/);
  if (rentalMatch) {
    return {
      name: rentalMatch[1].trim(),
      type: 'Rental',
      rental_period: rentalMatch[2],
      from_date: rentalMatch[3],
      to_date: rentalMatch[4],
      duration: parseFloat(rentalMatch[5]) || 1
    };
  }

  const amcMatch = desc.match(/(.*)\s+\[AMC:(.*?);(.*?);(.*?);(.*?)\]/);
  if (amcMatch) {
    return {
      name: amcMatch[1].trim(),
      type: 'AMC',
      contract_period: amcMatch[2],
      start_date: amcMatch[3],
      end_date: amcMatch[4],
      frequency: amcMatch[5]
    };
  }

  const salesMatch = desc.match(/(.*)\s+\[SALES\]/);
  if (salesMatch) {
    return {
      name: salesMatch[1].trim(),
      type: 'Sales'
    };
  }

  return {
    name: desc.trim(),
    type: type || 'Sales'
  };
}

export default function BillingPage() {
  const queryClient = useQueryClient();
  const { company, getSelectedBranch } = useCompany();
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [invoiceType, setInvoiceType] = useState('Sales');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([computeItem({ ...EMPTY_SALES_ITEM })]);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showQuotationListModal, setShowQuotationListModal] = useState(false);
  const [printedDocument, setPrintedDocument] = useState(null);
  const [quotationSearch, setQuotationSearch] = useState('');

  // New Customer Form State
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gstin: '',
    pan: '',
    credit_limit: 0,
    credit_period_days: 0,
    notes: ''
  });

  // Fetch Customers
  const { data: customersResponse } = useQuery({
    queryKey: ['customers-mini'],
    queryFn: async () => {
      const response = await apiClient.get('/customers');
      return response.data;
    }
  });
  const customers = customersResponse?.data || [];

  // Fetch Products (for Sales)
  const { data: productsResponse } = useQuery({
    queryKey: ['products-mini'],
    queryFn: async () => {
      const response = await apiClient.get('/products');
      return response.data;
    }
  });
  const products = productsResponse?.data || [];

  // Fetch Equipment (for Rental)
  const { data: equipmentResponse } = useQuery({
    queryKey: ['equipment-available-all'],
    queryFn: async () => {
      const response = await apiClient.get('/equipment');
      return response.data;
    }
  });
  const equipmentList = equipmentResponse?.data || [];

  // Fetch Equipment AMC (for AMC)
  const { data: amcResponse } = useQuery({
    queryKey: ['amc-contracts'],
    queryFn: async () => {
      const response = await apiClient.get('/equipment/amc');
      return response.data;
    }
  });
  const amcList = amcResponse?.data || [];

  // Items source based on invoice type - only shows relevant items in search
  const getItemsSource = () => {
    switch (invoiceType) {
      case 'Sales':
        return products.map(p => ({ ...p, _type: 'product', _typeLabel: p.is_service ? 'Service' : 'Product' }));
      case 'Rental':
        return equipmentList.map(e => ({ 
          ...e, 
          _type: 'equipment', 
          _typeLabel: 'Equipment', 
          name: e.name, 
          selling_price: e.min_daily_rate,
          hourly_rate: e.min_hourly_rate,
          daily_rate: e.min_daily_rate,
          unit: 'Day'
        }));
      case 'AMC':
        return amcList.map(a => ({ 
          ...a, 
          _type: 'amc', 
          _typeLabel: 'AMC', 
          name: a.contract_title || a.machine_name || 'AMC Contract', 
          selling_price: a.amc_value, 
          unit: 'Fixed',
          hsn_code: a.machine_serial || ''
        }));
      default:
        return [];
    }
  };
  const itemsSource = getItemsSource();

  // Filter customers based on search (by name, phone, or email)
  const filteredCustomers = customers.filter(c => {
    if (!customerSearch) return true;
    const search = customerSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(search) ||
      (c.phone && c.phone.includes(search)) ||
      (c.email && c.email.toLowerCase().includes(search))
    );
  });

  const selectedCustomer = customers.find(c => c.id.toString() === selectedCustomerId);

  // Create Invoice Mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/invoices', payload);
      return response.data;
    },
    onSuccess: async (res) => {
      toast.success(`Invoice generated! Ref: ${res.data?.invoice_number}`);
      try {
        const fullResponse = await apiClient.get(`/invoices/${res.data.id}`);
        setPrintedDocument({
          type: 'Invoice',
          data: fullResponse.data.data
        });
      } catch (err) {
        console.error("Failed to fetch full invoice details for printing", err);
      }
      resetBillingForm();
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-available-all'] });
      queryClient.invalidateQueries({ queryKey: ['amc-contracts'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to generate invoice');
    }
  });

  // Create Quotation Mutation
  const createQuotationMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/sales/quotations', payload);
      return response.data;
    },
    onSuccess: async (res) => {
      toast.success(`Quotation generated! Ref: ${res.data?.quotation_number}`);
      try {
        const fullResponse = await apiClient.get(`/sales/quotations/${res.data.id}`);
        setPrintedDocument({
          type: 'Quotation',
          data: fullResponse.data.data
        });
      } catch (err) {
        console.error("Failed to fetch full quotation details for printing", err);
      }
      resetBillingForm();
      queryClient.invalidateQueries({ queryKey: ['quotations-list'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to generate quotation');
    }
  });

  // Fetch Quotations list
  const { data: quotationsResponse, refetch: refetchQuotations } = useQuery({
    queryKey: ['quotations-list'],
    queryFn: async () => {
      const response = await apiClient.get('/sales/quotations');
      return response.data;
    },
    enabled: true
  });
  const quotations = quotationsResponse?.data || [];

  // Create Customer Mutation
  const createCustomerMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/customers', payload);
      return response.data;
    },
    onSuccess: (res) => {
      toast.success(`Customer "${res.data.name}" created successfully!`);
      setShowAddCustomerModal(false);
      setSelectedCustomerId(res.data.id.toString());
      setCustomerSearch(`${res.data.name} (${res.data.phone})`);
      setNewCustomer({
        name: '', phone: '', email: '', address: '', city: '', state: '',
        pincode: '', gstin: '', pan: '', credit_limit: 0, credit_period_days: 0, notes: ''
      });
      queryClient.invalidateQueries({ queryKey: ['customers-mini'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to create customer');
    }
  });

  const handleGenerateInvoice = (e) => {
    if (e) e.preventDefault();
    
    if (!selectedCustomerId) {
      toast.error('Please select a customer.');
      return;
    }
    if (items.length === 0 || items.every(itm => !itm.product_name)) {
      toast.error('Please add at least one line item.');
      return;
    }

    const payload = {
      customer_id: parseInt(selectedCustomerId),
      type: invoiceType,
      payment_method: paymentMethod,
      payment_status: paymentMethod === 'Credit' ? 'Unpaid' : 'Paid',
      notes,
      is_pos: true,
      items: items.filter(itm => itm.product_name).map(itm => ({
        product_id: itm.product_id,
        product_name: encodeDescription(itm),
        hsn_code: itm.hsn_code,
        qty: itm.qty,
        rate: itm.rate,
        discount_percent: itm.discount_percent,
        tax_percent: itm.tax_percent
      }))
    };

    createInvoiceMutation.mutate(payload);
  };

  const handleGenerateQuotation = (e) => {
    if (e) e.preventDefault();
    
    if (!selectedCustomerId) {
      toast.error('Please select a customer.');
      return;
    }
    if (items.length === 0 || items.every(itm => !itm.product_name)) {
      toast.error('Please add at least one line item.');
      return;
    }

    const payload = {
      customer_id: parseInt(selectedCustomerId),
      notes,
      items: items.filter(itm => itm.product_name).map(itm => ({
        product_id: itm.product_id,
        product_name: encodeDescription(itm),
        hsn_code: itm.hsn_code,
        qty: itm.qty,
        rate: itm.rate,
        discount_percent: itm.discount_percent,
        tax_percent: itm.tax_percent
      }))
    };

    createQuotationMutation.mutate(payload);
  };

  const loadQuotationToPOS = async (quotationId) => {
    try {
      const response = await apiClient.get(`/sales/quotations/${quotationId}`);
      const quote = response.data.data;
      if (!quote) {
        toast.error('Quotation not found.');
        return;
      }
      
      setSelectedCustomerId(quote.customer_id.toString());
      const cust = customers.find(c => c.id === quote.customer_id);
      if (cust) {
        setCustomerSearch(`${cust.name} (${cust.phone})`);
      } else {
        setCustomerSearch(`Customer ID: ${quote.customer_id}`);
      }
      
      const mappedItems = (quote.items || []).map(itm => {
        const decoded = decodeDescription(itm.description);
        
        let baseItem = {
          type: decoded.type,
          product_id: itm.product_id,
          product_name: decoded.name,
          hsn_code: itm.hsn_code || '',
          qty: itm.quantity,
          unit: itm.unit || 'Nos',
          rate: parseFloat(itm.rate),
          discount_percent: parseFloat(itm.discount_percent || 0),
          tax_percent: parseFloat(itm.gst_rate || 18)
        };

        if (decoded.type === 'Rental') {
          baseItem.rental_period = decoded.rental_period || 'Daily';
          baseItem.from_date = decoded.from_date;
          baseItem.to_date = decoded.to_date;
          baseItem.duration = decoded.duration || 1;
        } else if (decoded.type === 'AMC') {
          baseItem.contract_period = decoded.contract_period || '1 Year';
          baseItem.start_date = decoded.start_date;
          baseItem.end_date = decoded.end_date;
          baseItem.frequency = decoded.frequency || 'Annual';
        }

        return computeItem(baseItem);
      });
      
      setItems(mappedItems.length > 0 ? mappedItems : [computeItem({ ...EMPTY_SALES_ITEM })]);
      setNotes(quote.notes || '');
      setShowQuotationListModal(false);
      toast.success(`Quotation ${quote.quotation_number} loaded into form!`);
    } catch (err) {
      toast.error('Failed to load quotation details');
      console.error(err);
    }
  };

  const resetBillingForm = () => {
    setSelectedCustomerId('');
    setCustomerSearch('');
    setInvoiceType('Sales');
    setPaymentMethod('Cash');
    setNotes('');
    setItems([computeItem({ ...EMPTY_SALES_ITEM })]);
  };

  // Keyboard shortcut listeners (F7 to focus product search list, F8 to submit/checkout)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F7') {
        e.preventDefault();
        const el = document.querySelector('input[placeholder*="Search"]');
        if (el) {
          el.focus();
          toast.success('Focused Item Search (F7)');
        }
      }
      if (e.key === 'F8') {
        e.preventDefault();
        handleGenerateInvoice();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleGenerateInvoice]);

  const handleQuickAdd = (item) => {
    const type = item._type === 'product' ? 'Sales' : item._type === 'equipment' ? 'Rental' : 'AMC';
    
    // Check if there is an empty row of this type and replace it
    const emptyIdx = items.findIndex(itm => itm.type === type && !itm.product_name);
    
    let baseItem = {
      type: type,
      product_id: item.id,
      product_name: item.name || item.contract_title || item.machine_name || 'Item',
      hsn_code: item.hsn_code || '',
      qty: 1,
      unit: item._type === 'equipment' ? 'Day' : item._type === 'amc' ? 'Fixed' : (item.unit || 'Nos'),
      rate: item.selling_price || item.daily_rate || 0,
      discount_percent: 0,
      tax_percent: item.gst_rate || 18
    };

    if (type === 'Rental') {
      baseItem.rental_period = 'Daily';
      baseItem.from_date = new Date().toISOString().split('T')[0];
      baseItem.to_date = new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0];
      baseItem.duration = 5;
    } else if (type === 'AMC') {
      baseItem.contract_period = '1 Year';
      baseItem.start_date = new Date().toISOString().split('T')[0];
      baseItem.end_date = new Date(Date.now() + 86400000 * 365).toISOString().split('T')[0];
      baseItem.frequency = 'Annual';
    }

    const computed = computeItem(baseItem);

    if (emptyIdx > -1) {
      setItems(items.map((itm, i) => i === emptyIdx ? computed : itm));
    } else {
      setItems([...items, computed]);
    }
    toast.success(`${baseItem.product_name} added to draft!`);
  };

  const handleTriggerDemo = () => {
    if (customers.length > 0) {
      setSelectedCustomerId(customers[0].id.toString());
      setCustomerSearch(`${customers[0].name} (${customers[0].phone})`);
    }
    
    const demoItems = [
      computeItem({
        type: 'Sales',
        product_id: products[0]?.id || 1,
        product_name: products[0]?.name || 'Hydraulic Pump',
        hsn_code: products[0]?.hsn_code || '8413',
        qty: 2,
        unit: products[0]?.unit || 'Nos',
        rate: products[0]?.selling_price || 12500,
        discount_percent: 5,
        tax_percent: 18
      }),
      computeItem({
        type: 'Rental',
        product_id: equipmentList[0]?.id || 2,
        product_name: equipmentList[0]?.name || 'Forklift 3 Ton',
        hsn_code: equipmentList[0]?.registration_number || '8429',
        rental_period: 'Daily',
        from_date: '2025-05-22',
        to_date: '2025-05-26',
        duration: 5,
        qty: 1,
        rate: equipmentList[0]?.min_daily_rate || 5000,
        discount_percent: 0,
        tax_percent: 18
      }),
      computeItem({
        type: 'AMC',
        product_id: amcList[0]?.id || 3,
        product_name: amcList[0]?.contract_title || amcList[0]?.machine_name || 'Hydraulic System AMC',
        hsn_code: amcList[0]?.machine_serial || '8430',
        contract_period: '1 Year',
        start_date: '2025-05-22',
        end_date: '2026-05-21',
        frequency: 'Annual',
        rate: amcList[0]?.amc_value || 15000,
        discount_percent: 10,
        tax_percent: 18
      })
    ];

    setItems(demoItems);
    setInvoiceType('Sales');
    toast.success('Simulated multi-type transaction draft loaded!');
  };

  const handleSelectCustomer = (customer) => {
    setSelectedCustomerId(customer.id.toString());
    setCustomerSearch(`${customer.name} (${customer.phone})`);
    setShowCustomerDropdown(false);
  };

  const handleInvoiceTypeChange = (newType) => {
    setInvoiceType(newType);
    
    // Check if the current items are empty/unselected
    const isEmpty = items.length === 0 || items.every(itm => !itm.product_name);
    
    if (isEmpty) {
      if (newType === 'Sales') {
        setItems([computeItem({ ...EMPTY_SALES_ITEM })]);
      } else if (newType === 'Rental') {
        setItems([computeItem({ ...EMPTY_RENTAL_ITEM })]);
      } else if (newType === 'AMC') {
        setItems([computeItem({ ...EMPTY_AMC_ITEM })]);
      }
    } else {
      const hasType = items.some(itm => itm.type === newType);
      if (!hasType) {
        let newEmpty;
        if (newType === 'Sales') newEmpty = { ...EMPTY_SALES_ITEM };
        else if (newType === 'Rental') newEmpty = { ...EMPTY_RENTAL_ITEM };
        else if (newType === 'AMC') newEmpty = { ...EMPTY_AMC_ITEM };
        
        setItems([...items, computeItem(newEmpty)]);
      }
    }
  };

  const handleUpdateItem = (idx, key, val) => {
    const next = items.map((itm, i) => {
      if (i !== idx) return itm;
      
      let updated = { ...itm, [key]: val };
      
      if (itm.type === 'Rental' && (key === 'from_date' || key === 'to_date')) {
        const from = key === 'from_date' ? val : itm.from_date;
        const to = key === 'to_date' ? val : itm.to_date;
        updated.duration = calculateRentalDuration(from, to, itm.rental_period);
      }
      
      return computeItem(updated);
    });
    setItems(next);
  };

  const handleRemoveItem = (idx) => {
    const next = items.filter((_, i) => i !== idx);
    if (next.length === 0) {
      let emptyRow;
      if (invoiceType === 'Sales') emptyRow = { ...EMPTY_SALES_ITEM };
      else if (invoiceType === 'Rental') emptyRow = { ...EMPTY_RENTAL_ITEM };
      else if (invoiceType === 'AMC') emptyRow = { ...EMPTY_AMC_ITEM };
      setItems([computeItem(emptyRow)]);
    } else {
      setItems(next);
    }
  };

  const handlePickItem = (idx, selectedObj) => {
    const next = items.map((itm, i) => {
      if (i !== idx) return itm;
      
      if (itm.type === 'Sales') {
        return computeItem({
          ...itm,
          product_id: selectedObj.id,
          product_name: selectedObj.name,
          hsn_code: selectedObj.hsn_code || '',
          rate: parseFloat(selectedObj.selling_price || 0),
          unit: selectedObj.unit || 'Nos',
          tax_percent: parseFloat(selectedObj.gst_rate || 18)
        });
      } else if (itm.type === 'Rental') {
        const rateVal = parseFloat(selectedObj.min_daily_rate || selectedObj.daily_rate || selectedObj.selling_price || 0);
        return computeItem({
          ...itm,
          product_id: selectedObj.id,
          product_name: selectedObj.name,
          hsn_code: selectedObj.registration_number || selectedObj.serial_number || '',
          rate: rateVal,
          rental_period: 'Daily',
          tax_percent: 18
        });
      } else {
        const name = selectedObj.contract_title || selectedObj.machine_name || 'AMC Contract';
        return computeItem({
          ...itm,
          product_id: selectedObj.id,
          product_name: name,
          hsn_code: selectedObj.machine_serial || selectedObj.id?.toString() || '',
          rate: parseFloat(selectedObj.amc_value || selectedObj.selling_price || 0),
          frequency: 'Annual',
          tax_percent: 18
        });
      }
    });
    setItems(next);
  };

  const handleAddItem = (type) => {
    let emptyRow;
    if (type === 'Sales') emptyRow = { ...EMPTY_SALES_ITEM };
    else if (type === 'Rental') emptyRow = { ...EMPTY_RENTAL_ITEM };
    else if (type === 'AMC') emptyRow = { ...EMPTY_AMC_ITEM };
    
    setItems([...items, computeItem(emptyRow)]);
  };

  const handleDescriptionChange = (idx, type, val) => {
    handleUpdateItem(idx, 'product_name', val);

    let matched = null;
    if (type === 'Sales') {
      matched = products.find(p => p.name.toLowerCase() === val.toLowerCase());
    } else if (type === 'Rental') {
      matched = equipmentList.find(e => e.name.toLowerCase() === val.toLowerCase());
    } else if (type === 'AMC') {
      matched = amcList.find(a => (a.contract_title || a.machine_name || '').toLowerCase() === val.toLowerCase());
    }

    if (matched) {
      handlePickItem(idx, matched);
    }
  };

  const handleAddCustomer = (e) => {
    e.preventDefault();
    if (!newCustomer.name || !newCustomer.phone) {
      toast.error('Name and Phone are required.');
      return;
    }
    createCustomerMutation.mutate(newCustomer);
  };

  // Section label based on invoice type
  const getTypeLabel = () => {
    switch (invoiceType) {
      case 'Sales': return { icon: '📦', label: 'Products', searchPlaceholder: 'Search product by name...' };
      case 'Rental': return { icon: '🚜', label: 'Equipment', searchPlaceholder: 'Search equipment by name...' };
      case 'AMC': return { icon: '🔧', label: 'AMC Contracts', searchPlaceholder: 'Search AMC by title or machine...' };
      default: return { icon: '📦', label: 'Items', searchPlaceholder: 'Search item...' };
    }
  };
  const typeInfo = getTypeLabel();

  const salesItems = items.filter(itm => itm.type === 'Sales' && itm.product_name);
  const rentalItems = items.filter(itm => itm.type === 'Rental' && itm.product_name);
  const amcItems = items.filter(itm => itm.type === 'AMC' && itm.product_name);

  const salesSubtotal = salesItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const rentalSubtotal = rentalItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const amcSubtotal = amcItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  const totalDiscount = items.reduce((s, i) => s + (parseFloat(i.discount_amount) || 0), 0);
  const totalTaxable = items.reduce((s, i) => s + ((parseFloat(i.amount) || 0) - (parseFloat(i.discount_amount) || 0)), 0);
  const totalGst = items.reduce((s, i) => s + (parseFloat(i.tax_amount) || 0), 0);
  const netPayable = items.reduce((s, i) => s + (parseFloat(i.line_total) || 0), 0);

  const companyState = company?.state || '';
  const customerState = selectedCustomer?.state || '';
  const isInterState = companyState && customerState && companyState.trim().toLowerCase() !== customerState.trim().toLowerCase();

  const cgst = isInterState ? 0 : totalGst / 2;
  const sgst = isInterState ? 0 : totalGst / 2;
  const igst = isInterState ? totalGst : 0;

  const getSelectedPrintFormat = () => {
    if (!printedDocument) return 'Standard';
    const groupSettings = company?.settings?.templates || {};
    if (printedDocument.type === 'Invoice') {
      return groupSettings.invoice_format || 'Standard';
    } else {
      return groupSettings.quotation_format || 'Standard';
    }
  };
  const printFormat = getSelectedPrintFormat();

  const renderPrintTemplate = (doc, format) => {
    const { type, data } = doc;
    const customer = customers.find(c => c.id === data.customer_id) || {};
    const itemsList = data.items || [];
    
    const subtotal = parseFloat(data.subtotal || 0);
    const discount = parseFloat(data.discount_amount || 0);
    const cgst = parseFloat(data.cgst_amount || 0);
    const sgst = parseFloat(data.sgst_amount || 0);
    const total = parseFloat(data.total_amount || 0);
    
    const formattedDate = new Date(data.invoice_date || data.quotation_date || Date.now()).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const activeBranch = getSelectedBranch();

    const decodedItems = itemsList.map(itm => {
      const decoded = decodeDescription(itm.description || '');
      return {
        ...itm,
        decodedType: decoded.type,
        decodedName: decoded.name || itm.description,
        rental_period: decoded.rental_period,
        from_date: decoded.from_date,
        to_date: decoded.to_date,
        duration: decoded.duration,
        contract_period: decoded.contract_period,
        start_date: decoded.start_date,
        end_date: decoded.end_date,
        frequency: decoded.frequency
      };
    });

    const printSalesItems = decodedItems.filter(itm => itm.decodedType === 'Sales');
    const printRentalItems = decodedItems.filter(itm => itm.decodedType === 'Rental');
    const printAmcItems = decodedItems.filter(itm => itm.decodedType === 'AMC');

    if (format === 'Thermal') {
      return (
        <div className="w-[80mm] p-2 bg-white text-black font-mono text-[11px] leading-tight select-none">
          <div className="text-center space-y-1 mb-3">
            {company?.logo_url && (
              <img src={company.logo_url} alt="Logo" className="w-12 h-12 mx-auto object-contain mb-1" />
            )}
            <h2 className="text-sm font-bold uppercase">{company?.name || 'SmartGoNext POS'}</h2>
            {activeBranch ? (
              <p className="text-[10px]">{activeBranch.name}<br />{activeBranch.address}<br />Phone: {activeBranch.phone}</p>
            ) : (
              <p className="text-[10px]">{company?.address}</p>
            )}
            {company?.gstin && <p className="text-[10px]">GSTIN: {company.gstin}</p>}
          </div>

          <div className="border-t border-dashed border-black py-1.5 space-y-0.5 text-[10px]">
            <p className="flex justify-between"><strong>{type.toUpperCase()}:</strong> <span>{data.invoice_number || data.quotation_number}</span></p>
            <p className="flex justify-between"><strong>DATE:</strong> <span>{formattedDate}</span></p>
            <p className="flex justify-between"><strong>CUST:</strong> <span>{customer.name || 'Walk-In Customer'}</span></p>
            {customer.phone && <p className="flex justify-between"><strong>PHONE:</strong> <span>{customer.phone}</span></p>}
            {customer.gstin && <p className="flex justify-between"><strong>CUST GSTIN:</strong> <span>{customer.gstin}</span></p>}
          </div>

          {printSalesItems.length > 0 && (
            <div className="border-t border-dashed border-black py-1">
              <div className="font-bold text-[10px] uppercase mb-1">📦 Sales Items</div>
              <div className="grid grid-cols-12 font-bold mb-1 border-b border-dashed border-black pb-0.5">
                <span className="col-span-6">ITEM</span>
                <span className="col-span-2 text-right">QTY</span>
                <span className="col-span-2 text-right">RATE</span>
                <span className="col-span-2 text-right">TOTAL</span>
              </div>
              <div className="space-y-1">
                {printSalesItems.map((itm, idx) => (
                  <div key={idx} className="grid grid-cols-12">
                    <span className="col-span-6 truncate">{itm.decodedName}</span>
                    <span className="col-span-2 text-right">{itm.quantity}</span>
                    <span className="col-span-2 text-right">₹{parseFloat(itm.rate).toFixed(0)}</span>
                    <span className="col-span-2 text-right">₹{parseFloat(itm.total_amount).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {printRentalItems.length > 0 && (
            <div className="border-t border-dashed border-black py-1">
              <div className="font-bold text-[10px] uppercase mb-1">🚜 Rental Items</div>
              <div className="grid grid-cols-12 font-bold mb-1 border-b border-dashed border-black pb-0.5">
                <span className="col-span-6">ITEM</span>
                <span className="col-span-2 text-right">QTY</span>
                <span className="col-span-2 text-right">RATE</span>
                <span className="col-span-2 text-right">TOTAL</span>
              </div>
              <div className="space-y-1">
                {printRentalItems.map((itm, idx) => (
                  <div key={idx} className="grid grid-cols-12">
                    <span className="col-span-6 truncate">{itm.decodedName} ({itm.duration}d)</span>
                    <span className="col-span-2 text-right">{itm.quantity}</span>
                    <span className="col-span-2 text-right">₹{parseFloat(itm.rate).toFixed(0)}</span>
                    <span className="col-span-2 text-right">₹{parseFloat(itm.total_amount).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {printAmcItems.length > 0 && (
            <div className="border-t border-dashed border-black py-1">
              <div className="font-bold text-[10px] uppercase mb-1">🔧 AMC Services</div>
              <div className="grid grid-cols-12 font-bold mb-1 border-b border-dashed border-black pb-0.5">
                <span className="col-span-6">SERVICE</span>
                <span className="col-span-2 text-right">FREQ</span>
                <span className="col-span-2 text-right">RATE</span>
                <span className="col-span-2 text-right">TOTAL</span>
              </div>
              <div className="space-y-1">
                {printAmcItems.map((itm, idx) => (
                  <div key={idx} className="grid grid-cols-12">
                    <span className="col-span-6 truncate">{itm.decodedName}</span>
                    <span className="col-span-2 text-right">{itm.frequency === 'Annual' ? 'Ann' : itm.frequency === 'Monthly' ? 'Mth' : 'Qtr'}</span>
                    <span className="col-span-2 text-right">₹{parseFloat(itm.rate).toFixed(0)}</span>
                    <span className="col-span-2 text-right">₹{parseFloat(itm.total_amount).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-dashed border-black pt-1.5 space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-red-650">
                <span>Discount:</span>
                <span>-₹{discount.toFixed(2)}</span>
              </div>
            )}
            {cgst > 0 && (
              <div className="flex justify-between">
                <span>CGST:</span>
                <span>₹{cgst.toFixed(2)}</span>
              </div>
            )}
            {sgst > 0 && (
              <div className="flex justify-between">
                <span>SGST:</span>
                <span>₹{sgst.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-xs pt-1 border-t border-dashed border-black">
              <span>NET AMOUNT:</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
          </div>

          {data.payment_method && (
            <div className="mt-2 text-center text-[10px] border-t border-dashed border-black pt-1">
              <p>PAYMENT VIA: {data.payment_method.toUpperCase()}</p>
            </div>
          )}

          <div className="text-center mt-6 text-[10px] space-y-0.5">
            <p className="font-bold">THANK YOU FOR YOUR VISIT!</p>
            <p className="text-[9px]">Powered by SmartGoNext ERP</p>
          </div>
        </div>
      );
    }

    if (format === 'Sleek') {
      return (
        <div className="w-full bg-white text-slate-800 p-8 font-sans select-none rounded-xl">
          <div className="flex justify-between items-start border-b-4 border-indigo-600 pb-6 mb-6">
            <div>
              {company?.logo_url ? (
                <img src={company.logo_url} alt="Logo" className="w-16 h-16 object-contain mb-2" />
              ) : (
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-black text-xl mb-2">S</div>
              )}
              <h2 className="text-xl font-bold text-slate-900">{company?.name || 'SmartGoNext POS'}</h2>
              {activeBranch ? (
                <p className="text-xs text-slate-500 mt-1">{activeBranch.name} • {activeBranch.address} • Phone: {activeBranch.phone}</p>
              ) : (
                <p className="text-xs text-slate-500 mt-1">{company?.address}</p>
              )}
              {company?.gstin && <p className="text-xs text-slate-500">GSTIN: {company.gstin}</p>}
            </div>
            <div className="text-right">
              <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full uppercase tracking-wider">
                {type}
              </span>
              <h1 className="text-lg font-black text-indigo-900 mt-2">{data.invoice_number || data.quotation_number}</h1>
              <p className="text-xs text-slate-500 mt-1">Date: {formattedDate}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider">Billed To</h3>
              <p className="font-bold text-slate-800 text-base">{customer.name || 'Walk-In Customer'}</p>
              {customer.phone && <p className="text-slate-500 mt-0.5">Phone: {customer.phone}</p>}
              {customer.address && <p className="text-slate-500 mt-0.5">{customer.address}, {customer.city}</p>}
              {customer.gstin && <p className="text-slate-500 mt-1">GSTIN: {customer.gstin}</p>}
            </div>
            <div className="text-right">
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider">Reference Details</h3>
              <p className="text-slate-600">Payment: <strong className="text-slate-800">{data.payment_method || 'N/A'}</strong></p>
              <p className="text-slate-600 mt-0.5">Status: <strong className="text-slate-800">{data.payment_status || 'Paid'}</strong></p>
            </div>
          </div>

          {printSalesItems.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-bold text-emerald-600 uppercase mb-2 tracking-wider flex items-center gap-1.5">
                <span>📦</span> Sales Items
              </h3>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase border-b border-slate-150">
                    <th className="py-2.5 px-4 w-[45%]">Item & Description</th>
                    <th className="py-2.5 px-4 text-center w-[10%]">Qty</th>
                    <th className="py-2.5 px-4 text-right w-[15%]">Rate</th>
                    <th className="py-2.5 px-4 text-right w-[10%]">Discount</th>
                    <th className="py-2.5 px-4 text-right w-[10%]">GST %</th>
                    <th className="py-2.5 px-4 text-right w-[10%]">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {printSalesItems.map((itm, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-medium text-slate-800">{itm.decodedName}</td>
                      <td className="py-2.5 px-4 text-center">{itm.quantity}</td>
                      <td className="py-2.5 px-4 text-right">₹{parseFloat(itm.rate).toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right text-red-650">{itm.discount_percent}%</td>
                      <td className="py-2.5 px-4 text-right">{itm.gst_rate}%</td>
                      <td className="py-2.5 px-4 text-right font-semibold">₹{parseFloat(itm.total_amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {printRentalItems.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-bold text-blue-600 uppercase mb-2 tracking-wider flex items-center gap-1.5">
                <span>🚜</span> Rental Items
              </h3>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase border-b border-slate-150">
                    <th className="py-2.5 px-4 w-[35%]">Equipment</th>
                    <th className="py-2.5 px-4 w-[15%]">Period</th>
                    <th className="py-2.5 px-4 text-center w-[8%]">Days</th>
                    <th className="py-2.5 px-4 text-center w-[8%]">Qty</th>
                    <th className="py-2.5 px-4 text-right w-[12%]">Rate</th>
                    <th className="py-2.5 px-4 text-right w-[10%]">GST %</th>
                    <th className="py-2.5 px-4 text-right w-[12%]">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {printRentalItems.map((itm, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-medium text-slate-800">
                        {itm.decodedName}
                        <div className="text-[10px] text-slate-400">({itm.from_date} to {itm.to_date})</div>
                      </td>
                      <td className="py-2.5 px-4">{itm.rental_period}</td>
                      <td className="py-2.5 px-4 text-center">{itm.duration}</td>
                      <td className="py-2.5 px-4 text-center">{itm.quantity}</td>
                      <td className="py-2.5 px-4 text-right">₹{parseFloat(itm.rate).toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right">{itm.gst_rate}%</td>
                      <td className="py-2.5 px-4 text-right font-semibold">₹{parseFloat(itm.total_amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {printAmcItems.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-bold text-purple-600 uppercase mb-2 tracking-wider flex items-center gap-1.5">
                <span>🔧</span> AMC Services
              </h3>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase border-b border-slate-150">
                    <th className="py-2.5 px-4 w-[35%]">Service Title</th>
                    <th className="py-2.5 px-4 w-[15%]">Contract Period</th>
                    <th className="py-2.5 px-4 w-[15%]">Frequency</th>
                    <th className="py-2.5 px-4 text-right w-[12%]">Amount</th>
                    <th className="py-2.5 px-4 text-right w-[10%]">GST %</th>
                    <th className="py-2.5 px-4 text-right w-[13%]">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {printAmcItems.map((itm, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-medium text-slate-800">
                        {itm.decodedName}
                        <div className="text-[10px] text-slate-400">({itm.start_date} to {itm.end_date})</div>
                      </td>
                      <td className="py-2.5 px-4">{itm.contract_period}</td>
                      <td className="py-2.5 px-4">{itm.frequency}</td>
                      <td className="py-2.5 px-4 text-right">₹{parseFloat(itm.rate).toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right">{itm.gst_rate}%</td>
                      <td className="py-2.5 px-4 text-right font-semibold">₹{parseFloat(itm.total_amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <div className="w-80 space-y-2 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-red-650">
                  <span>Discount</span>
                  <span>-₹{discount.toFixed(2)}</span>
                </div>
              )}
              {cgst > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>CGST</span>
                  <span>₹{cgst.toFixed(2)}</span>
                </div>
              )}
              {sgst > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>SGST</span>
                  <span>₹{sgst.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base text-slate-900 border-t border-slate-150 pt-2">
                <span>Net Total</span>
                <span className="text-indigo-650">₹{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center text-xs text-slate-400 border-t border-slate-100 pt-6">
            <p>Thank you for doing business with us!</p>
            <p className="mt-1 text-[10px]">Powered by SmartGoNext ERP</p>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full bg-white text-slate-800 p-8 font-sans select-none rounded-xl">
        <div className="flex justify-between items-start mb-8">
          <div>
            {company?.logo_url && (
              <img src={company.logo_url} alt="Logo" className="w-16 h-16 object-contain mb-3" />
            )}
            <h2 className="text-xl font-bold text-slate-900">{company?.name || 'SmartGoNext POS'}</h2>
            {activeBranch ? (
              <p className="text-xs text-slate-500 mt-1">{activeBranch.name}<br />{activeBranch.address}<br />Phone: {activeBranch.phone}</p>
            ) : (
              <p className="text-xs text-slate-500 mt-1">{company?.address}</p>
            )}
            {company?.gstin && <p className="text-xs text-slate-500 mt-1">GSTIN: {company.gstin}</p>}
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-black text-slate-900">{type.toUpperCase()}</h1>
            <p className="text-sm font-semibold text-slate-600 mt-1">Number: {data.invoice_number || data.quotation_number}</p>
            <p className="text-xs text-slate-500 mt-1">Date: {formattedDate}</p>
          </div>
        </div>

        <div className="border-t border-b border-slate-200 py-4 mb-8 grid grid-cols-2 gap-4 text-xs">
          <div>
            <h3 className="font-bold text-slate-400 uppercase mb-1">Customer Info</h3>
            <p className="font-bold text-slate-800 text-sm">{customer.name || 'Walk-In Customer'}</p>
            {customer.phone && <p className="text-slate-600 mt-0.5">Phone: {customer.phone}</p>}
            {customer.address && <p className="text-slate-600 mt-0.5">{customer.address}</p>}
            {customer.gstin && <p className="text-slate-650 mt-1 font-semibold">GSTIN: {customer.gstin}</p>}
          </div>
          <div className="text-right">
            <h3 className="font-bold text-slate-400 uppercase mb-1">Billing Summary</h3>
            <p className="text-slate-600">Payment: {data.payment_method || 'N/A'}</p>
            <p className="text-slate-600 mt-0.5">Status: {data.payment_status || 'Paid'}</p>
          </div>
        </div>

        {printSalesItems.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs font-bold text-slate-450 uppercase mb-2 tracking-wider flex items-center gap-1.5">
              <span>📦</span> Sales Items
            </h3>
            <table className="w-full text-left border-collapse text-xs mb-6">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-250">
                  <th className="py-2.5 px-3 w-[45%]">Item Description</th>
                  <th className="py-2.5 px-3 text-center w-[10%]">Qty</th>
                  <th className="py-2.5 px-3 text-right w-[15%]">Rate</th>
                  <th className="py-2.5 px-3 text-right w-[10%]">Discount</th>
                  <th className="py-2.5 px-3 text-right w-[10%]">GST %</th>
                  <th className="py-2.5 px-3 text-right w-[10%]">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {printSalesItems.map((itm, idx) => (
                  <tr key={idx}>
                    <td className="py-2 px-3 font-semibold text-slate-800">{itm.decodedName}</td>
                    <td className="py-2 px-3 text-center">{itm.quantity}</td>
                    <td className="py-2 px-3 text-right">₹{parseFloat(itm.rate).toFixed(2)}</td>
                    <td className="py-2 px-3 text-right text-red-650">{itm.discount_percent}%</td>
                    <td className="py-2 px-3 text-right">{itm.gst_rate}%</td>
                    <td className="py-2 px-3 text-right font-semibold">₹{parseFloat(itm.total_amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {printRentalItems.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs font-bold text-slate-450 uppercase mb-2 tracking-wider flex items-center gap-1.5">
              <span>🚜</span> Rental Items
            </h3>
            <table className="w-full text-left border-collapse text-xs mb-6">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-250">
                  <th className="py-2 px-3 w-[35%]">Equipment</th>
                  <th className="py-2 px-3 w-[15%]">Period</th>
                  <th className="py-2 px-3 text-center w-[8%]">Days</th>
                  <th className="py-2 px-3 text-center w-[8%]">Qty</th>
                  <th className="py-2 px-3 text-right w-[12%]">Rate</th>
                  <th className="py-2 px-3 text-right w-[10%]">GST %</th>
                  <th className="py-2 px-3 text-right w-[12%]">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {printRentalItems.map((itm, idx) => (
                  <tr key={idx}>
                    <td className="py-2 px-3 font-semibold text-slate-800">
                      {itm.decodedName}
                      <div className="text-[9px] text-slate-400">({itm.from_date} to {itm.to_date})</div>
                    </td>
                    <td className="py-2 px-3">{itm.rental_period}</td>
                    <td className="py-2 px-3 text-center">{itm.duration}</td>
                    <td className="py-2 px-3 text-center">{itm.quantity}</td>
                    <td className="py-2 px-3 text-right">₹{parseFloat(itm.rate).toFixed(2)}</td>
                    <td className="py-2 px-3 text-right">{itm.gst_rate}%</td>
                    <td className="py-2 px-3 text-right font-semibold">₹{parseFloat(itm.total_amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {printAmcItems.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs font-bold text-slate-450 uppercase mb-2 tracking-wider flex items-center gap-1.5">
              <span>🔧</span> AMC Services
            </h3>
            <table className="w-full text-left border-collapse text-xs mb-6">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-250">
                  <th className="py-2 px-3 w-[35%]">Service Title</th>
                  <th className="py-2 px-3 w-[15%]">Contract Period</th>
                  <th className="py-2 px-3 w-[15%]">Frequency</th>
                  <th className="py-2 px-3 text-right w-[12%]">Amount</th>
                  <th className="py-2 px-3 text-right w-[10%]">GST %</th>
                  <th className="py-2 px-3 text-right w-[13%]">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {printAmcItems.map((itm, idx) => (
                  <tr key={idx}>
                    <td className="py-2 px-3 font-semibold text-slate-850">
                      {itm.decodedName}
                      <div className="text-[9px] text-slate-400">({itm.start_date} to {itm.end_date})</div>
                    </td>
                    <td className="py-2 px-3">{itm.contract_period}</td>
                    <td className="py-2 px-3">{itm.frequency}</td>
                    <td className="py-2 px-3 text-right">₹{parseFloat(itm.rate).toFixed(2)}</td>
                    <td className="py-2 px-3 text-right">{itm.gst_rate}%</td>
                    <td className="py-2 px-3 text-right font-semibold">₹{parseFloat(itm.total_amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <div className="w-72 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-red-650">
                <span>Discount</span>
                <span>-₹{discount.toFixed(2)}</span>
              </div>
            )}
            {cgst > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>CGST</span>
                <span>₹{cgst.toFixed(2)}</span>
              </div>
            )}
            {sgst > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>SGST</span>
                <span>₹{sgst.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm text-slate-900 border-t border-slate-200 pt-2">
              <span>Grand Total</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center text-xs text-slate-400 border-t border-slate-105 pt-6">
          <p>Thank you for your business!</p>
          <p className="mt-1 text-[10px]">Powered by SmartGoNext ERP</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950 p-8 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">POS Terminal & Billing</h1>
            <p className="text-slate-350 mt-2 text-sm max-w-xl">
              Quickly create invoices, lookup outstanding balances, utilize fast shortcuts, and issue GST receipts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                refetchQuotations();
                setShowQuotationListModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-indigo-600 font-bold rounded-xl text-xs sm:text-sm shadow-md border border-slate-200 transition-colors cursor-pointer"
            >
              <FiList />
              <span>Load Quotation</span>
            </button>
            <button
              type="button"
              onClick={handleTriggerDemo}
              className="flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-md cursor-pointer"
            >
              <FiTrendingUp />
              <span>15-Sec Demo Load</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search Datalists */}
      <datalist id="sales-products-datalist">
        {products.map(p => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>
      <datalist id="rental-equipments-datalist">
        {equipmentList.map(e => (
          <option key={e.id} value={e.name} />
        ))}
      </datalist>
      <datalist id="amc-contracts-datalist">
        {amcList.map(a => {
          const title = a.contract_title || a.machine_name || 'AMC Contract';
          return (
            <option key={a.id} value={title} />
          );
        })}
      </datalist>

      <form onSubmit={handleGenerateInvoice} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Side */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><FiInfo /> Billing Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5 relative">
                <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                  <FiUser /> Search Customer (Name / Phone / Email)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiSearch className="text-slate-400 text-sm" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by name or phone..."
                    value={customerSearch}
                    onFocus={() => setShowCustomerDropdown(true)}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                      const exactMatch = customers.find(c => 
                        c.name.toLowerCase() === e.target.value.toLowerCase() ||
                        c.phone === e.target.value
                      );
                      if (exactMatch) {
                        setSelectedCustomerId(exactMatch.id.toString());
                      } else {
                        setSelectedCustomerId('');
                      }
                    }}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                  
                  <AnimatePresence>
                    {showCustomerDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto"
                      >
                        {filteredCustomers.length === 0 ? (
                          <div className="p-3 text-center text-slate-400 text-xs">
                            No customers found
                          </div>
                        ) : (
                          filteredCustomers.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => handleSelectCustomer(c)}
                              className={`w-full text-left px-3 py-2.5 text-sm hover:bg-indigo-55 dark:hover:bg-indigo-900/20 flex items-center justify-between transition-colors ${
                                selectedCustomerId === c.id.toString() ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-indigo-500' : ''
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium text-slate-800 dark:text-white">{c.name}</span>
                                <span className="text-[10px] text-slate-400">{c.phone}</span>
                              </div>
                              {c.email && (
                                <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{c.email}</span>
                              )}
                            </button>
                          ))
                        )}
                        
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddCustomerModal(true);
                            setShowCustomerDropdown(false);
                          }}
                          className="w-full text-left px-3 py-3 text-sm font-semibold text-indigo-650 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2 transition-colors"
                        >
                          <FiUserPlus className="text-base" />
                          <span>+ Add a Customer</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(true)}
                  className="w-full mt-1 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-700 flex items-center justify-center gap-1 transition-colors"
                >
                  <FiUserPlus />
                  <span>+ Add New Customer</span>
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase">Invoice Type</label>
                <select 
                  value={invoiceType} 
                  onChange={(e) => handleInvoiceTypeChange(e.target.value)} 
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                >
                  <option value="Sales">📦 Sales Invoice</option>
                  <option value="Rental">🚜 Equipment Rental</option>
                  <option value="AMC">🔧 AMC Service</option>
                </select>
              </div>

              {/* Show type-specific info badge */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase">Searching From</label>
                <div className="px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-2 h-[42px]">
                  <span className="text-base">{typeInfo.icon}</span>
                  <span>Searching <strong>{typeInfo.label}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Type-Specific Responsive Tables */}
          {(invoiceType === 'Sales' || items.some(itm => itm.type === 'Sales' && itm.product_name)) && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="bg-emerald-50 dark:bg-emerald-950/20 px-6 py-4 border-b border-emerald-100 dark:border-emerald-900/50 flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-300 font-extrabold">
                  <span className="text-lg">📦</span>
                  <span className="uppercase text-sm tracking-wider">Sales Items</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddItem('Sales')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer border border-emerald-500"
                >
                  <FiPlus className="text-sm stroke-[3]" />
                  <span>+ Add Sales Item</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[750px]">
                  <thead>
                    <tr className="bg-slate-100/70 dark:bg-slate-800/70 text-[11px] uppercase font-extrabold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      <th className="py-3 px-3 w-[4%] text-center">#</th>
                      <th className="py-3 px-3 w-[40%]">Item / Description</th>
                      <th className="py-3 px-3 w-[11%]">HSN / SAC</th>
                      <th className="py-3 px-3 w-[9%] text-center">Qty</th>
                      <th className="py-3 px-3 w-[10%]">Unit</th>
                      <th className="py-3 px-3 w-[11%] text-right">Rate (₹)</th>
                      <th className="py-3 px-3 w-[7%] text-center">Disc %</th>
                      <th className="py-3 px-3 w-[9%]">GST %</th>
                      <th className="py-3 px-3 w-[11%] text-right">Total (₹)</th>
                      <th className="py-3 px-3 w-[5%] text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {items.map((itm, idx) => {
                      if (itm.type !== 'Sales') return null;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-400 text-xs text-center">{idx + 1}</td>
                          <td className="py-2.5 px-3 relative">
                            <input
                              type="text"
                              value={itm.product_name}
                              placeholder="Type or select product..."
                              list="sales-products-datalist"
                              onChange={(e) => handleDescriptionChange(idx, 'Sales', e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-md text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none shadow-sm"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={itm.hsn_code}
                              onChange={(e) => handleUpdateItem(idx, 'hsn_code', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded text-xs focus:outline-none text-center"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              value={itm.qty}
                              onChange={(e) => handleUpdateItem(idx, 'qty', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded text-xs focus:outline-none text-center font-bold"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={itm.unit}
                              onChange={(e) => handleUpdateItem(idx, 'unit', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded text-xs focus:outline-none"
                            >
                              <option value="Nos">Nos</option>
                              <option value="Box">Box</option>
                              <option value="Kg">Kg</option>
                              <option value="Ltr">Ltr</option>
                              <option value="Set">Set</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              value={itm.rate}
                              onChange={(e) => handleUpdateItem(idx, 'rate', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded text-xs focus:outline-none text-right font-semibold"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              value={itm.discount_percent}
                              onChange={(e) => handleUpdateItem(idx, 'discount_percent', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded text-xs focus:outline-none text-center text-rose-600 font-medium"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={itm.tax_percent}
                              onChange={(e) => handleUpdateItem(idx, 'tax_percent', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded text-xs focus:outline-none"
                            >
                              <option value={0}>0%</option>
                              <option value={5}>5%</option>
                              <option value={12}>12%</option>
                              <option value={18}>18%</option>
                              <option value={28}>28%</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-slate-900 dark:text-white text-xs">
                            ₹{(itm.line_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors cursor-pointer"
                            >
                              <FiX className="text-base" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Subtotal line */}
              <div className="bg-slate-50 dark:bg-slate-800/30 px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span>Sales Subtotal:</span>
                  <span className="text-emerald-700 dark:text-emerald-400 text-sm font-black">
                    ₹{salesSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </span>
              </div>
            </div>
          )}

          {(invoiceType === 'Rental' || items.some(itm => itm.type === 'Rental' && itm.product_name)) && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="bg-blue-50 dark:bg-blue-950/20 px-6 py-4 border-b border-blue-100 dark:border-blue-900/50 flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-450 font-bold">
                  <span>🚜</span>
                  <span className="uppercase text-sm tracking-wider">Rental Items</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddItem('Rental')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer border border-blue-500"
                >
                  <FiPlus className="text-sm stroke-[3]" />
                  <span>+ Add Rental Item</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-100/70 dark:bg-slate-800/70 text-[11px] uppercase font-extrabold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      <th className="py-3 px-3 w-[4%] text-center">#</th>
                      <th className="py-3 px-3 w-[25%]">Rental Item / Equipment</th>
                      <th className="py-3 px-3 w-[11%]">Period</th>
                      <th className="py-3 px-3 w-[12%]">From Date</th>
                      <th className="py-3 px-3 w-[12%]">To Date</th>
                      <th className="py-3 px-3 w-[6%] text-center">Days</th>
                      <th className="py-3 px-3 w-[6%] text-center">Qty</th>
                      <th className="py-3 px-3 w-[9%] text-right">Rate (₹)</th>
                      <th className="py-3 px-3 w-[6%] text-center">Disc %</th>
                      <th className="py-3 px-3 w-[7%]">GST %</th>
                      <th className="py-3 px-3 w-[9%] text-right">Total (₹)</th>
                      <th className="py-3 px-3 w-[5%] text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {items.map((itm, idx) => {
                      if (itm.type !== 'Rental') return null;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-400 text-xs text-center">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={itm.product_name}
                              placeholder="Type or search equipment..."
                              list="rental-equipments-datalist"
                              onChange={(e) => handleDescriptionChange(idx, 'Rental', e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-md text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none shadow-sm"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={itm.rental_period}
                              onChange={(e) => handleUpdateItem(idx, 'rental_period', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded text-xs focus:outline-none"
                            >
                              <option value="Hourly">Hourly</option>
                              <option value="Daily">Daily</option>
                              <option value="Weekly">Weekly</option>
                              <option value="Monthly">Monthly</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="date"
                              value={itm.from_date || ''}
                              onChange={(e) => handleUpdateItem(idx, 'from_date', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded text-xs focus:outline-none text-center"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="date"
                              value={itm.to_date || ''}
                              onChange={(e) => handleUpdateItem(idx, 'to_date', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded text-xs focus:outline-none text-center"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              value={itm.duration}
                              onChange={(e) => handleUpdateItem(idx, 'duration', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded text-xs focus:outline-none text-center font-semibold bg-slate-50 dark:bg-slate-900"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              value={itm.qty}
                              onChange={(e) => handleUpdateItem(idx, 'qty', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded text-xs focus:outline-none text-center"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              value={itm.rate}
                              onChange={(e) => handleUpdateItem(idx, 'rate', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded text-xs focus:outline-none text-right font-medium"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              value={itm.discount_percent}
                              onChange={(e) => handleUpdateItem(idx, 'discount_percent', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded text-xs focus:outline-none text-center text-rose-500"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={itm.tax_percent}
                              onChange={(e) => handleUpdateItem(idx, 'tax_percent', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded text-xs focus:outline-none"
                            >
                              <option value={0}>0%</option>
                              <option value={5}>5%</option>
                              <option value={12}>12%</option>
                              <option value={18}>18%</option>
                              <option value={28}>28%</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-white text-xs">
                            ₹{(itm.line_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                            >
                              <FiX className="text-base" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Subtotal line */}
              <div className="bg-slate-50 dark:bg-slate-800/30 px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span>Rental Subtotal:</span>
                  <span className="text-blue-700 dark:text-blue-400 text-sm font-black">
                    ₹{rentalSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </span>
              </div>
            </div>
          )}

          {(invoiceType === 'AMC' || items.some(itm => itm.type === 'AMC' && itm.product_name)) && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="bg-violet-50 dark:bg-violet-950/20 px-6 py-4 border-b border-violet-100 dark:border-violet-900/50 flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-2 text-violet-900 dark:text-violet-300 font-extrabold">
                  <span className="text-lg">🔧</span>
                  <span className="uppercase text-sm tracking-wider">AMC Services</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddItem('AMC')}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer border border-violet-500"
                >
                  <FiPlus className="text-sm stroke-[3]" />
                  <span>+ Add AMC Item</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[850px]">
                  <thead>
                    <tr className="bg-slate-100/70 dark:bg-slate-800/70 text-[11px] uppercase font-extrabold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      <th className="py-3 px-3 w-[4%] text-center">#</th>
                      <th className="py-3 px-3 w-[27%]">AMC Service / Contract</th>
                      <th className="py-3 px-3 w-[14%]">Contract Period</th>
                      <th className="py-3 px-3 w-[12%]">Start Date</th>
                      <th className="py-3 px-3 w-[12%]">End Date</th>
                      <th className="py-3 px-3 w-[11%]">Frequency</th>
                      <th className="py-3 px-3 w-[9%] text-right">Amount (₹)</th>
                      <th className="py-3 px-3 w-[6%] text-center">Disc %</th>
                      <th className="py-3 px-3 w-[7%]">GST %</th>
                      <th className="py-3 px-3 w-[9%] text-right">Total (₹)</th>
                      <th className="py-3 px-3 w-[5%] text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {items.map((itm, idx) => {
                      if (itm.type !== 'AMC') return null;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-400 text-xs text-center">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={itm.product_name}
                              placeholder="Type or search AMC contract..."
                              list="amc-contracts-datalist"
                              onChange={(e) => handleDescriptionChange(idx, 'AMC', e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-md text-xs font-semibold focus:ring-2 focus:ring-violet-500 focus:border-violet-500 focus:outline-none shadow-sm"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={itm.contract_period}
                              onChange={(e) => handleUpdateItem(idx, 'contract_period', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded text-xs focus:outline-none"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="date"
                              value={itm.start_date || ''}
                              onChange={(e) => handleUpdateItem(idx, 'start_date', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded text-xs focus:outline-none text-center"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="date"
                              value={itm.end_date || ''}
                              onChange={(e) => handleUpdateItem(idx, 'end_date', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded text-xs focus:outline-none text-center"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={itm.frequency}
                              onChange={(e) => handleUpdateItem(idx, 'frequency', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded text-xs focus:outline-none"
                            >
                              <option value="Monthly">Monthly</option>
                              <option value="Quarterly">Quarterly</option>
                              <option value="Half-Yearly">Half-Yearly</option>
                              <option value="Annual">Annual</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              value={itm.rate}
                              onChange={(e) => handleUpdateItem(idx, 'rate', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded text-xs focus:outline-none text-right font-medium"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              value={itm.discount_percent}
                              onChange={(e) => handleUpdateItem(idx, 'discount_percent', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded text-xs focus:outline-none text-center text-rose-500"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={itm.tax_percent}
                              onChange={(e) => handleUpdateItem(idx, 'tax_percent', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded text-xs focus:outline-none"
                            >
                              <option value={0}>0%</option>
                              <option value={5}>5%</option>
                              <option value={12}>12%</option>
                              <option value={18}>18%</option>
                              <option value={28}>28%</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-white text-xs">
                            ₹{(itm.line_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                            >
                              <FiX className="text-base" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Subtotal line */}
              <div className="bg-slate-50 dark:bg-slate-800/30 px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <span className="text-xs font-bold text-slate-550 dark:text-slate-400 flex items-center gap-1.5">
                  <span>AMC Subtotal:</span>
                  <span className="text-violet-700 dark:text-violet-400 text-sm font-black">
                    ₹{amcSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Side */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md space-y-6">
            <h3 className="text-base font-bold text-slate-850 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <span>Checkout</span>
              <span className="text-[10px] text-slate-400 normal-case">Or press <kbd className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-emerald-600 font-bold">F8</kbd></span>
            </h3>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase">Payment Mode</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold">
                <option value="Cash">Cash payment</option>
                <option value="UPI">UPI / QR Transfer</option>
                <option value="Credit">On-Account Credit (Due)</option>
              </select>
            </div>

            {/* GST Summary & Financial Breakdown */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/70 dark:bg-slate-900/50 space-y-3">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">GST Summary</span>
                <div className="mt-1.5 space-y-1 text-xs">
                  {cgst > 0 && (
                    <div className="flex justify-between text-slate-600 dark:text-slate-350">
                      <span>CGST</span>
                      <span className="font-semibold">₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {sgst > 0 && (
                    <div className="flex justify-between text-slate-600 dark:text-slate-350">
                      <span>SGST</span>
                      <span className="font-semibold">₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {igst > 0 && (
                    <div className="flex justify-between text-slate-600 dark:text-slate-350">
                      <span>IGST</span>
                      <span className="font-semibold">₹{igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-800 dark:text-slate-200 font-bold border-t border-slate-200 dark:border-slate-800 pt-1.5">
                    <span>Total GST</span>
                    <span>₹{totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                {salesSubtotal > 0 && (
                  <div className="flex justify-between">
                    <span>Sales Subtotal</span>
                    <span className="font-medium text-slate-800 dark:text-white">₹{salesSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {rentalSubtotal > 0 && (
                  <div className="flex justify-between">
                    <span>Rental Subtotal</span>
                    <span className="font-medium text-slate-800 dark:text-white">₹{rentalSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {amcSubtotal > 0 && (
                  <div className="flex justify-between">
                    <span>AMC Subtotal</span>
                    <span className="font-medium text-slate-800 dark:text-white">₹{amcSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-rose-600 font-medium">
                    <span>Item Discount</span>
                    <span>-₹{totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300">
                  <span>Total Before Tax</span>
                  <span>₹{totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300">
                  <span>Total GST</span>
                  <span>₹{totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex justify-between items-center">
                <span className="text-sm font-extrabold text-slate-900 dark:text-white">Net Payable</span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  ₹{netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                id="checkout-submit-btn"
                type="submit"
                disabled={createInvoiceMutation.isPending || createQuotationMutation.isPending}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold rounded-xl shadow-lg flex items-center justify-center space-x-2 transition-all cursor-pointer border border-emerald-500 text-base"
              >
                <FiCheck className="text-xl stroke-[3]" />
                <span>{createInvoiceMutation.isPending ? 'Processing...' : 'Complete & Generate (F8)'}</span>
              </button>
              
              <button
                type="button"
                disabled={createInvoiceMutation.isPending || createQuotationMutation.isPending}
                onClick={handleGenerateQuotation}
                className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 active:from-violet-800 active:to-indigo-800 text-white font-extrabold rounded-xl shadow-md border border-violet-500/30 flex items-center justify-center space-x-2 transition-all cursor-pointer text-sm"
              >
                <FiFileText className="text-lg stroke-[2.5]" />
                <span>{createQuotationMutation.isPending ? 'Saving Quotation...' : 'Save as Quotation'}</span>
              </button>
              
              <button
                type="button"
                onClick={resetBillingForm}
                className="w-full py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-350 font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs transition-colors"
              >
                Reset Draft
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Invoice Summary Bottom Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white text-sm">
          <FiList />
          <span className="uppercase tracking-wider">Invoice Summary</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {salesItems.length > 0 && (
            <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 text-xs font-semibold rounded-full">
              Sales Items: {salesItems.length} Item(s)
            </span>
          )}
          {rentalItems.length > 0 && (
            <span className="px-3 py-1 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 text-blue-700 dark:text-blue-400 text-xs font-semibold rounded-full">
              Rental Items: {rentalItems.length} Item(s)
            </span>
          )}
          {amcItems.length > 0 && (
            <span className="px-3 py-1 bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900 text-violet-750 dark:text-violet-450 text-xs font-semibold rounded-full">
              AMC Services: {amcItems.length} Item(s)
            </span>
          )}
        </div>
        <div className="text-right">
          <span className="text-xs font-bold text-slate-400 mr-2 uppercase">Grand Total:</span>
          <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
            ₹{netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Add Customer Modal */}
      <AnimatePresence>
        {showAddCustomerModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowAddCustomerModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-white dark:bg-slate-900 z-10 flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                    <FiUserPlus className="text-indigo-600 dark:text-indigo-400 text-lg" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add New Customer</h2>
                    <p className="text-xs text-slate-400">Fill in the customer details below</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <FiX className="text-lg" />
                </button>
              </div>

              <form onSubmit={handleAddCustomer} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                      <FiUser /> Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Customer name"
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                      <FiPhoneCall /> Phone <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Phone number"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                      <FiMail /> Email
                    </label>
                    <input
                      type="email"
                      placeholder="Email address"
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                      <FiLock /> GSTIN
                    </label>
                    <input
                      type="text"
                      placeholder="GSTIN (15 chars)"
                      maxLength={15}
                      value={newCustomer.gstin}
                      onChange={(e) => setNewCustomer({ ...newCustomer, gstin: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm uppercase"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                      <FiEdit3 /> PAN
                    </label>
                    <input
                      type="text"
                      placeholder="PAN (10 chars)"
                      maxLength={10}
                      value={newCustomer.pan}
                      onChange={(e) => setNewCustomer({ ...newCustomer, pan: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm uppercase"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                      <FiMapPin /> Address
                    </label>
                    <textarea
                      placeholder="Full address"
                      value={newCustomer.address}
                      onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                      <FiHome /> City
                    </label>
                    <input
                      type="text"
                      placeholder="City"
                      value={newCustomer.city}
                      onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                      <FiGlobe /> State
                    </label>
                    <input
                      type="text"
                      placeholder="State"
                      value={newCustomer.state}
                      onChange={(e) => setNewCustomer({ ...newCustomer, state: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                      <FiMapPin /> Pincode
                    </label>
                    <input
                      type="text"
                      placeholder="Pincode"
                      value={newCustomer.pincode}
                      onChange={(e) => setNewCustomer({ ...newCustomer, pincode: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                      <FiEdit3 /> Notes
                    </label>
                    <textarea
                      placeholder="Any additional notes..."
                      value={newCustomer.notes}
                      onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddCustomerModal(false)}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createCustomerMutation.isPending}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm shadow-md flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <FiUserPlus />
                    <span>{createCustomerMutation.isPending ? 'Creating...' : 'Create Customer'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {showQuotationListModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowQuotationListModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="sticky top-0 bg-white dark:bg-slate-900 z-10 flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                    <FiFileText className="text-indigo-600 dark:text-indigo-400 text-lg" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Load Saved Quotation</h2>
                    <p className="text-xs text-slate-400">Search and import draft quotations into the active billing screen</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuotationListModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <FiX className="text-lg" />
                </button>
              </div>

              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-2">
                <FiSearch className="text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by Quotation Number or Customer Name..."
                  value={quotationSearch}
                  onChange={(e) => setQuotationSearch(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm w-full text-slate-750 dark:text-slate-300 focus:ring-0 placeholder:text-slate-400 bg-white dark:bg-slate-850 px-2 py-1 rounded"
                />
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {quotations.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 dark:text-slate-600">
                    <FiFileText className="text-4xl mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-semibold">No quotations found</p>
                    <p className="text-xs mt-1">Draft quotations created here will show up for conversion.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-150 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          <th className="pb-3 font-bold">Quote Number</th>
                          <th className="pb-3 font-bold">Date</th>
                          <th className="pb-3 font-bold">Customer</th>
                          <th className="pb-3 font-bold text-right">Total Amount</th>
                          <th className="pb-3 text-center font-bold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {quotations
                          .filter(q => {
                            const cust = customers.find(c => c.id === q.customer_id);
                            const customerName = cust ? cust.name.toLowerCase() : '';
                            const num = q.quotation_number.toLowerCase();
                            const term = quotationSearch.toLowerCase();
                            return num.includes(term) || customerName.includes(term);
                          })
                          .map((q) => {
                            const cust = customers.find(c => c.id === q.customer_id);
                            return (
                              <tr key={q.id} className="text-sm hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="py-3.5 font-semibold text-indigo-600 dark:text-indigo-400">{q.quotation_number}</td>
                                <td className="py-3.5 text-slate-500 dark:text-slate-400 text-xs">
                                  {new Date(q.quotation_date).toLocaleDateString('en-IN', {
                                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                  })}
                                </td>
                                <td className="py-3.5">
                                  <div className="font-semibold text-slate-800 dark:text-slate-200">{cust?.name || `Customer ID: ${q.customer_id}`}</div>
                                  <div className="text-[10px] text-slate-400">{cust?.phone || ''}</div>
                                </td>
                                <td className="py-3.5 text-right font-bold text-slate-800 dark:text-white font-mono">₹{parseFloat(q.total_amount).toFixed(2)}</td>
                                <td className="py-3.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => loadQuotationToPOS(q.id)}
                                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1"
                                  >
                                    <span>Import Details</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

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
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-50 dark:bg-slate-950 rounded-2xl shadow-2xl border border-slate-250 dark:border-slate-800 w-full max-w-4xl p-6 relative flex flex-col md:flex-row gap-6 max-h-[90vh]"
            >
              <div className="md:w-1/4 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <FiPrinter className="text-indigo-600 dark:text-indigo-400 text-xl" />
                    <h2 className="text-md font-bold text-slate-850 dark:text-slate-100 uppercase">Print Document</h2>
                  </div>
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg text-xs text-indigo-700 dark:text-indigo-300">
                    <p>Format applied: <strong>{printFormat}</strong></p>
                    <p className="mt-1 text-[10px]">Adjust format under Company Settings page.</p>
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
      </AnimatePresence>
    </div>
  );
}