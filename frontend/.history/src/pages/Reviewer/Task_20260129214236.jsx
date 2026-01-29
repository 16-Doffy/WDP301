
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft as BackIcon,
  HelpOutline as HelpIcon,
  Keyboard as KeyboardIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  InfoOutlined as InfoIcon,
  Compare as CompareIcon,
  History as HistoryIcon,
  Shield as QualityIcon,
  ErrorOutline as ErrorIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';
import ImageViewer from '../../components/ImageViewer';

const ReviewerTask = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [reviewComments, setReviewComments] = useState('');
  const [errorCategory, setErrorCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [reviewNotes, setReviewNotes] = useState([]);
  const [viewMode, setViewMode] = useState('side-by-side');
  const [autoNext, setAutoNext] = useState(false);

  useEffect(() => {
    fetchTask();
  }, [id]);

  const fetchTask = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/tasks/${id}`);
      setTask(response.data);
      setReviewNotes(response.data.reviewNotes || []);
      setReviewComments(response.data.reviewComments || '');
      setErrorCategory(response.data.errorCategory || '');
    } catch (error) {
      console.error('Error fetching task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = useCallback(async () => {
    if (window.confirm('Are you sure you want to approve this task? It will be marked as complete and final.')) {
      setProcessing(true);
      try {
        const payloadNotes = reviewNotes.map(n => ({
          bbox: n.bbox,
          label: n.label,
          comment: n.comment
        }));
        await axios.post(`${API_URL}/api/reviews/${id}/approve`, {
          reviewComments: reviewComments.trim() || undefined,
          reviewNotes: payloadNotes,
        });
        navigate('/reviewer/tasks');
      } catch (error) {
        alert(error.response?.data?.message || 'Error approving task');
      } finally {
        setProcessing(false);
      }
    }
  }, [id, reviewComments, reviewNotes, navigate]);

  const handleReject = useCallback(async () => {
    if (!reviewComments.trim()) {
      alert('Please enter feedback before rejecting.');
      return;
    }
    if (!reviewNotes || reviewNotes.length === 0) {
      alert('You must add at least one visual note on the image identifying the error.');
      return;
    }

    if (window.confirm('Are you sure you want to reject this task? The annotator will need to re-work it.')) {
      setProcessing(true);
      try {
        const payloadNotes = reviewNotes.map(n => ({
          bbox: n.bbox,
          label: n.label,
          comment: n.comment
        }));
        await axios.post(`${API_URL}/api/reviews/${id}/reject`, {
          reviewComments: reviewComments.trim(),
          errorCategory: errorCategory || 'other',
          reviewNotes: payloadNotes,
        });
        navigate('/reviewer/tasks');
      } catch (error) {
        alert(error.response?.data?.message || 'Error rejecting task');
      } finally {
        setProcessing(false);
      }
    }
  }, [id, reviewComments, reviewNotes, errorCategory, navigate]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (task?.status === 'approved' || task?.status === 'rejected') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleApprove();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        if (reviewComments.trim() && reviewNotes.length > 0) {
          handleReject();
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [task, reviewComments, reviewNotes, handleApprove, handleReject]);

  const isReviewed = task?.status === 'approved' || task?.status === 'rejected';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <div className="relative w-16 h-16 mb-4">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-100 rounded-full"></div>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="text-gray-500 font-medium animate-pulse">Loading Audit Environment...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden font-sans">
      {/* Top Navigation Bar */}
      <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate('/reviewer/tasks')}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors group"
          >
            <div className="p-1 rounded-lg group-hover:bg-gray-100">
              <BackIcon fontSize="small" />
            </div>
            <span className="text-sm font-bold tracking-tight">DASHBOARD</span>
          </button>
          <div className="h-6 w-px bg-gray-200"></div>
          <div className="flex flex-col">
            <h1 className="text-sm font-black text-gray-900 leading-none">AUDIT ENGINE <span className="text-blue-600">v2.4</span></h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Reviewing: {task?.projectId?.name || 'Loading Project...'}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'side-by-side' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <CompareIcon fontSize="inherit" /> SIDE-BY-SIDE
            </button>
            <button
              onClick={() => setViewMode('overlay')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'overlay' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <CompareIcon fontSize="inherit" className="rotate-90" /> FULL CANVAS
            </button>
          </div>
          <div className="h-6 w-px bg-gray-200 mx-2"></div>
          <div className="flex items-center gap-3">
            <button className="p-2 text-gray-400 hover:text-gray-600"><KeyboardIcon /></button>
            <button className="p-2 text-gray-400 hover:text-gray-600"><HelpIcon /></button>
            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isReviewed ? (task.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600') : 'bg-amber-50 text-amber-600 animate-pulse'}`}>
              {task?.status || 'UNDER REVIEW'}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Quick Switcher */}
        <aside className="w-80 bg-white border-r border-gray-100 flex flex-col shrink-0 z-10 transition-transform duration-300">
          <div className="p-5 border-b border-gray-50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Priority Queue</h3>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search tasks..."
                className="w-full bg-gray-50 border-none rounded-xl py-2 px-4 text-xs focus:ring-2 focus:ring-blue-100 placeholder:text-gray-300"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <div className="p-4 bg-blue-50/50 border-2 border-blue-500/20 rounded-2xl cursor-default">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] flex items-center gap-1 font-black text-blue-600 uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Current Task
                </span>
                <span className="text-[10px] text-gray-400 font-bold">2M AGO</span>
              </div>
              <h4 className="text-sm font-bold text-gray-900 truncate">#{id?.substring(0, 10).toUpperCase()}</h4>
              <p className="text-xs text-gray-500 mt-1">{task?.dataItem?.filename}</p>
              <div className="mt-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">
                  {(task?.annotatorId?.fullName || task?.annotatorId?.username || 'U').charAt(0).toUpperCase()}
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Annotator: {task?.annotatorId?.fullName || task?.annotatorId?.username}</span>
              </div>
            </div>

            {/* Queue Mock Items */}
            {[1, 2, 3].map(i => (
              <div key={i} className="p-4 rounded-2xl border border-transparent hover:bg-gray-50 transition-colors group cursor-pointer">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">UP NEXT</span>
                  <span className="text-[10px] text-gray-400 font-bold">{(i + 1) * 5}M AGO</span>
                </div>
                <h4 className="text-sm font-bold text-gray-400 group-hover:text-gray-900 transition-colors truncate">#8402{i}-X921</h4>
                <p className="text-xs text-gray-300 group-hover:text-gray-500">batch_processing_file_00{i}.jpg</p>
              </div>
            ))}
          </div>
          <div className="p-4 bg-gray-50/50 border-t border-gray-100">
            <div className="flex items-center justify-between text-[10px] font-black text-gray-400">
              <span>QUEUE PROGRESS</span>
              <span>12/48 DONE</span>
            </div>
            <div className="mt-2 w-full h-1 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 w-1/4"></div>
            </div>
          </div>
        </aside>

        {/* Center - Canvas Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-gray-100/50 overflow-hidden">
          <div className="flex-1 p-8 overflow-y-auto">
            <div className={`grid gap-8 ${viewMode === 'side-by-side' ? 'grid-cols-2' : 'grid-cols-1 mx-auto max-w-5xl'}`}>

              {/* Reference/Guideline Canvas */}
              {viewMode === 'side-by-side' && (
                <div className="space-y-4 animate-in fade-in duration-500">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <InfoIcon fontSize="inherit" /> Quality Reference
                    </h3>
                    <div className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-black">STRICT MODE</div>
                  </div>
                  <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-200/50 aspect-video relative overflow-hidden group">
                    {task?.dataItem?.mimeType?.startsWith('image/') ? (
                      <ImageViewer
                        imageUrl={`${API_URL}/${task.dataItem.path}`}
                        annotations={[]}
                        labelSet={task?.projectId?.labelSet || []}
                        reviewNotes={[]}
                        readOnly={true}
                        maxHeight="100%"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-300">Non-Image Data</div>
                    )}
                    <div className="absolute bottom-6 left-6 right-6">
                      <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-white shadow-lg translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Standard 4.2: Edge Tightness</p>
                        <p className="text-[11px] text-gray-600 leading-relaxed font-medium">Maintain less than 2px gap between object boundary and label edge. Zoom to 400% for verification if unsure.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Annotation Output Canvas */}
              <div className="space-y-4 animate-in fade-in slide-in-from-top duration-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <QualityIcon fontSize="inherit" className="text-blue-500" /> Annotator Result
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded uppercase">94.8% Confidence</span>
                    <span className="text-[10px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded uppercase">{task?.labels?.objects?.length || 0} Entities</span>
                  </div>
                </div>
                <div className={`bg-white rounded-[2rem] p-6 shadow-2xl border border-white relative ${viewMode === 'side-by-side' ? 'aspect-video' : 'h-[75vh]'}`}>
                  {task?.dataItem?.mimeType?.startsWith('image/') ? (
                    <ImageViewer
                      imageUrl={`${API_URL}/${task.dataItem.path}`}
                      annotations={task?.labels?.objects?.map((obj, idx) => ({
                        id: idx,
                        bbox: obj.bbox,
                        label: obj.label,
                      })) || []}
                      labelSet={task?.projectId?.labelSet || []}
                      reviewNotes={reviewNotes}
                      readOnly={false}
                      maxHeight="100%"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">Loading Data Preview...</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Feedback Bar */}
          {!isReviewed && (
            <div className="bg-white border-t border-gray-200 px-10 py-6 shrink-0 z-20 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
              <div className="max-w-6xl mx-auto flex items-center gap-8">
                <div className="flex-1 relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <HistoryIcon className="text-gray-300 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={reviewComments}
                    onChange={(e) => setReviewComments(e.target.value)}
                    placeholder="Enter audit feedback or rejection reasoning..."
                    className="w-full bg-gray-50 border-2 border-transparent rounded-[1.5rem] py-4 pl-14 pr-6 text-sm font-medium focus:outline-none focus:border-blue-500/20 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300 shadow-inner"
                  />
                  {reviewNotes.length === 0 && reviewComments.trim() && (
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2 text-[10px] font-black text-rose-500 uppercase tracking-widest animate-pulse">
                      <ErrorIcon fontSize="inherit" /> Add Visual Note to Reject
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={handleReject}
                    disabled={processing || !reviewComments.trim() || reviewNotes.length === 0}
                    className="h-14 px-8 bg-white border-2 border-rose-100 text-rose-600 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-rose-50 active:scale-95 disabled:opacity-30 disabled:grayscale transition-all flex items-center gap-3 shadow-sm"
                  >
                    <CloseIcon /> Reject
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={processing}
                    className="h-14 px-10 bg-gradient-to-tr from-emerald-600 to-teal-500 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] hover:shadow-xl hover:shadow-emerald-200 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-3 shadow-lg shadow-emerald-100"
                  >
                    <CheckIcon /> Approve
                  </button>
                </div>

                <div className="flex flex-col items-center gap-1 shrink-0 px-6 border-l border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Auto Next</span>
                    <label className="relative inline-flex items-center cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={autoNext}
                        onChange={(e) => setAutoNext(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 group-hover:ring-4 group-hover:ring-gray-100 transition-all"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Right Sidebar - Audit Panel */}
        <aside className="w-96 bg-white border-l border-gray-200 flex flex-col shrink-0 z-10">
          <div className="p-8 space-y-10 overflow-y-auto flex-1">
            {/* Class Accuracy */}
            <section>
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-6">Audit Metrics</h3>
              <div className="space-y-6">
                <div className="relative h-32 w-32 mx-auto">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="64" cy="64" r="56" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                    <circle cx="64" cy="64" r="56" fill="transparent" stroke="url(#blue_grad)" strokeWidth="12" strokeDasharray={2 * Math.PI * 56} strokeDashoffset={2 * Math.PI * 56 * (1 - 0.948)} strokeLinecap="round" />
                    <defs>
                      <linearGradient id="blue_grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-gray-900 leading-none">94.8</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase mt-1">Quality</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Pass rate</p>
                    <p className="text-lg font-bold text-gray-900 tracking-tighter">92.1%</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Avg Time</p>
                    <p className="text-lg font-bold text-gray-900 tracking-tighter">4m 12s</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Error Classification */}
            {!isReviewed && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Classification</h3>
                  <button className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest">Guide</button>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: 'tightness', label: 'Tightness Issue', desc: 'BBox gap > 2px', color: 'bg-amber-100 text-amber-700 border-amber-200' },
                    { id: 'missed', label: 'Missed Entity', desc: 'Object fully ignored', color: 'bg-rose-100 text-rose-700 border-rose-200' },
                    { id: 'wrong_class', label: 'Wrong Taxonomy', desc: 'Incorrect classification', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
                    { id: 'occlusion', label: 'Segmentation', desc: 'Improper overlap fix', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
                  ].map((err) => (
                    <button
                      key={err.id}
                      onClick={() => setErrorCategory(err.id)}
                      className={`text-left p-4 rounded-[1.25rem] border-2 transition-all ${errorCategory === err.id ? 'bg-white border-blue-500 shadow-lg scale-[1.02] z-10' : 'bg-gray-50 border-transparent opacity-60 hover:opacity-100 hover:bg-gray-100'}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{err.label}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">{err.desc}</p>
                        </div>
                        {errorCategory === err.id && <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center"><CheckIcon className="text-white scale-75" fontSize="inherit" /></div>}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Audit Notes History */}
            <section className="space-y-4 pb-8">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Audit History</h3>
              {reviewNotes.length === 0 ? (
                <div className="p-8 bg-gray-50 rounded-[1.5rem] border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
                  <div className="p-3 rounded-full bg-white shadow-sm mb-3">
                    <HistoryIcon className="text-gray-300" />
                  </div>
                  <p className="text-[11px] font-bold text-gray-400 leading-relaxed uppercase tracking-widest">No audit notes recorded<br />for this frame yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviewNotes.map((note, idx) => (
                    <div key={idx} className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm animate-in slide-in-from-left duration-300">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded tracking-widest uppercase">{note.label}</span>
                        <button className="text-gray-300 hover:text-rose-500 transition-colors"><CloseIcon fontSize="inherit" /></button>
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed font-medium capitalize">{note.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ReviewerTask;

