import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';

const fmtDate = (d) => {
  if (!d) return null;
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getProjStatus = (subs, allTasks) => {
  if (subs && subs.length > 0) {
    // grouped structure from /annotator-projects
    // backend uses: total, approved, doneCount (= approved tasks)
    let total = 0, done = 0;
    subs.forEach((s) => {
      total += s.total || 0;
      done += s.approved || s.doneCount || 0;
    });
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }
  // flat structure from /my-tasks
  const total = allTasks.length;
  const done = allTasks.filter(t => t.status === 'approved' || t.status === 'submitted').length;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
};

const ProjectCard = ({ project, onOpen }) => {
  const { total, done, pct } = getProjStatus(project.subtopics, project.tasks || []);
  const overdue = project.deadline && new Date(project.deadline) < new Date();
  const next = project.subtopics
    ? project.subtopics.find((s) => (s.approved || 0) < (s.total || 0))
    : (project.tasks || []).find(t => t.status !== 'approved' && t.status !== 'submitted');

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800 shadow-lg transition hover:border-gray-600 cursor-pointer" onClick={onOpen}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-semibold text-gray-100">{project.projectName}</h3>
            {project.deadline && <p className={`text-sm mt-1 ${overdue ? 'text-rose-400' : 'text-gray-400'}`}>Deadline: {fmtDate(project.deadline)}</p>}
          </div>
          <span className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${overdue ? 'bg-rose-500/10 text-rose-400' : 'bg-gray-700 text-gray-400'}`}>
            {project.subtopics.length} subtopic{project.subtopics.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
            <span>Progress</span>
            <span className="text-gray-200 font-medium">{done}/{total} tasks</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-700">
            <div className={`h-2 rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 text-right text-xs text-gray-500">{pct}%</div>
        </div>
        {next && (
          <div className="mt-3 rounded-lg bg-blue-500/10 px-3 py-2 text-xs text-blue-300">
            {next.subtopicName
              ? `Next: ${next.subtopicName} (${next.approved || 0}/${next.total || 0})`
              : `Next: ${next.dataItem?.originalName || next.dataItem?.filename || 'task'}`}
          </div>
        )}
      </div>
    </div>
  );
};

const SubtopicRow = ({ sub, onStart }) => {
  const totalTasks = sub.total || 0;
  const completedTasks = sub.approved || 0;
  const done = completedTasks >= totalTasks && totalTasks > 0;
  const inProg = completedTasks > 0 && completedTasks < totalTasks;
  let btnText, btnColor;
  if (done) { btnText = 'Xem lai'; btnColor = 'bg-emerald-600 hover:bg-emerald-700'; }
  else if (inProg) { btnText = 'Tiep tuc'; btnColor = 'bg-blue-600 hover:bg-blue-700'; }
  else { btnText = 'Bat dau'; btnColor = 'bg-violet-600 hover:bg-violet-700'; }
  const pct = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-200">{sub.subtopicName || sub.name || 'Subtopic'}</p>
        <p className="text-xs text-gray-400 mt-1">{sub.approved || 0}/{sub.total || 0} tasks</p>
        <div className="mt-1 h-1.5 w-full rounded-full bg-gray-700">
          <div className={`h-1.5 rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <button onClick={() => onStart(sub)} className={`ml-4 shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition ${btnColor}`}>
        {btnText}
      </button>
    </div>
  );
};

const ProjectModal = ({ project, onClose, onStart }) => {
  if (!project) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-gray-700 p-5">
          <div>
            <h3 className="text-xl font-bold text-gray-100">{project.projectName}</h3>
            {project.deadline && <p className={`mt-1 text-sm ${new Date(project.deadline) < new Date() ? 'text-rose-400' : 'text-gray-400'}`}>Deadline: {fmtDate(project.deadline)}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg border border-gray-600 px-3 py-1 text-sm text-gray-300 hover:bg-gray-800">Dong</button>
        </div>
        <div className="max-h-96 overflow-y-auto p-5 space-y-3">
          {project.subtopics.map((sub) => <SubtopicRow key={sub.subtopicId} sub={sub} onStart={onStart} />)}
        </div>
        {project.guidelines && (
          <div className="border-t border-gray-700 p-5">
            <h4 className="text-sm font-semibold text-gray-300 mb-2">Guidelines</h4>
            <p className="text-sm text-gray-400 whitespace-pre-wrap max-h-32 overflow-y-auto">{project.guidelines}</p>
          </div>
        )}
      </div>
    </div>
  );
};

const AnnotatorDashboard = () => {
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => { fetchProjects(); }, []);

  const fetchProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/api/tasks/annotator-projects`);
      setProjects(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Khong tai duoc project');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (sub) => {
    try {
      const res = await axios.get(`${API_URL}/api/tasks/my-tasks`, { params: { subtopicId: sub.subtopicId } });
      const tasks = res.data || [];
      const target = tasks.find((t) => t.status !== 'approved' && t.status !== 'submitted') || tasks[0];
      if (target) navigate(`/annotator/tasks/${target._id}`);
      else alert('Khong co task nao trong subtopic nay.');
    } catch {
      alert('Khong tai duoc task.');
    }
  };

  const filtered = projects.filter((p) => {
    if (filter === 'all') return true;
    const { total, done } = getProjStatus(p.subtopics, p.tasks || []);
    if (filter === 'completed') return done === total && total > 0;
    if (filter === 'active') return done < total;
    if (filter === 'overdue') return p.deadline && new Date(p.deadline) < new Date();
    return true;
  });

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-900"><div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" /></div>;

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-gray-200">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">My Projects</h1>
            <p className="mt-1 text-sm text-gray-400">{projects.length} project duoc phan cong</p>
          </div>
          <div className="flex gap-2">
            {['all', 'active', 'completed', 'overdue'].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {error && <div className="rounded-xl border border-rose-700/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-12 text-center">
            <p className="text-gray-400">{filter === 'all' ? 'Ban chua co project nao duoc phan cong.' : `Khong co project nao matching "${filter}".`}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => <ProjectCard key={p.projectId} project={p} onOpen={() => setSelected(p)} />)}
          </div>
        )}
      </div>
      {selected && <ProjectModal project={selected} onClose={() => setSelected(null)} onStart={handleStart} />}
    </div>
  );
};

export default AnnotatorDashboard;