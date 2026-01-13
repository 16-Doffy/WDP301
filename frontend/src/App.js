import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import ManagerDashboard from './pages/Manager/Dashboard';
import ManagerProjects from './pages/Manager/Projects';
import ManagerProjectDetail from './pages/Manager/ProjectDetail';
import AnnotatorDashboard from './pages/Annotator/Dashboard';
import AnnotatorTask from './pages/Annotator/Task';
import ReviewerDashboard from './pages/Reviewer/Dashboard';
import ReviewerTask from './pages/Reviewer/Task';
import AdminDashboard from './pages/Admin/Dashboard';
import AdminUsers from './pages/Admin/Users';
import Layout from './components/Layout';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<ManagerDashboard />} />
              <Route path="manager/projects" element={<ManagerProjects />} />
              <Route path="manager/projects/:id" element={<ManagerProjectDetail />} />
              <Route path="annotator/tasks" element={<AnnotatorDashboard />} />
              <Route path="annotator/tasks/:id" element={<AnnotatorTask />} />
              <Route path="reviewer/tasks" element={<ReviewerDashboard />} />
              <Route path="reviewer/tasks/:id" element={<ReviewerTask />} />
              <Route path="admin/users" element={<AdminUsers />} />
              <Route path="admin" element={<AdminDashboard />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
