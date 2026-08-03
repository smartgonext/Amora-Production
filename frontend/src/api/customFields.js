import apiClient from './client';

export const fetchFormSchema = (entityType) =>
  apiClient.get('/custom-fields/schema', { params: { entity_type: entityType } }).then((r) => r.data.data);

export const createSection = (payload) =>
  apiClient.post('/custom-fields/sections', payload).then((r) => r.data.data);

export const updateSection = (sectionId, payload) =>
  apiClient.put(`/custom-fields/sections/${sectionId}`, payload).then((r) => r.data.data);

export const deleteSection = (sectionId) =>
  apiClient.delete(`/custom-fields/sections/${sectionId}`).then((r) => r.data.data);

export const createField = (payload) =>
  apiClient.post('/custom-fields/fields', payload).then((r) => r.data.data);

export const updateField = (fieldId, payload) =>
  apiClient.put(`/custom-fields/fields/${fieldId}`, payload).then((r) => r.data.data);

export const deleteField = (fieldId) =>
  apiClient.delete(`/custom-fields/fields/${fieldId}`).then((r) => r.data.data);

export const appendFieldOption = (fieldId, option) =>
  apiClient.post(`/custom-fields/fields/${fieldId}/options`, { option }).then((r) => r.data.data);

export const reorderSchema = (entityType, reorderData) =>
  apiClient.post('/custom-fields/reorder', { entity_type: entityType, reorder_data: reorderData }).then((r) => r.data.data);