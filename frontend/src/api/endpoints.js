import client from './client'

export const authApi = {
  login: (email, password) => client.post('/auth/login', { email, password }),
  me: () => client.get('/auth/me'),
  listUsers: () => client.get('/auth/users'),
  createUser: (payload) => client.post('/auth/users', payload),
}

export const stationsApi = {
  list: () => client.get('/stations'),
  create: (payload) => client.post('/stations', payload),
  listStorageUnits: (stationId) => client.get('/storage-units', { params: { station_id: stationId } }),
  createStorageUnit: (payload) => client.post('/storage-units', payload),
  logTemperature: (payload) => client.post('/storage-units/temperature-log', payload),
  temperatureHistory: (storageUnitId) => client.get(`/storage-units/${storageUnitId}/temperature-log`),
}

export const inventoryApi = {
  listAssetDefinitions: () => client.get('/asset-definitions'),
  createAssetDefinition: (payload) => client.post('/asset-definitions', payload),
  listBatches: (params) => client.get('/asset-batches', { params }),
  createBatch: (payload) => client.post('/asset-batches', payload),
  issueFefo: (payload) => client.post('/inventory/issue-fefo', payload),
  expiringBatches: () => client.get('/reports/expiring-batches'),
  lowStock: () => client.get('/reports/low-stock'),
}

export const qrApi = {
  generate: (payload) => client.post('/qr/generate', payload),
  scan: (payload) => client.post('/qr/scan', payload),
  entityHistory: (entityType, entityId) => client.get(`/qr/entity/${entityType}/${entityId}/history`),
}

export const shipmentsApi = {
  list: (params) => client.get('/shipments', { params }),
  create: (payload) => client.post('/shipments', payload),
  update: (id, payload) => client.patch(`/shipments/${id}`, payload),
  addTracking: (payload) => client.post('/shipments/tracking', payload),
  getTracking: (shipmentId) => client.get(`/shipments/${shipmentId}/tracking`),
}

export const alertsApi = {
  list: (params) => client.get('/alerts', { params }),
  resolve: (id) => client.patch(`/alerts/${id}/resolve`),
}

export const reportsApi = {
  manifest: (shipmentId) => client.get(`/reports/manifest/${shipmentId}`),
  dispatch: (shipmentId) => client.get(`/reports/dispatch/${shipmentId}`),
  auditLog: (params) => client.get('/reports/audit-log', { params }),
}

