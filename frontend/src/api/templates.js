import apiClient from './client';

// Templates are managed per-company via the setup blueprint.
// GET/PUT /api/v1/setup/templates/<doc_type>
// doc_type: 'invoice', 'quotation', 'agreement', 'receipt', 'purchase_order', 'delivery_challan'

export const fetchTemplate = (docType) =>
  apiClient.get(`/setup/templates/${docType}`).then((r) => r.data.data);

export const saveTemplate = (docType, payload) =>
  apiClient.put(`/setup/templates/${docType}`, payload).then((r) => r.data.data);