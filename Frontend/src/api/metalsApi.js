import api from "./axios";

const BASE = "/api/metals";

export const metalsApi = {
  health: () => api.get(`${BASE}/health/`),
  sync: () => api.post(`${BASE}/sync/`),
  ratio: (days = 30) => api.get(`${BASE}/ratio/?days=${days}`),
  syncLog: (params = {}) => api.get(`${BASE}/sync-log/`, { params }),
  prices: (metal, params = {}) => api.get(`${BASE}/${metal}/prices/`, { params }),
  ohlc: (metal, range) => api.get(`${BASE}/${metal}/ohlc/?range=${range}`),
  eda: (metal) => api.get(`${BASE}/${metal}/eda/`),
  summary: (metal) => api.get(`${BASE}/${metal}/summary/`),
};
