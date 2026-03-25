import api from "./axios";

export const getNewsSentiment = async (params = {}) => {
  const { data } = await api.get("/api/advanced/news-sentiment/", { params });
  return data;
};

export const getEarningsAnalysis = async (params = {}) => {
  const { data } = await api.get("/api/advanced/earnings/", { params });
  return data;
};
