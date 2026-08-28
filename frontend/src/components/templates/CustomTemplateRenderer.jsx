import { useQuery } from '@tanstack/react-query';
import { fetchTemplate } from '../../api/templates';

const CANVAS_W = 595;
const CANVAS_H = 842;

export function numberToWords(num) {
  if (num === null || num === undefined || isNaN(num)) return '';
  let str = num.toString();
  let parts = str.split('.');
  let rupees = parseInt(parts[0], 10);
  let paise = parts[1] ? parseInt(parts[1].slice(0, 2), 10) : 0;

  function convertWords(n) {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 
                  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convertWords(n % 100) : '');
    
    if (n < 100000) return convertWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convertWords(n % 1000) : '');
    if (n < 10000000) return convertWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convertWords(n % 100000) : '');
    return convertWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convertWords(n % 10000000) : '');
  }

  let words = '';
  if (rupees === 0) {
    words = 'Zero Rupees';
  } else {
    words = convertWords(rupees) + ' Rupees';
  }

  if (paise > 0) {
    words += ' and ' + convertWords(paise) + ' Paise';
  }
  return words + ' Only';
}

export default function CustomTemplateRenderer({ docType, documentData, company, customer }) {
  const { data: template, isLoading } = useQuery({
    queryKey: ['template-designer', docType],
    queryFn: () => fetchTemplate(docType),
  });

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading custom template...</div>;
  }

  const elements = template?.layout_json?.elements || [];
  
  const subtotal = parseFloat(documentData?.subtotal || 0);
  const discount = parseFloat(documentData?.discount_amount || 0);
  const cgst = parseFloat(documentData?.cgst_amount || 0);
  const sgst = parseFloat(documentData?.sgst_amount || 0);
  const tax_total = cgst + sgst;
  const total = parseFloat(documentData?.total_amount || 0);

  const formattedDate = documentData?.invoice_date || documentData?.quotation_date || documentData?.created_at
    ? new Date(documentData.invoice_date || documentData.quotation_date || documentData.created_at).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
      })
    : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const formattedDueDate = documentData?.due_date
    ? new Date(documentData.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  const renderTextContent = (textTemplate) => {
    if (!textTemplate) return '';
    let t = textTemplate;
    
    const getNestedValue = (obj, path) => {
      return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    };

    const formatVal = (val, key) => {
      if (val === null || val === undefined) return '';
      if (key.includes('date') && !isNaN(Date.parse(val))) {
        return new Date(val).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric'
        });
      }
      if (typeof val === 'number' || (!isNaN(val) && (key.includes('price') || key.includes('amount') || key.includes('value') || key.includes('total') || key.includes('rate') || key === 'subtotal' || key === 'discount'))) {
        const num = parseFloat(val);
        return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      return String(val);
    };

    const vars = {
      company_name: company?.name,
      company_address: company?.address,
      company_gstin: company?.gstin,
      company_phone: company?.phone,
      footer_text: documentData?.notes || '',

      customer_name: customer?.name || documentData?.customer?.name || documentData?.supplier?.name || 'Walk-In Customer',
      customer_address: customer?.address || documentData?.customer?.address || documentData?.supplier?.address,
      customer_email: customer?.email || documentData?.customer?.email || documentData?.supplier?.email,
      customer_phone: customer?.phone || documentData?.customer?.phone || documentData?.supplier?.phone,
      customer_city: customer?.city || documentData?.customer?.city || documentData?.supplier?.city,
      customer_state: customer?.state || documentData?.customer?.state || documentData?.supplier?.state,
      customer_pincode: customer?.pincode || documentData?.customer?.pincode || documentData?.supplier?.pincode,
      customer_gstin: customer?.gstin || documentData?.customer?.gstin || documentData?.supplier?.gstin,

      supplier_name: documentData?.supplier?.name || customer?.name || 'Supplier',
      supplier_address: documentData?.supplier?.address || customer?.address,
      supplier_email: documentData?.supplier?.email || customer?.email,
      supplier_phone: documentData?.supplier?.phone || customer?.phone,

      invoice_number: documentData?.invoice_number || documentData?.quotation_number || documentData?.challan_number || documentData?.po_number || documentData?.receipt_number || documentData?.agreement_number || '',
      po_number: documentData?.po_number || '',
      quotation_number: documentData?.quotation_number || '',
      challan_number: documentData?.challan_number || '',
      receipt_number: documentData?.receipt_number || '',
      agreement_number: documentData?.agreement_number || '',

      invoice_date: documentData?.invoice_date || documentData?.order_date || documentData?.quotation_date || documentData?.challan_date || documentData?.receipt_date || documentData?.agreement_date || documentData?.created_at,
      order_date: documentData?.order_date || documentData?.invoice_date,
      due_date: documentData?.due_date,
      from_date: documentData?.from_date || documentData?.start_date,
      to_date: documentData?.to_date || documentData?.end_date,
      start_date: documentData?.start_date,
      end_date: documentData?.end_date,

      subtotal: subtotal,
      discount: discount,
      tax_total: tax_total,
      total: total,
      total_amount: total,
      amount_in_words: numberToWords(total),

      product_name: documentData?.product_name || documentData?.name,
      product_sku: documentData?.product_sku || documentData?.sku,
      product_description: documentData?.product_description || documentData?.description,
      selling_price: documentData?.selling_price || documentData?.price,
      hsn_code: documentData?.hsn_code,
      unit: documentData?.unit,
      current_stock: documentData?.current_stock,

      material_name: documentData?.material_name || documentData?.name || documentData?.product_name,
      material_sku: documentData?.material_sku || documentData?.sku || documentData?.product_sku,
      material_description: documentData?.material_description || documentData?.description || documentData?.product_description,
      purchase_price: documentData?.purchase_price || documentData?.price || documentData?.purchase_price,
      safety_stock: documentData?.safety_stock,

      service_name: documentData?.service_name || documentData?.name,
      service_description: documentData?.service_description || documentData?.description,
      hourly_rate: documentData?.hourly_rate,
      daily_rate: documentData?.daily_rate,
      tax_percent: documentData?.tax_percent || documentData?.tax_rate,

      equipment_name: documentData?.equipment_name || documentData?.equipment?.name,
      serial_number: documentData?.serial_number || documentData?.equipment?.serial_number || documentData?.registration_number,
      rental_period: documentData?.rental_period,
      rental_rate: documentData?.rental_rate || documentData?.rate,
      duration: documentData?.duration,

      contract_title: documentData?.contract_title || documentData?.title,
      machine_name: documentData?.machine_name || documentData?.equipment?.name,
      machine_serial: documentData?.machine_serial || documentData?.equipment?.serial_number,
      amc_value: documentData?.amc_value || documentData?.value,
      frequency: documentData?.frequency,
    };

    return t.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (match, key) => {
      if (vars[key] !== undefined) {
        return formatVal(vars[key], key);
      }
      const val = getNestedValue(documentData, key) || getNestedValue(customer, key) || getNestedValue(company, key);
      if (val !== undefined) {
        return formatVal(val, key);
      }
      return '';
    });
  };

  return (
    <div className="relative bg-white shadow-2xl mx-auto border border-slate-200 print:border-none print:shadow-none"
      style={{ width: CANVAS_W, height: CANVAS_H, minWidth: CANVAS_W, minHeight: CANVAS_H, position: 'relative' }}>
      {elements.map((el) => {
        const left = `${el.x_pct}%`;
        const top = `${el.y_pct}%`;
        const width = `${el.w_pct}%`;
        const height = `${el.h_pct}%`;

        return (
          <div
            key={el.id}
            className="absolute overflow-hidden"
            style={{
              left,
              top,
              width,
              height,
              zIndex: el.z_index || 1,
            }}
          >
            {el.type === 'text' && (
              <div
                className="w-full h-full px-2 py-1 flex items-center"
                style={{
                  fontFamily: el.font || 'sans-serif',
                  fontSize: el.size ? `${el.size}px` : '12px',
                  color: el.color || '#000000',
                  fontWeight: el.bold ? 'bold' : 'normal',
                  fontStyle: el.italic ? 'italic' : 'normal',
                  textDecoration: el.underline ? 'underline' : 'none',
                  textAlign: el.align || 'left',
                  justifyContent: el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start',
                }}
              >
                <span className="whitespace-pre-line">{renderTextContent(el.text)}</span>
              </div>
            )}

            {el.type === 'image' && (
              <img
                src={el.image_url === 'https://placehold.co/150x100?text=Logo' && company?.logo_url ? company.logo_url : el.image_url}
                alt="Logo/Asset"
                className="w-full h-full object-contain"
                style={{ opacity: (el.opacity || 100) / 100 }}
              />
            )}

            {el.type === 'table' && (
              <div className="w-full h-full flex flex-col border border-slate-200 rounded overflow-hidden">
                <table className="w-full h-full text-[10px] text-left border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: el.header_bg || '#1e293b', color: el.header_text_color || '#ffffff' }}>
                      <th className="p-1.5 border-b border-slate-200">Item Details</th>
                      <th className="p-1.5 border-b border-slate-200 text-center">Qty</th>
                      <th className="p-1.5 border-b border-slate-200 text-right">Rate</th>
                      <th className="p-1.5 border-b border-slate-200 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(documentData?.items || []).map((itm, idx) => (
                      <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="p-1.5 font-medium text-slate-800 truncate">
                          {itm.description || itm.product_name || `Product #${itm.product_id}`}
                        </td>
                        <td className="p-1.5 text-center text-slate-600">{itm.quantity}</td>
                        <td className="p-1.5 text-right text-slate-600">
                          ₹{parseFloat(itm.rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-1.5 text-right font-semibold text-slate-900">
                          ₹{parseFloat(itm.total_amount || (itm.quantity * itm.rate)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                    {(documentData?.items || []).length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-400">No items available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {el.type === 'signature' && (
              <div className="w-full h-full flex flex-col items-center justify-end p-2 border-t border-dashed border-slate-300">
                <div
                  className="italic opacity-80"
                  style={{
                    fontFamily: el.font || 'monospace',
                    fontSize: el.size ? `${el.size}px` : '12px',
                    color: el.color || '#000000',
                  }}
                >
                  {el.text || 'Authorized Signatory'}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
