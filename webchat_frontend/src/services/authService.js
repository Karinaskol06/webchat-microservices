import api from "./api";

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
      throw error.response?.data || error.message;
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
