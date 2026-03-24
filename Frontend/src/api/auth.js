import api from "./axios";

export const loginUser = async (payload) => {
  const { data } = await api.post("/accounts/login/", payload);
  return data;
};

export const registerUser = async (payload) => {
  const { data } = await api.post("/accounts/register/", payload);
  return data;
};

export const verifyOtp = async (payload) => {
  const { data } = await api.post("/accounts/verify-otp/", payload);
  return data;
};

export const resendRegisterOtp = async (payload) => {
  const { data } = await api.post("/accounts/resend-register-otp/", payload);
  return data;
};

export const logoutUser = async (refresh) => {
  const { data } = await api.post("/accounts/logout/", { refresh });
  return data;
};

export const getUserProfile = async () => {
  const { data } = await api.get("/accounts/profile/");
  return data;
};

export const updateUserProfile = async (payload) => {
  const isFormData = payload instanceof FormData;
  const { data } = await api.put("/accounts/profile/", payload, {
    headers: isFormData ? { "Content-Type": "multipart/form-data" } : undefined,
  });
  return data;
};

export const requestPasswordResetOtp = async (payload) => {
  const { data } = await api.post("/accounts/forgot-password/", payload);
  return data;
};

export const verifyResetEmail = async (payload) => {
  const { data } = await api.post("/accounts/verify-reset-email/", payload);
  return data;
};

export const verifyResetOtp = async (payload) => {
  const { data } = await api.post("/accounts/verify-reset-otp/", payload);
  return data;
};

export const resetUserPassword = async (payload) => {
  const { data } = await api.post("/accounts/reset-password/", payload);
  return data;
};
