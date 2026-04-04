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
import ReviewerDashboard from './pages/Reviewer/Dashboard';
import ReviewerTask from './pages/Reviewer/Task';
import AdminDashboard from './pages/Admin/Dashboard';
import AdminUsers from './pages/Admin/Users';
import AdminActivityLogs from './pages/Admin/ActivityLogs';
import AdminDatasets from './pages/Admin/Datasets';
import LayoutTailwind from './components/LayoutTailwind';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#3b82f6' },
    background: { default: '#0f172a', paper: '#1e293b' },
  },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none' } } },
  },
});

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route element={<PrivateRoute><LayoutTailwind /></PrivateRoute>}>
              <Route path="/dashboard" element={<ManagerDashboard />} />
              <Route path="/manager/projects" element={<ManagerProjects />} />
              <Route path="/manager/projects/create" element={<CreateProject />} />
              <Route path="/manager/projects/:id" element={<ManagerProjectDetail />} />
              <Route path="/manager/annotators/:projectId/:annotatorId" element={<AnnotatorAuditDetail />} />
              <Route path="/manager/datasets" element={<Datasets />} />
              <Route path="/manager/datasets/:id" element={<DatasetItemDetail />} />
              <Route path="/manager/topics" element={<TopicManagement />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/activity-logs" element={<AdminActivityLogs />} />
              <Route path="/admin/datasets" element={<AdminDatasets />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/annotator" element={<AnnotatorOverview />} />
              <Route path="/annotator/tasks" element={<AnnotatorDashboard />} />
              <Route path="/annotator/tasks/:id" element={<AnnotatorTask />} />
              <Route path="/reviewer" element={<ReviewerDashboard />} />
              <Route path="/reviewer/tasks" element={<ReviewerDashboard />} />
              <Route path="/reviewer/tasks/:id" element={<ReviewerTask />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;