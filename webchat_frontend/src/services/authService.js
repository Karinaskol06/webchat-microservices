import api, { getApiErrorMessage } from "./api";

//all requests to auth-service are made through api gateway
const authService = {
  //login
  login: async (credentials) => {
    try {
      const response = await api.post("/api/auth/login", credentials);
      if (response.data.token) {
        localStorage.setItem("token", response.data.token);
      }
      return response.data;
    } catch (error) {
      throw new Error(
        getApiErrorMessage(error, "Login failed. Please try again.")
      );
    }
  },

  //logout
  logout: () => {
    localStorage.removeItem("token");
  },

  //registration
  register: async (userData) => {
    try {
      const response = await api.post("/api/auth/register", userData);
      return response.data;
    } catch (error) {
      console.error('Register error:', error);
      
      // Handle different error formats
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          throw new Error(error.response.data);
        } else if (error.response.data.message) {
          throw new Error(error.response.data.message);
        }
      }
      throw new Error(error.message || 'Registration failed');
    }
  },

  requestPasswordReset: async (email) => {
    try {
      const response = await api.post("/api/auth/forgot-password", { email });
      return response.data;
    } catch (error) {
      throw new Error(
        getApiErrorMessage(error, "Unable to process your request. Please try again.")
      );
    }
  },

  resetPassword: async ({ token, newPassword, confirmPassword }) => {
    try {
      const response = await api.post("/api/auth/reset-password", {
        token,
        newPassword,
        confirmPassword,
      });
      return response.data;
    } catch (error) {
      throw new Error(
        getApiErrorMessage(error, "Unable to reset password. Please try again.")
      );
    }
  },

  //get current user info
  getCurrentUser: async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await api.get("/api/auth/me", {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting current user:', error);
      throw error.response?.data || error.message;
    }
  }
};

export default authService;
