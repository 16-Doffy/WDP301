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
import AnnotatorOverview from './pages/Annotator/Overview';
import AnnotatorProjectList from './pages/Annotator/ProjectList';
import AnnotatorProjectDetail from './pages/Annotator/ProjectDetail';
import Workspace from './pages/Annotator/Workspace';
import AnnotatorHistory from './pages/Annotator/History';
import ReviewerProjectList from './pages/Reviewer/ProjectList';
import ReviewerProjectDetailPage from './pages/Reviewer/ProjectDetail';
import ReviewerWorkspace from './pages/Reviewer/Workspace';
import ReviewerTask from './pages/Reviewer/Task';
import ReviewerOverview from './pages/Reviewer/Overview';
import ReviewerHistory from './pages/Reviewer/History';
import AdminDashboard from './pages/Admin/Dashboard';
import AdminUsers from './pages/Admin/Users';
import AdminActivityLogs from './pages/Admin/ActivityLogs';
import AdminDatasets from './pages/Admin/Datasets';
import LayoutTailwind from './components/LayoutTailwind';
import LayoutAnnotator from './components/LayoutAnnotator';
import LayoutReviewer from './components/LayoutReviewer';

const darkTheme = createTheme({
  palette: { mode: 'dark', primary: { main: '#3b82f6' }, background: { default: '#0f172a', paper: '#1e293b' } },
  components: { MuiButton: { styleOverrides: { root: { textTransform: 'none' } } } },
});

const getRoleRedirect = () => {
  const token = sessionStorage.getItem('token');
  if (!token) return '/login';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload?.role === 'annotator') return '/annotator';
    if (payload?.role === 'reviewer') return '/reviewer';
    if (payload?.role === 'admin') return '/admin';
  } catch {}
  return '/dashboard';
};

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path='/login' element={<Login />} />
            <Route path='/register' element={<Register />} />
            <Route element={<PrivateRoute><LayoutTailwind /></PrivateRoute>}>
              <Route path='/dashboard' element={<ManagerDashboard />} />
              <Route path='/manager/projects' element={<ManagerProjects />} />
              <Route path='/manager/projects/create' element={<CreateProject />} />
              <Route path='/manager/projects/:id' element={<ManagerProjectDetail />} />
              <Route path='/manager/annotators/:projectId/:annotatorId' element={<AnnotatorAuditDetail />} />
              <Route path='/manager/datasets' element={<Datasets />} />
              <Route path='/manager/datasets/:id' element={<DatasetItemDetail />} />
              <Route path='/manager/datasets/:id/items/*' element={<DatasetItemDetail />} />
              <Route path='/manager/topics' element={<TopicManagement />} />
              <Route path='/admin/users' element={<AdminUsers />} />
              <Route path='/admin/activity-logs' element={<AdminActivityLogs />} />
              <Route path='/admin/datasets' element={<AdminDatasets />} />
              <Route path='/admin' element={<AdminDashboard />} />
            </Route>

            <Route element={<PrivateRoute><LayoutAnnotator /></PrivateRoute>}>
              <Route path='/annotator' element={<AnnotatorOverview />} />
              <Route path='/annotator/tasks' element={<AnnotatorProjectList />} />
              <Route path='/annotator/projects/:projectId' element={<AnnotatorProjectDetail />} />
              <Route path='/annotator/workspace/:subtopicId' element={<Workspace />} />
              <Route path='/annotator/history' element={<AnnotatorHistory />} />
            </Route>

            <Route element={<PrivateRoute><LayoutReviewer /></PrivateRoute>}>
              <Route path='/reviewer' element={<ReviewerOverview />} />
              <Route path='/reviewer/tasks' element={<ReviewerProjectList />} />
              <Route path='/reviewer/projects/:projectId' element={<ReviewerProjectDetailPage />} />
              <Route path='/reviewer/workspace/:projectId' element={<ReviewerWorkspace />} />
              <Route path='/reviewer/tasks/:id' element={<ReviewerTask />} />
              <Route path='/reviewer/history' element={<ReviewerHistory />} />
            </Route>

            <Route path='/' element={<Navigate to={getRoleRedirect()} replace />} />
            <Route path='*' element={<Navigate to='/dashboard' replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;