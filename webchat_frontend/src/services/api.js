import axios, { AxiosHeaders } from "axios";
import useAuthStore from "../store/useAuthStore";
import { isChatAttachmentApiUrl } from "../utils/attachmentConstraints";
import { resolveApiBaseUrl } from "../utils/apiBaseUrl";

const API_BASE_URL = resolveApiBaseUrl();

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
  url.startsWith("/api/auth/forgot-password") ||
  url.startsWith("/api/auth/reset-password") ||
  url.startsWith("/api/notifications/");

const readPayloadMessage = (payload) => {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }
  if (payload && typeof payload === "object") {
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
  }
  return null;
};

export const getApiErrorMessage = (error, fallbackMessage = "Request failed") => {
  if (error == null) {
    return fallbackMessage;
  }

  const headers = error?.response?.headers ?? {};
  const gatewayMessage =
    headers["x-error-message"] ?? headers["X-Error-Message"];
  if (typeof gatewayMessage === "string" && gatewayMessage.trim()) {
    return gatewayMessage.trim();
  }

  const payload = error?.response?.data ?? (error?.response ? undefined : error);
  const payloadMessage = readPayloadMessage(payload);
  if (payloadMessage) {
    return payloadMessage;
  }

  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message.trim();
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

    const silentError = Boolean(error.config?.silentError);
    if (!silentError) {
      const gatewayMsg = error.response?.headers?.["x-error-message"]
        ?? error.response?.headers?.["X-Error-Message"];
      console.error("❌ Response error:", {
        url,
        status,
        message: getApiErrorMessage(error, error.message || "Request failed"),
      });
    }

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
