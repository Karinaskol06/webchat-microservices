import axios from "axios";

// Dev: relative base URL uses Vite proxy (/api → gateway). Prod: explicit gateway URL.
const API_BASE_URL = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8089').replace(/\/$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true // Add this for cookies if needed
});

const isNotificationBootstrapEndpoint = (url = "") =>
  url.startsWith("/api/notifications/vapid-public-key");

const shouldSkip401AutoLogout = (url = "") =>
  url.startsWith("/api/auth/login") ||
  url.startsWith("/api/auth/register") ||
  url.startsWith("/api/notifications/");

export const getApiErrorMessage = (error, fallbackMessage = "Request failed") => {
  const payload = error?.response?.data;
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }
  if (payload && typeof payload === "object") {
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error;
    }
  }
  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message;
  }
  return fallbackMessage;
};

// Request interceptor for auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token && !isNotificationBootstrapEndpoint(config.url || "")) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const status = error.response?.status ?? null;
    const url = error.config?.url ?? "unknown";

    console.error('❌ Response error:', {
      url,
      status,
      message: getApiErrorMessage(error, error.message || "Request failed")
    });
    
    if (status === 401 && !shouldSkip401AutoLogout(url)) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;