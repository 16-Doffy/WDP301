import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const StatCard = ({ title, value, hint }) => (
  <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg transition hover:border-gray-600">
    <p className="text-sm text-gray-400">{title}</p>
    <p className="mt-2 text-3xl font-bold text-gray-100">{value}</p>
    <p className="mt-2 text-xs text-gray-400">{hint}</p>
  </div>
);

const AnnotatorOverview = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0, overdue: 0 });
  const [penalties, setPenalties] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qualityScore, setQualityScore] = useState(100);
  const navigate = useNavigate();

  const userId = user?._id || user?.id;

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) {
        setError('Không xác định được tài khoản hiện tại. Vui lòng đăng xuất và đăng nhập lại.');
        setLoading(false);
        return;
      }

      try {
        const [tasksRes, penaltiesRes, rewardsRes, scoreRes] = await Promise.all([
          axios.get(`${API_URL}/api/tasks/my-tasks`),
          axios.get(`${API_URL}/api/penalties/user/${userId}`),
          axios.get(`${API_URL}/api/penalties/rewards/${userId}`),
          axios.get(`${API_URL}/api/penalties/score/${userId}`),
        ]);

        const tasks = tasksRes.data || [];
        const now = new Date();
        const total = tasks.length;
        const completed = tasks.filter((t) => t.status === 'approved').length;
        const inProgress = tasks.filter((t) => t.status === 'in_progress' || t.status === 'submitted' || t.status === 'rejected').length;
        const overdue = tasks.filter((t) => t.projectId?.deadline && new Date(t.projectId.deadline) < now && t.status !== 'approved').length;

        setStats({ total, completed, inProgress, overdue });
        setPenalties((penaltiesRes.data || []).slice(0, 6));
        setRewards((rewardsRes.data || []).slice(0, 6));
        setQualityScore(Number(scoreRes?.data?.qualityScore ?? 100));
      } catch (err) {
        if (err.response?.status === 403) {
          setError('Bạn không có quyền truy cập dữ liệu. Vui lòng đăng nhập đúng tài khoản Annotator hoặc liên hệ Manager.');
        } else {
          setError(err.response?.data?.message || 'Không tải được dữ liệu dashboard. Vui lòng thử lại sau.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  const totals = useMemo(() => {
    const totalPenalty = penalties.reduce((sum, p) => sum + (Number(p.scoreDeduction) || 0), 0);
    const totalReward = rewards.reduce((sum, r) => sum + (Number(r.scoreBonus) || 0), 0);
    return { totalPenalty, totalReward };
  }, [penalties, rewards]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
      </div>
    );
  }

  const qualityScoreDisplay = Number.isFinite(qualityScore) ? qualityScore : 100;
  const qualityScoreColor =
    qualityScoreDisplay >= 80 ? 'text-emerald-300' : qualityScoreDisplay >= 60 ? 'text-amber-300' : 'text-rose-300';

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-gray-200">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Hello, Annotator</h1>
              <p className="mt-1 text-sm text-gray-400">Overview of your task workload and progress.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-gray-900 px-4 py-2 border border-gray-700">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Quality Score</p>
                <p className={`text-xl font-extrabold leading-tight ${qualityScoreColor}`}>{qualityScoreDisplay.toFixed(1)}</p>
              </div>
              <button
                onClick={() => navigate('/annotator/tasks')}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
              >
                Open My Tasks
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-700/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Tasks" value={stats.total} hint="All assigned tasks" />
          <StatCard title="In Progress" value={stats.inProgress} hint="Working / needs revision" />
          <StatCard title="Completed" value={stats.completed} hint="Approved tasks" />
          <StatCard title="Overdue" value={stats.overdue} hint="Past project deadline" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-100">Điểm phạt từ Manager</h3>
              <span className="rounded bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-400">-{totals.totalPenalty} điểm</span>
            </div>

            {penalties.length === 0 ? (
              <p className="text-sm text-gray-400">Hiện chưa có penalty nào.</p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {penalties.map((p) => (
                  <div key={p._id} className="rounded-lg border border-rose-700/30 bg-rose-500/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold capitalize text-gray-200">{p.level || 'penalty'}</span>
                      <span className="text-xs font-bold text-rose-300">-{p.scoreDeduction || 0} điểm</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-300">{p.reason || 'Không có mô tả lý do.'}</p>
                    <p className="mt-1 text-xs text-gray-500">{new Date(p.createdAt).toLocaleString('vi-VN')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-100">Điểm thưởng từ Manager</h3>
              <span className="rounded bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-400">+{totals.totalReward} điểm</span>
            </div>

            {rewards.length === 0 ? (
              <p className="text-sm text-gray-400">Hiện chưa có reward nào.</p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {rewards.map((r) => (
                  <div key={r._id} className="rounded-lg border border-emerald-700/30 bg-emerald-500/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold capitalize text-gray-200">{r.type || 'reward'}</span>
                      <span className="text-xs font-bold text-emerald-300">+{r.scoreBonus || 0} điểm</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-300">{r.reason || 'Không có mô tả lý do.'}</p>
                    <p className="mt-1 text-xs text-gray-500">{new Date(r.createdAt).toLocaleString('vi-VN')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnotatorOverview;
