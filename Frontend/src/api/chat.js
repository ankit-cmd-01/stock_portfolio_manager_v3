import api from "./axios";

export const sendChatMessage = async (payload, options = {}) => {
  const { authenticated = true } = options;
  const headers = authenticated ? undefined : { Authorization: "" };
  const { data } = await api.post("/api/chat/", payload, { headers });
  return data;
};
