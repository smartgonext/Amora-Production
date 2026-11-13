/**
 * Store / Restaurant integration API client.
 *
 * Wraps the ERP-side management endpoints for the manufacturer->restaurant
 * feed (see backend/app/routes/restaurant_api.py). The API key generated here
 * is what you paste into the Restaurant POS EXE so it can fetch products and
 * perform stock transfers.
 *
 * All functions return the Axios response; callers access `.data.data`.
 */
import apiClient from './client';

/** Register a restaurant outlet -> returns the generated API key (shown once). */
export const createStoreChannel = (payload) =>
  apiClient.post('/store/channels', payload);

/** List my restaurant outlets (API key hidden). */
export const listStoreChannels = () =>
  apiClient.get('/store/channels');

/** Rotate an outlet's API key -> returns the new key (shown once). */
export const rotateStoreChannelKey = (channelId) =>
  apiClient.post(`/store/channels/${channelId}/rotate-key`);

/** Full dispatch history for one outlet. */
export const listStoreChannelDispatches = (channelId) =>
  apiClient.get(`/store/channels/${channelId}/dispatches`);

/** List synced restaurant catalog products & dual stock */
export const listSyncedProducts = (params) =>
  apiClient.get('/store/synced-products', { params });

/** Import all synced restaurant products into main ERP Product catalog */
export const importSyncedToProducts = () =>
  apiClient.post('/store/synced-products/import-to-products');
