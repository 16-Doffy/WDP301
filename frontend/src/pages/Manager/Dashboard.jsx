// === MANAGER DASHBOARD - Dataset-Centric Overview ===
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const getAuthToken = () => sessionStorage.getItem('token');

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (m < 1) return 'Vua xong';
  if (m < 60) return `${m}p truoc`;
  if (h < 24) return `${h}h truoc`;
  if (days < 30) return `${days}ngay truoc`;
  return formatDate(dateStr);
};

const StatCard = ({ label, value, hint }) => (
  <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 shadow-lg transition hover:border-gray-600 hover:scale-[1.02]">
    <p className="text-sm text-gray-400">{label}</p>
    <p className="mt-2 text-3xl font-bold text-gray-100">{value}</p>
    {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
  </div>
);

const ProgressBar = ({ value, max, color = '#3b82f6', label }) => {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  return (
    <div className="w-full">
      {label && <div className="mb-1 flex justify-between text-xs text-gray-400"><span>{label}</span><span>{pct}%</span></div>}
      <div className="h-2 w-full rounded-full bg-gray-700">
        <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

const TypeBadge = ({ type }) => {
  const map = {
    image: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'IMAGE' },
    audio: { bg: 'bg-pink-500/15', text: 'text-pink-400', label: 'AUDIO' },
    text: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'TEXT' },
  };
  const t = map[type] || map.image;
  return <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${t.bg} ${t.text}`}>{t.label}</span>;
};

const ChartBar = ({ label, value, max, color = '#3b82f6' }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 truncate text-xs text-gray-400">{label}</span>
      <div className="flex-1 h-5 rounded bg-gray-700 overflow-hidden relative">
        <div className="h-full rounded flex items-center px-1 transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }}>
          {pct > 15 && <span className="text-[10px] font-bold text-white truncate">{value}</span>}
        </div>
        {pct <= 15 && value > 0 && <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] font-bold" style={{ color }}>{value}</span>}
      </div>
      <span className="w-8 text-right text-xs text-gray-500">{pct}%</span>
    </div>
  );
};

const ManagerDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const navigate = useNavigate();
  const { user } = useAuth();
  const managerName = user?.fullName || user?.username || 'Manager';

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const token = getAuthToken();
        const headers = { Authorization: `Bearer ${token}` };
        const [projectsRes, datasetsRes] = await Promise.all([
          axios.get(`${API_URL}/api/projects`, { headers }),
          axios.get(`${API_URL}/api/datasets`, { headers }),
        ]);
        const projectList = projectsRes.data || [];
        const datasetList = datasetsRes.data || [];

        const statusEntries = await Promise.all(
          datasetList.map(async (ds) => {
            try {
              const s = await axios.get(`${API_URL}/api/datasets/${ds._id}/status`, { headers });
              return [ds._id, s.data];
            } catch { return [ds._id, null]; }
          })
        );
        const statusMap = Object.fromEntries(statusEntries);

        const activities = [];
        datasetList.forEach(ds => activities.push({ type: 'dataset', name: ds.name, time: ds.createdAt, detail: `${ds.totalItems || ds.files?.length || 0} items` }));
        projectList.forEach(p => activities.push({ type: 'project', name: p.name, time: p.createdAt, detail: p.status }));
        activities.sort((a, b) => new Date(b.time) - new Date(a.time));
        setRecentActivity(activities.slice(0, 10));

        let totalRawItems = 0, totalApproved = 0, pendingTasks = 0, totalApproveVotes = 0, totalRejectVotes = 0;
        Object.values(statusMap).forEach(s => {
          if (!s) return;
          totalRawItems += s.totalRawItems || 0;
          totalApproved += s.counts?.approved || 0;
          pendingTasks += (s.counts?.submitted || 0) + (s.counts?.pendingAnnotation || 0);
          totalApproveVotes += s.votes?.approveVotes || 0;
          totalRejectVotes += s.votes?.rejectVotes || 0;
        });

        const totalReviewed = totalApproveVotes + totalRejectVotes;
        const approvalRate = totalReviewed > 0 ? Number(((totalApproveVotes / totalReviewed) * 100).toFixed(1)) : 0;
        const completionRate = totalRawItems > 0 ? Number(((totalApproved / totalRawItems) * 100).toFixed(1)) : 0;

        const datasetBreakdown = datasetList.map(ds => {
          const s = statusMap[ds._id];
          const rawItems = s?.totalRawItems || ds.totalItems || ds.files?.length || 0;
          const approved = s?.counts?.approved || 0;
          const rejected = s?.counts?.rejected || 0;
          const submitted = s?.counts?.submitted || 0;
          const pending = s?.counts?.pendingAnnotation || 0;
          const pct = rawItems > 0 ? Math.round((approved / rawItems) * 100) : 0;
          const labelDist = {};
          (s?.finalItems || []).forEach(item => {
            (item.labels?.objects || item.labels?.spans || []).forEach(l => { const k = l.label || l.text || 'unknown'; labelDist[k] = (labelDist[k] || 0) + 1; });
          });
          let dsStatus = 'not_started';
          if (rawItems > 0 && approved > 0 && pct >= 100) dsStatus = 'ready';
          else if (submitted > 0) dsStatus = 'under_review';
          else if (pending > 0 || submitted > 0) dsStatus = 'annotating';
          return { _id: ds._id, name: ds.name, type: ds.type, rawItems, approved, rejected, submitted, pending, pct, votes: s?.votes || {}, labelDist, dsStatus, createdAt: ds.createdAt };
        });

        const annotatorPerf = {};
        Object.values(statusMap).forEach(s => {
          (s?.annotators || []).forEach(ann => {
            if (!annotatorPerf[ann.annotatorId]) annotatorPerf[ann.annotatorId] = { name: ann.annotatorName, total: 0, approved: 0, rejected: 0, pending: 0, passRate: 0 };
            annotatorPerf[ann.annotatorId].total += ann.total;
            annotatorPerf[ann.annotatorId].approved += ann.approved;
            annotatorPerf[ann.annotatorId].rejected += ann.rejected;
            annotatorPerf[ann.annotatorId].pending += ann.pending;
          });
        });
        Object.values(annotatorPerf).forEach(a => { const r = a.approved + a.rejected; a.passRate = r > 0 ? Number(((a.approved / r) * 100).toFixed(1)) : 0; });
        const annotatorPerfList = Object.values(annotatorPerf).sort((a, b) => b.approved - a.approved);

        const globalLabelDist = {};
        datasetBreakdown.forEach(ds => Object.entries(ds.labelDist).forEach(([k, v]) => { globalLabelDist[k] = (globalLabelDist[k] || 0) + v; }));
        const topLabels = Object.entries(globalLabelDist).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const maxLabelCount = topLabels[0]?.[1] || 1;

        setStats({ totalProjects: projectList.length, activeProjects: projectList.filter(p => p.status === 'active').length, totalDatasets: datasetList.length, totalRawItems, totalApproved, pendingTasks, approvalRate, completionRate, annotatorPerf: annotatorPerfList, topLabels, maxLabelCount, datasetBreakdown, totalReviewed });
      } catch (error) { console.error('Error fetching dashboard data:', error); }
      finally { setLoading(false); }
    };
    fetchAll();
  }, []);

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
    </div>
  );

  const s = stats || {};

  return (
    <div className="min-h-screen bg-slate-900 text-gray-200 p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 shadow-lg">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Chao muong tro lai, {managerName}</h1>
              <p className="mt-1 text-sm text-gray-400">Tong quan ve datasets, projects va chat luong gan nhan</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => navigate('/manager/projects')} className="rounded-lg bg-gray-700 px-4 py-2 text-gray-200 transition hover:bg-gray-600 font-medium text-sm">Projects</button>
              <button onClick={() => navigate('/manager/datasets')} className="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 font-medium text-sm">Datasets</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Datasets" value={s.totalDatasets || 0} hint="Tong so bo du lieu" />
          <StatCard label="Raw Items" value={s.totalRawItems || 0} hint="Tong so item chua nhan" />
          <StatCard label="Da Duyet" value={s.totalApproved || 0} hint="Items da phe duyet" />
          <StatCard label="Cho Review" value={s.pendingTasks || 0} hint="Tasks cho kiem duyet" />
          <StatCard label="Hoan Thanh" value={`${s.completionRate || 0}%`} hint="Ty le hoan thanh" />
          <StatCard label="Ty Le Duyet" value={`${s.approvalRate || 0}%`} hint="Ty le duyet / da review" />
        </div>

        <div className="flex gap-1 rounded-lg bg-gray-800/50 p-1 border border-gray-700">
          {[
            { key: 'overview', label: 'Tong quan' },
            { key: 'datasets', label: 'Chi tiet Datasets' },
            { key: 'annotators', label: 'Annotator' },
            { key: 'labels', label: 'Phan bo Nhan' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-all ${activeTab === tab.key ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}`}>{tab.label}</button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-xl border border-gray-700 bg-gray-800 p-5 shadow-lg">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-100">Tinh trang Datasets</h2>
                <span className="text-xs text-gray-500">{s.datasetBreakdown?.length || 0} datasets</span>
              </div>
              <div className="space-y-3">
                {(s.datasetBreakdown || []).map(ds => (
                  <div key={ds._id} className="rounded-lg border border-gray-700 bg-gray-900/50 p-4 transition hover:border-gray-600 cursor-pointer" onClick={() => navigate('/manager/datasets')}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-bold text-gray-100 truncate">{ds.name}</span>
                        <TypeBadge type={ds.type} />
                      </div>
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${ds.dsStatus === 'ready' ? 'bg-emerald-500/20 text-emerald-400' : ds.dsStatus === 'under_review' ? 'bg-amber-500/20 text-amber-400' : ds.dsStatus === 'annotating' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {ds.dsStatus === 'ready' ? 'Ready' : ds.dsStatus === 'under_review' ? 'Review' : ds.dsStatus === 'annotating' ? 'Annotating' : 'Not started'}
                      </span>
                    </div>
                    <ProgressBar value={ds.approved} max={ds.rawItems} color={ds.dsStatus === 'ready' ? '#22c55e' : '#3b82f6'} label={`${ds.approved} / ${ds.rawItems} items`} />
                    <div className="mt-2 flex gap-4 text-xs text-gray-500 flex-wrap">
                      <span>Rejected: {ds.rejected}</span>
                      <span>In review: {ds.submitted + ds.pending}</span>
                      <span>Votes: {(ds.votes?.approveVotes || 0) + (ds.votes?.rejectVotes || 0)}/{ds.votes?.totalVotes || 0}</span>
                      <span>{timeAgo(ds.createdAt)}</span>
                    </div>
                  </div>
                ))}
                {(!s.datasetBreakdown || s.datasetBreakdown.length === 0) && (
                  <div className="text-center py-8 text-gray-500">Chua co dataset nao. <button onClick={() => navigate('/manager/datasets')} className="text-blue-400 hover:underline">Tao dataset moi</button></div>
                )}
              </div>
            </div>
            <div className="space-y-5">
              <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 shadow-lg">
                <h2 className="mb-4 text-lg font-semibold text-gray-100">Projects</h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-gray-900/50"><span className="text-sm text-gray-400">Tong Projects</span><span className="text-lg font-bold text-gray-100">{s.totalProjects || 0}</span></div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-emerald-500/10"><span className="text-sm text-emerald-400">Active</span><span className="text-lg font-bold text-emerald-400">{s.activeProjects || 0}</span></div>
                </div>
                <button onClick={() => navigate('/manager/projects')} className="mt-4 w-full rounded-lg border border-gray-600 bg-gray-700/50 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-700 hover:text-white">Quan ly Projects</button>
              </div>
              <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 shadow-lg">
                <h2 className="mb-4 text-lg font-semibold text-gray-100">Hoat dong gan day</h2>
                <div className="space-y-2">
                  {recentActivity.slice(0, 6).map((a, i) => (
                    <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-800 last:border-0">
                      <div className={`mt-0.5 shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs ${a.type === 'dataset' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>{a.type === 'dataset' ? 'DS' : 'PR'}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-200 truncate font-medium">{a.name}</p>
                        <p className="text-xs text-gray-500">{a.detail} - {timeAgo(a.time)}</p>
                      </div>
                    </div>
                  ))}
                  {recentActivity.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Chua co hoat dong nao</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'datasets' && (
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 shadow-lg">
            <h2 className="mb-5 text-lg font-semibold text-gray-100">Chi tiet tung Dataset</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-700 text-left text-xs text-gray-400 uppercase tracking-wider">
                    <th className="pb-3 pr-4 font-semibold">Dataset</th>
                    <th className="pb-3 pr-4 font-semibold">Loai</th>
                    <th className="pb-3 pr-4 font-semibold">Items</th>
                    <th className="pb-3 pr-4 font-semibold">Da duyet</th>
                    <th className="pb-3 pr-4 font-semibold">Tu choi</th>
                    <th className="pb-3 pr-4 font-semibold">Tien do</th>
                    <th className="pb-3 font-semibold">Ngay tao</th>
                  </tr>
                </thead>
                <tbody>
                  {(s.datasetBreakdown || []).map(ds => (
                    <tr key={ds._id} className="border-b border-gray-800/60 hover:bg-gray-800/30 transition">
                      <td className="py-3 pr-4"><span className="text-sm font-semibold text-gray-200">{ds.name}</span></td>
                      <td className="py-3 pr-4"><TypeBadge type={ds.type} /></td>
                      <td className="py-3 pr-4 text-sm text-gray-300">{ds.rawItems}</td>
                      <td className="py-3 pr-4 text-sm text-emerald-400 font-semibold">{ds.approved}</td>
                      <td className="py-3 pr-4 text-sm text-red-400 font-semibold">{ds.rejected}</td>
                      <td className="py-3 pr-4 w-36"><ProgressBar value={ds.approved} max={ds.rawItems} color={ds.dsStatus === 'ready' ? '#22c55e' : '#3b82f6'} /></td>
                      <td className="py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(ds.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!s.datasetBreakdown || s.datasetBreakdown.length === 0) && <div className="text-center py-12 text-gray-500">Chua co dataset nao</div>}
            </div>
          </div>
        )}

        {activeTab === 'annotators' && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 shadow-lg">
              <h2 className="mb-5 text-lg font-semibold text-gray-100">Annotator Performance</h2>
              <div className="space-y-4">
                {(s.annotatorPerf || []).map((ann, i) => (
                  <div key={ann.annotatorId || i} className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-gray-200">{ann.name}</span>
                      <span className={`rounded px-2 py-0.5 text-xs font-bold ${ann.passRate >= 80 ? 'bg-emerald-500/20 text-emerald-400' : ann.passRate >= 60 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>{ann.passRate}% pass rate</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs text-gray-400 mb-2">
                      <div className="text-center p-1.5 rounded bg-gray-800"><div className="text-lg font-bold text-gray-200">{ann.total}</div><div>Total</div></div>
                      <div className="text-center p-1.5 rounded bg-emerald-500/10"><div className="text-lg font-bold text-emerald-400">{ann.approved}</div><div>Approved</div></div>
                      <div className="text-center p-1.5 rounded bg-red-500/10"><div className="text-lg font-bold text-red-400">{ann.rejected}</div><div>Rejected</div></div>
                      <div className="text-center p-1.5 rounded bg-amber-500/10"><div className="text-lg font-bold text-amber-400">{ann.pending}</div><div>Pending</div></div>
                    </div>
                    <ProgressBar value={ann.approved} max={ann.total} color={ann.passRate >= 80 ? '#22c55e' : ann.passRate >= 60 ? '#f59e0b' : '#ef4444'} />
                  </div>
                ))}
                {(!s.annotatorPerf || s.annotatorPerf.length === 0) && <div className="text-center py-8 text-gray-500">Chua co du lieu annotator</div>}
              </div>
            </div>
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 shadow-lg">
              <h2 className="mb-5 text-lg font-semibold text-gray-100">Tong quan Review Votes</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-center"><div className="text-2xl font-bold text-emerald-400">{s.approvalRate || 0}%</div><div className="text-xs text-emerald-400/70 mt-1">Ty le duyet</div></div>
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center"><div className="text-2xl font-bold text-red-400">{s.totalReviewed > 0 ? (100 - (s.approvalRate || 0)).toFixed(1) : 0}%</div><div className="text-xs text-red-400/70 mt-1">Ty le tu choi</div></div>
                </div>
                {(s.datasetBreakdown || []).length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-3">Votes theo Dataset</h3>
                    <div className="space-y-2">
                      {(s.datasetBreakdown || []).slice(0, 5).map(ds => {
                        const total = ds.votes?.totalVotes || 0;
                        const approved = ds.votes?.approveVotes || 0;
                        const pct = total > 0 ? Math.round((approved / total) * 100) : 0;
                        return (
                          <div key={ds._id} className="text-sm">
                            <div className="flex justify-between text-xs text-gray-400 mb-1"><span className="truncate max-w-[150px]">{ds.name}</span><span>{approved}/{total}</span></div>
                            <div className="h-2 w-full rounded-full bg-gray-700"><div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} /></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'labels' && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 shadow-lg">
              <h2 className="mb-5 text-lg font-semibold text-gray-100">Phan bo Nhan (Tat ca)</h2>
              <div className="space-y-3">
                {(s.topLabels || []).map(([label, count], i) => {
                  const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'];
                  return <ChartBar key={label} label={label} value={count} max={s.maxLabelCount || 1} color={colors[i % colors.length]} />;
                })}
                {(!s.topLabels || s.topLabels.length === 0) && <div className="text-center py-8 text-gray-500">Chua co nhan nao duoc gan</div>}
              </div>
            </div>
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 shadow-lg">
              <h2 className="mb-5 text-lg font-semibold text-gray-100">Phan bo Nhan theo Dataset</h2>
              <div className="space-y-4">
                {(s.datasetBreakdown || []).map(ds => {
                  const labels = Object.entries(ds.labelDist).sort((a, b) => b[1] - a[1]);
                  if (labels.length === 0) return null;
                  const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];
                  return (
                    <div key={ds._id} className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
                      <div className="flex items-center justify-between mb-3"><span className="text-sm font-semibold text-gray-200">{ds.name}</span><TypeBadge type={ds.type} /></div>
                      <div className="space-y-2">
                        {labels.slice(0, 5).map(([k, v], i) => <ChartBar key={k} label={k} value={v} max={labels[0]?.[1] || 1} color={colors[i % colors.length]} />)}
                        {labels.length > 5 && <p className="text-xs text-gray-500">+{labels.length - 5} nhan khac</p>}
                      </div>
                    </div>
                  );
                })}
                {(!s.datasetBreakdown || s.datasetBreakdown.length === 0) && <div className="text-center py-8 text-gray-500">Chua co dataset nao</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerDashboard;
