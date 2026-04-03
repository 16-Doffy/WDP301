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
import AnnotatorAuditDetail from './pages/Manager/AnnotatorAuditDetail';
import CreateProject from './pages/Manager/CreateProject';
import Datasets from './pages/Manager/Datasets';
import DatasetItemDetail from './pages/Manager/DatasetItemDetail';
import TopicManagement from './pages/Manager/TopicManagement';

import AnnotatorDashboard from './pages/Annotator/Dashboard';
import AnnotatorOverview from './pages/Annotator/Overview';
import AnnotatorTask from './pages/Annotator/Task';
import Rules from './pages/Annotator/Rules';
import ReviewerDashboard from './pages/Reviewer/Dashboard';
import ReviewerOverview from './pages/Reviewer/Overview';
import ReviewerTask from './pages/Reviewer/Task';
import AdminDashboard from './pages/Admin/Dashboard';
import AdminUsers from './pages/Admin/Users';
import AdminActivityLogs from './pages/Admin/ActivityLogs';
import AdminDatasets from './pages/Admin/Datasets';

import Layout from './components/LayoutTailwind';
import { useAuth } from './context/AuthContext';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#3b82f6' },
    secondary: { main: '#60a5fa' },
    success: { main: '#22c55e' },
    error: { main: '#ef4444' },
    background: { default: '#0f172a', paper: '#1e293b' },
    text: { primary: '#e2e8f0', secondary: '#94a3b8' },
    divider: '#334155',
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, letterSpacing: '-0.01em' },
    body1: { lineHeight: 1.7 },
    body2: { lineHeight: 1.65 },
  },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { backgroundColor: '#0f172a', color: '#e2e8f0' } } },
    MuiPaper: { styleOverrides: { root: { backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' } } },
    MuiCard: { styleOverrides: { root: { backgroundColor: '#1e293b', border: '1px solid #334155' } } },
    MuiDialog: { styleOverrides: { paper: { backgroundColor: '#1e293b', border: '1px solid #334155', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)' } } },
    MuiBackdrop: { styleOverrides: { root: { backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' } } },
    MuiOutlinedInput: { styleOverrides: { root: { backgroundColor: '#0f172a', color: '#e2e8f0', '& fieldset': { borderColor: '#475569' }, '&:hover fieldset': { borderColor: '#64748b' }, '&.Mui-focused fieldset': { borderColor: '#3b82f6' }, input: { '&::placeholder': { color: '#94a3b8', opacity: 1 } } } } },
    MuiInputLabel: { styleOverrides: { root: { color: '#94a3b8' } } },
    MuiTableCell: { styleOverrides: { root: { borderColor: '#334155', color: '#e2e8f0' }, head: { color: '#94a3b8', fontWeight: 700 } } },
    MuiButton: { styleOverrides: { root: { textTransform: 'none', fontWeight: 700, borderRadius: 10 }, containedPrimary: { backgroundColor: '#2563eb', color: '#ffffff', '&:hover': { backgroundColor: '#3b82f6' } } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 8 } } },
  },
});

const RoleDashboard = () => {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === 'manager' || user.role === 'admin') return <ManagerDashboard />;
  if (user.role === 'annotator') return <Navigate to="/annotator" replace />;
  if (user.role === 'reviewer') return <Navigate to="/reviewer" replace />;
  return <AdminDashboard />;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<RoleDashboard />} />
              <Route path="manager/projects" element={<ManagerProjects />} />
              <Route path="manager/projects/create" element={<CreateProject />} />
              <Route path="manager/projects/:id" element={<ManagerProjectDetail />} />
              <Route path="manager/projects/:projectId/annotator/:annotatorId" element={<AnnotatorAuditDetail />} />
              <Route path="manager/datasets" element={<Datasets />} />
              <Route path="manager/datasets/:datasetId/items/*" element={<DatasetItemDetail />} />
              <Route path="manager/topics" element={<TopicManagement />} />
              <Route path="annotator" element={<AnnotatorOverview />} />
              <Route path="annotator/rules" element={<Rules />} />
              <Route path="annotator/tasks" element={<AnnotatorDashboard />} />
              <Route path="annotator/tasks/:id" element={<AnnotatorTask />} />
              <Route path="reviewer" element={<ReviewerOverview />} />
              <Route path="reviewer/tasks" element={<ReviewerDashboard />} />
              <Route path="reviewer/dashboard" element={<ReviewerDashboard />} />
              <Route path="reviewer/tasks/:id" element={<ReviewerTask />} />
              <Route path="admin/users" element={<AdminUsers />} />
              <Route path="admin/activity-logs" element={<AdminActivityLogs />} />
              <Route path="admin/datasets" element={<AdminDatasets />} />
              <Route path="admin" element={<AdminDashboard />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
