import axios from "axios";

import { API_BASE_URL } from "../config/runtime";

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 60000, // Increased to 60 seconds
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;