import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';

const AuthContext = createContext();
const AUTH_TOKEN_KEY = 'token';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleProfileUpdate = (e) => {
      setUser(e.detail);
    };
    window.addEventListener('userProfileUpdated', handleProfileUpdate);
    return () => window.removeEventListener('userProfileUpdated', handleProfileUpdate);
  }, []);

  useEffect(() => {
    const tabToken = sessionStorage.getItem(AUTH_TOKEN_KEY);

    if (tabToken) {
      axios.defaults.headers.common.Authorization = `Bearer ${tabToken}`;
      // Decode user from JWT directly — instant, no API call needed
      try {
        const payload = JSON.parse(atob(tabToken.split('.')[1]));
        if (payload && payload._id) {
          setUser({
            _id: payload._id,
            email: payload.email,
            role: payload.role,
            username: payload.username,
            fullName: payload.fullName,
          });
          setLoading(false);
          return;
        }
      } catch {
        // Fall through to API fetch if decode fails
      }
      // Fallback: verify token with server
      fetchUser();
    } else {
      delete axios.defaults.headers.common.Authorization;
      setLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/me`);
      setUser(response.data.user);
    } catch (error) {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      delete axios.defaults.headers.common.Authorization;
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email,
      password,
    });

    const { token, user: loggedInUser } = response.data;

    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    setUser(loggedInUser);
    setLoading(false);

    return loggedInUser;
  };

  const register = async (userData) => {
    const response = await axios.post(`${API_URL}/api/auth/register`, userData);
    const { token, user: registeredUser } = response.data;

    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    setUser(registeredUser);
    setLoading(false);

    return registeredUser;
  };

  const logout = () => {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    delete axios.defaults.headers.common.Authorization;
    setUser(null);
  };

  const value = {
    user,
    setUser,
    login,
    register,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
