import axios, { AxiosHeaders } from "axios";
import useAuthStore from "../store/useAuthStore";
import { isChatAttachmentApiUrl } from "../utils/attachmentConstraints";

// Dev: relative base URL uses Vite proxy (/api → gateway). Prod: explicit gateway URL.
const API_BASE_URL = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8089').replace(/\/$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

const isNotificationBootstrapEndpoint = (url = "") =>
  url.startsWith("/api/notifications/vapid-public-key");

const shouldSkip401AutoLogout = (url = "") =>
  url.startsWith("/api/auth/login") ||
  url.startsWith("/api/auth/register") ||
  url.startsWith("/api/notifications/");

export const getApiErrorMessage = (error, fallbackMessage = "Request failed") => {
  const headers = error?.response?.headers ?? {};
  const gatewayMessage =
    headers["x-error-message"] ?? headers["X-Error-Message"];
  if (typeof gatewayMessage === "string" && gatewayMessage.trim()) {
    return gatewayMessage.trim();
  }

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

function applyAuthHeaders(config) {
  const headers = AxiosHeaders.from(config.headers);
  const token = localStorage.getItem("token");
  const url = config.url || "";

  if (token && !isNotificationBootstrapEndpoint(url)) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    headers.delete("Content-Type");
    headers.delete("content-type");
  }

  config.headers = headers;

  return config;
}

api.interceptors.request.use(
  (config) => applyAuthHeaders(config),
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status ?? null;
    const url = error.config?.url ?? "unknown";

    const gatewayMsg = error.response?.headers?.["x-error-message"]
      ?? error.response?.headers?.["X-Error-Message"];
    console.error("❌ Response error:", {
      url,
      status,
      message: getApiErrorMessage(error, error.message || "Request failed"),
    });

    const isAuthFailure =
      status === 401 &&
      !shouldSkip401AutoLogout(url) &&
      !isChatAttachmentApiUrl(url);

    if (isAuthFailure) {
      const headers = AxiosHeaders.from(error.config?.headers);
      const hadAuthHeader = headers.has("Authorization");
      if (localStorage.getItem("token") && hadAuthHeader) {
        useAuthStore.getState().logout();
      }
    }

    return Promise.reject(error);
  },
);

export default api;
