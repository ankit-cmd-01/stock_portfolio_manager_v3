import api from "./axios";

export const getUserStocks = async () => {
  const { data } = await api.get("/user_stocks/");
  return data;
};

export const searchStockMaster = async (params = {}) => {
  const { data } = await api.get("/stock_master/", { params });
  return data;
};

export const getSuggestedPortfolios = async () => {
  const { data } = await api.get("/stock_master/suggested-portfolios/");
  return data;
};

export const getUserStock = async (pk) => {
  const { data } = await api.get(`/user_stocks/${pk}/`);
  return data;
};

export const createUserStock = async (payload) => {
  const { data } = await api.post("/user_stocks/", payload);
  return data;
};

export const updateUserStock = async (pk, payload) => {
  const { data } = await api.patch(`/user_stocks/${pk}/`, payload);
  return data;
};

export const removeUserStock = async (pk) => {
  const { data } = await api.delete(`/user_stocks/${pk}/`);
  return data;
};

export const getPortfolioStocks = async (pk) => {
  const { data } = await api.get(`/user_stocks/portfolio/${pk}/`, {
    timeout: 60000,
  });
  return data;
};

export const getPortfolioTableRows = async (pk, stockIds = []) => {
  const params = {};
  if (stockIds.length > 0) {
    params.ids = stockIds.join(",");
  }
  const { data } = await api.get(`/user_stocks/portfolio/${pk}/table/`, {
    params,
    timeout: 60000,
  });
  return data;
};

export const getPortfolioForecast = async (pk) => {
  const { data } = await api.get(`/api/portfolio/${pk}/forecast/`, {
    timeout: 30000,
  });
  return data;
};

export const getPortfolioAiSummary = async (pk) => {
  const { data } = await api.get(`/api/portfolio/${pk}/ai-summary/`, {
    timeout: 45000,
  });
  return data;
};

export const getPortfolios = async () => {
  const { data } = await api.get("/portfolio/");
  return data;
};

export const createPortfolio = async (payload) => {
  const { data } = await api.post("/portfolio/", payload);
  return data;
};

export const updatePortfolio = async (pk, payload) => {
  const { data } = await api.patch(`/portfolio/${pk}/`, payload);
  return data;
};

export const deletePortfolio = async (pk) => {
  const { data } = await api.delete(`/portfolio/${pk}/`);
  return data;
};
