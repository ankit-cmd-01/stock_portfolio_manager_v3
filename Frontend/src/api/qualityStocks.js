import api from "./axios";

export async function getQualityStocks(params = {}) {
  const { data } = await api.get("/api/quality-stocks/", { params });
  return data;
}

export async function getQualityStockDetail(id) {
  const { data } = await api.get(`/api/quality-stocks/${id}/`);
  return data;
}

export async function getQualityStockSnapshot(portfolioId) {
  const { data } = await api.post("/api/quality-stocks/snapshot/", {
    portfolio_id: Number(portfolioId),
  });
  return data;
}

export async function generateQualityStocks({ portfolioId, stockIds }) {
  const { data } = await api.post("/api/quality-stocks/generate/", {
    portfolio_id: Number(portfolioId),
    stock_ids: stockIds.map((item) => Number(item)),
  });
  return data;
}

export async function rerunQualityStock(id) {
  const { data } = await api.post(`/api/quality-stocks/${id}/rerun/`);
  return data;
}
