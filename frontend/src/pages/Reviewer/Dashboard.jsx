import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  PendingActions as PendingIcon,
  ErrorOutline as RejectedIcon,
  KeyboardArrowRight as ArrowRightIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';

const detectType = (task) => {
  const mime = (task?.dataItem?.mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('text/') || task?.dataItem?.text) return 'text';
  return 'other';
};

const ReviewerDashboard = () => {
  const [pendingTasks, setPendingTasks] = useState([]);
  const [reviewedTasks, setReviewedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0); // 0: Pending by Project, 1: Reviewed History
  const [selectedDataType, setSelectedDataType] = useState('all');
  const [selectedGroupKey, setSelectedGroupKey] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/reviews/all`);
      setPendingTasks(response.data.pending || []);
      setReviewedTasks(response.data.reviewed || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const dataTypeTabs = useMemo(() => {
    const allTasks = [...pendingTasks, ...reviewedTasks];
    const byType = (type) => allTasks.filter((t) => type === 'all' ? true : detectType(t) === type).length;

    return [
      { id: 'all', label: 'All', count: byType('all') },
      { id: 'image', label: 'Image', count: byType('image') },
      { id: 'text', label: 'Text', count: byType('text') },
      { id: 'audio', label: 'Audio', count: byType('audio') },
    ];
  }, [pendingTasks, reviewedTasks]);

  const matchesDataType = (task) => selectedDataType === 'all' || detectType(task) === selectedDataType;

  const filteredPending = useMemo(() => pendingTasks.filter(matchesDataType), [pendingTasks, selectedDataType]);
  const filteredReviewed = useMemo(() => reviewedTasks.filter(matchesDataType), [reviewedTasks, selectedDataType]);

  const pendingProjectGroups = useMemo(() => {
    const groups = {};

    filteredPending.forEach((task) => {
      const projectId = task?.projectId?._id || 'unknown';
      const projectName = task?.projectId?.name || 'Unknown Project';
      const datasetId = task?.datasetId?._id || 'unknown';
      const datasetName = task?.datasetId?.name || 'No dataset';
      const type = detectType(task);
      const key = `${projectId}::${datasetId}::${type}`;

      if (!groups[key]) {
        groups[key] = {
          key,
          projectId,
          projectName,
          datasetId,
          datasetName,
          type,
          tasks: [],
          annotatorMap: {},
        };
      }

      groups[key].tasks.push(task);

      const annotatorName = task?.annotatorId?.fullName || task?.annotatorId?.username || 'Unknown Annotator';
      groups[key].annotatorMap[annotatorName] = (groups[key].annotatorMap[annotatorName] || 0) + 1;
    });

    return Object.values(groups)
      .map((g) => {
        const submittedCount = g.tasks.filter((t) => t.status === 'submitted').length;
        const firstTask = [...g.tasks].sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0))[0];
        const annotatorSummary = Object.entries(g.annotatorMap)
          .sort((a, b) => b[1] - a[1]);

        return {
          ...g,
          pendingCount: g.tasks.length,
          submittedCount,
          firstTask,
          annotatorSummary,
        };
      })
      .sort((a, b) => b.pendingCount - a.pendingCount);
  }, [filteredPending]);

  const selectedGroup = useMemo(
    () => pendingProjectGroups.find((g) => g.key === selectedGroupKey) || pendingProjectGroups[0] || null,
    [pendingProjectGroups, selectedGroupKey]
  );

  const reviewedRows = tabValue === 1 ? filteredReviewed : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="relative w-12 h-12">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-slate-700 rounded-full"></div>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, colorClass, subtext }) => (
    <div className="bg-[#1e293b] rounded-2xl p-6 shadow-2xl border border-slate-700">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-400 text-sm mb-1 uppercase tracking-wider">{title}</p>
          <h3 className="text-3xl font-semibold text-slate-200">{value}</h3>
          {subtext && <p className="text-slate-400 text-xs mt-2">{subtext}</p>}
        </div>
        <div className={`p-3 rounded-xl ${colorClass}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] p-6 md:p-10 max-w-7xl mx-auto space-y-8 text-slate-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white tracking-tight">Review Dashboard</h1>
          <p className="text-slate-400 mt-1">Project-based review mode for large-scale queue.</p>
        </div>
        <button onClick={fetchTasks} className="p-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition">
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Assigned" value={pendingTasks.length + reviewedTasks.length} icon={SearchIcon} colorClass="bg-blue-500/20 text-blue-400" subtext="All tasks" />
        <StatCard title="Pending" value={filteredPending.length} icon={PendingIcon} colorClass="bg-amber-500/20 text-amber-400" subtext="Need review" />
        <StatCard title="Approved" value={filteredReviewed.filter((t) => t.status === 'approved').length} icon={CheckCircleIcon} colorClass="bg-emerald-500/20 text-emerald-400" subtext="Reviewed pass" />
        <StatCard title="Rejected" value={filteredReviewed.filter((t) => t.status === 'rejected').length} icon={RejectedIcon} colorClass="bg-red-500/20 text-red-400" subtext="Need rework" />
      </div>

      <div className="bg-[#1e293b] rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
        <div className="px-6 pt-5">
          <div className="mb-4 flex flex-wrap gap-2">
            {dataTypeTabs.map((typeTab) => (
              <button
                key={typeTab.id}
                onClick={() => setSelectedDataType(typeTab.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${selectedDataType === typeTab.id
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-[#0f172a] text-slate-300 border-slate-600 hover:border-blue-500'
                  }`}
              >
                {typeTab.label} <span className="ml-1 opacity-80">({typeTab.count})</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex border-b border-slate-700 px-6">
          <button onClick={() => setTabValue(0)} className={`pb-4 px-4 text-sm font-semibold ${tabValue === 0 ? 'text-blue-400 border-b-2 border-blue-500' : 'text-slate-400'}`}>
            Pending by Project <span className="ml-2 text-xs">({pendingProjectGroups.length})</span>
          </button>
          <button onClick={() => setTabValue(1)} className={`pb-4 px-4 text-sm font-semibold ${tabValue === 1 ? 'text-blue-400 border-b-2 border-blue-500' : 'text-slate-400'}`}>
            Reviewed History <span className="ml-2 text-xs">({filteredReviewed.length})</span>
          </button>
        </div>

        {tabValue === 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
            <div className="lg:col-span-2 border-r border-slate-700">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#0f172a]">
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Project / Dataset</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Type</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Pending</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Annotators</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {pendingProjectGroups.length === 0 ? (
                    <tr><td colSpan={5} className="py-16 text-center text-slate-400">No pending projects.</td></tr>
                  ) : pendingProjectGroups.map((group) => (
                    <tr
                      key={group.key}
                      onClick={() => setSelectedGroupKey(group.key)}
                      className={`cursor-pointer hover:bg-slate-700/30 ${selectedGroup?.key === group.key ? 'bg-slate-700/40' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-100">{group.projectName}</div>
                        <div className="text-xs text-slate-400 mt-1">{group.datasetName}</div>
                      </td>
                      <td className="px-6 py-4 uppercase text-xs font-semibold text-blue-300">{group.type}</td>
                      <td className="px-6 py-4 text-slate-200 font-semibold">{group.pendingCount}</td>
                      <td className="px-6 py-4 text-slate-300">{group.annotatorSummary.length}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/90 text-slate-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (group.firstTask?._id) navigate(`/reviewer/tasks/${group.firstTask._id}?projectId=${group.projectId}&datasetId=${group.datasetId}`);
                          }}
                        >
                          <ArrowRightIcon />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-5 space-y-4 bg-[#172033]">
              <div className="rounded-xl border border-slate-700 bg-[#0f172a] p-4">
                <p className="text-xs text-slate-400 uppercase mb-1">Selected Batch</p>
                <div className="text-slate-100 font-semibold">{selectedGroup?.projectName || '—'}</div>
                <div className="text-xs text-slate-400">{selectedGroup?.datasetName || '—'}</div>
                <div className="mt-2 text-sm text-slate-300">Type: <span className="uppercase">{selectedGroup?.type || '—'}</span></div>
                <div className="text-sm text-slate-300">Pending: {selectedGroup?.pendingCount || 0}</div>
                <button
                  disabled={!selectedGroup?.firstTask?._id}
                  onClick={() => selectedGroup?.firstTask?._id && navigate(`/reviewer/tasks/${selectedGroup.firstTask._id}?projectId=${selectedGroup.projectId}&datasetId=${selectedGroup.datasetId}`)}
                  className="mt-3 w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
                >
                  Start Reviewing Batch
                </button>
              </div>

              <div className="rounded-xl border border-slate-700 bg-[#0f172a] p-4">
                <p className="text-xs text-slate-400 uppercase mb-2">Grouped by Annotator</p>
                {selectedGroup?.annotatorSummary?.length ? selectedGroup.annotatorSummary.map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0">
                    <span className="text-sm text-slate-200">{name}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-200">{count} tasks</span>
                  </div>
                )) : <p className="text-sm text-slate-500">No annotator data.</p>}
              </div>

              <div className="rounded-xl border border-slate-700 bg-[#0f172a] p-4 text-xs text-slate-400">
                <div className="flex items-center gap-2 text-slate-300 font-semibold mb-2"><FolderIcon fontSize="small" /> UX note</div>
                Reviewer giờ vào theo <b>Project/Batch</b>, không phải click từng task từ dashboard.
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0f172a]">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Project & File</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Annotator</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Reviewed At</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {reviewedRows.length === 0 ? (
                  <tr><td colSpan={5} className="py-16 text-center text-slate-400">No reviewed tasks.</td></tr>
                ) : reviewedRows.map((task) => (
                  <tr key={task._id} className="hover:bg-slate-700/30 cursor-pointer" onClick={() => navigate(`/reviewer/tasks/${task._id}`)}>
                    <td className="px-6 py-4">
                      <div className="text-slate-100 font-semibold">{task.projectId?.name || 'Unknown Project'}</div>
                      <div className="text-xs text-slate-400 mt-1">{task.dataItem?.filename}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-200">{task.annotatorId?.fullName || task.annotatorId?.username || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${task.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300 text-sm">{task.reviewedAt ? new Date(task.reviewedAt).toLocaleString() : '-'}</td>
                    <td className="px-6 py-4 text-right"><ArrowRightIcon className="text-slate-300" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewerDashboard;
