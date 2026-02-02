<<<<<<< HEAD
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
=======
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  const [noteDrafts, setNoteDrafts] = useState({});
  const [selectedError, setSelectedError] = useState('');
  const [autoNext, setAutoNext] = useState(false);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [reviewedTasks, setReviewedTasks] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [hoveredObjectIndex, setHoveredObjectIndex] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const carouselRef = useRef(null);
  const [carouselScroll, setCarouselScroll] = useState(0);

  useEffect(() => {
    fetchTask();
    fetchAllTasks();
  }, [id]);

  // Map frontend error types to backend error categories
  const mapErrorCategoryToBackend = (frontendCategory) => {
    const mapping = {
      'tightness': 'poor_quality',      // Tightness issue = poor quality
      'missed': 'missing_label',         // Missed object = missing label
      'wrong_class': 'incorrect_label',  // Wrong class = incorrect label
      'occlusion': 'does_not_follow_guidelines', // Occlusion error = doesn't follow guidelines
      'other': 'other'
    };
    return mapping[frontendCategory] || 'other';
  };

  const errorTypes = [
    {
      id: 'tightness',
      name: 'Tightness Issue',
      description: "Bounding box doesn't fit object",
      icon: '📐',
      color: 'from-yellow-400 to-orange-500',
      backendCategory: 'poor_quality'
    },
    {
      id: 'missed',
      name: 'Missed Object',
      description: 'Visible object not labeled',
      icon: '👁️',
      color: 'from-blue-400 to-cyan-500',
      backendCategory: 'missing_label'
    },
    {
      id: 'wrong_class',
      name: 'Wrong Class',
      description: 'Categorization error',
      icon: '🏷️',
      color: 'from-purple-400 to-pink-500',
      backendCategory: 'incorrect_label'
    },
    {
      id: 'occlusion',
      name: 'Occlusion Error',
      description: 'Improper handling of overlap',
      icon: '🔀',
      color: 'from-red-400 to-rose-500',
      backendCategory: 'does_not_follow_guidelines'
    }
  ];

  const fetchAllTasks = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/reviews/all`);
      setPendingTasks(response.data.pending || []);
      setReviewedTasks(response.data.reviewed || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchTask = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/tasks/${id}`);
      setTask(response.data);
      setReviewNotes(response.data.reviewNotes || []);
      setReviewComments(response.data.reviewComments || '');
      // Load chat messages from review comments
      if (response.data.reviewComments) {
        setChatMessages([{
          id: 1,
          text: response.data.reviewComments,
          sender: 'reviewer',
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('Error fetching task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = useCallback(async () => {
    // Check if task has already been reviewed
    if (task?.status === 'approved' || task?.status === 'rejected') {
      alert('Task này đã được đánh giá rồi. Mỗi task chỉ có thể được đánh giá 1 lần.');
      return;
    }

    if (window.confirm('Bạn có chắc muốn phê duyệt task này? Task sẽ được đánh dấu là approved và không thể chỉnh sửa nữa. Lưu ý: Mỗi task chỉ có thể được đánh giá 1 lần.')) {
      setProcessing(true);
      try {
        const payloadNotes = (reviewNotes && reviewNotes.length > 0)
          ? reviewNotes.map(n => ({
              bbox: n.bbox,
              label: n.label,
              comment: n.comment
            }))
          : [];
        await axios.post(`${API_URL}/api/reviews/${id}/approve`, {
          reviewComments: reviewComments.trim() || undefined,
          reviewNotes: payloadNotes,
        });
        alert('Đã phê duyệt task thành công!');
        // Refresh task data and tasks list to update statistics
        await fetchTask();
        await fetchAllTasks();
        // Stay on current page instead of navigating away
      } catch (error) {
        const errorMessage = error.response?.data?.message || 'Lỗi khi phê duyệt task';
        alert(errorMessage);
        console.error('Error approving task:', error);
      } finally {
        setProcessing(false);
      }
    }
  }, [id, task, reviewComments, reviewNotes]);

  const handleReject = useCallback(async () => {
    // Check if task has already been reviewed
    if (task?.status === 'approved' || task?.status === 'rejected') {
      alert('Task này đã được đánh giá rồi. Mỗi task chỉ có thể được đánh giá 1 lần.');
      return;
    }

    if (!reviewComments.trim()) {
      alert('Vui lòng nhập nhận xét khi từ chối task');
      return;
    }

    if (window.confirm('Bạn có chắc muốn từ chối task này? Annotator sẽ nhận được phản hồi và cần chỉnh sửa lại. Lưu ý: Mỗi task chỉ có thể được đánh giá 1 lần.')) {
      setProcessing(true);
      try {
        const payloadNotes = (reviewNotes && reviewNotes.length > 0) 
          ? reviewNotes.map(n => ({
              bbox: n.bbox,
              label: n.label,
              comment: n.comment
            }))
          : [];
        // Map frontend error category to backend format
        const selectedErrorType = errorTypes.find(et => et.id === (errorCategory || selectedError));
        const backendErrorCategory = selectedErrorType 
          ? selectedErrorType.backendCategory 
          : mapErrorCategoryToBackend(errorCategory || selectedError || 'other');
        
        await axios.post(`${API_URL}/api/reviews/${id}/reject`, {
          reviewComments: reviewComments.trim(),
          errorCategory: backendErrorCategory,
          reviewNotes: payloadNotes,
        });
        alert('Đã từ chối task thành công!');
        // Refresh task data and tasks list to update statistics
        await fetchTask();
        await fetchAllTasks();
        // Stay on current page instead of navigating away
      } catch (error) {
        const errorMessage = error.response?.data?.message || error.response?.data?.errors?.[0]?.msg || 'Lỗi khi từ chối task';
        alert(errorMessage);
        console.error('Error rejecting task:', error);
      } finally {
        setProcessing(false);
      }
    }
  }, [id, task, reviewComments, reviewNotes, errorCategory, selectedError]);

  const handleSkip = () => {
    if (pendingTasks.length > 1) {
      const currentIndex = pendingTasks.findIndex(t => t._id === id);
      if (currentIndex < pendingTasks.length - 1) {
        navigate(`/reviewer/tasks/${pendingTasks[currentIndex + 1]._id}`);
      } else if (currentIndex > 0) {
        navigate(`/reviewer/tasks/${pendingTasks[currentIndex - 1]._id}`);
      }
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    const message = {
      id: Date.now(),
      text: newMessage,
      sender: 'reviewer',
      timestamp: new Date()
    };
    setChatMessages([...chatMessages, message]);
    setReviewComments(prev => prev ? `${prev}\n${newMessage}` : newMessage);
    setNewMessage('');
  };

  // Keyboard shortcuts
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

  const calculateQualityScore = () => {
    if (!task?.labels?.objects || task.labels.objects.length === 0) return 0;
    const totalObjects = task.labels.objects.length;
    const hasAnswers = task.labels.objects.filter(obj => obj.answer).length;
    const completeness = totalObjects > 0 ? (hasAnswers / totalObjects) * 100 : 0;
    return Math.round(completeness);
  };

  // Calculate average confidence from all objects in current task
  const calculateAverageConfidence = () => {
    if (!task?.labels?.objects || task.labels.objects.length === 0) return 0;
    const objectsWithConfidence = task.labels.objects.filter(obj => obj.confidence != null);
    if (objectsWithConfidence.length === 0) return 0;
    const sumConfidence = objectsWithConfidence.reduce((sum, obj) => sum + (obj.confidence || 0), 0);
    return (sumConfidence / objectsWithConfidence.length) * 100;
  };

  // Calculate accuracy and rejection rates from all reviewed tasks
  const calculateReviewStats = () => {
    // Calculate based on all reviewed tasks (approved + rejected)
    const totalReviewed = reviewedTasks.length;
    
    if (totalReviewed === 0) {
      // If no tasks reviewed yet, show 0 for both
      return {
        accuracy: 0,
        rejection: 0
      };
    }
    
    const approvedCount = reviewedTasks.filter(t => t.status === 'approved').length;
    const rejectedCount = reviewedTasks.filter(t => t.status === 'rejected').length;
    
    // Accuracy = percentage of approved tasks out of all reviewed tasks
    const accuracy = (approvedCount / totalReviewed) * 100;
    // Rejection = percentage of rejected tasks out of all reviewed tasks
    const rejection = (rejectedCount / totalReviewed) * 100;
    
    return {
      accuracy: Math.round(accuracy * 10) / 10,
      rejection: Math.round(rejection * 10) / 10,
      totalReviewed,
      approvedCount,
      rejectedCount
    };
  };

  const qualityScore = calculateQualityScore();
  const isReviewed = task?.status === 'approved' || task?.status === 'rejected';
  const averageConfidence = calculateAverageConfidence();
  const reviewStats = calculateReviewStats();
  const accuracy = reviewStats.accuracy;
  const rejection = reviewStats.rejection;
  const currentTaskIndex = pendingTasks.findIndex(t => t._id === id);
  const batchProgress = pendingTasks.length > 0 && currentTaskIndex >= 0
    ? Math.round(((currentTaskIndex + 1) / pendingTasks.length) * 100)
    : 0;

  const getTimeAgo = (date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const scrollCarousel = (direction) => {
    if (carouselRef.current) {
      const scrollAmount = 300;
      const currentScroll = carouselRef.current.scrollLeft;
      const newScroll = direction === 'left' 
        ? currentScroll - scrollAmount 
        : currentScroll + scrollAmount;
      const maxScroll = carouselRef.current.scrollWidth - carouselRef.current.clientWidth;
      const finalScroll = Math.max(0, Math.min(newScroll, maxScroll));
      carouselRef.current.scrollTo({ left: finalScroll, behavior: 'smooth' });
      setCarouselScroll(finalScroll);
    }
  };

  useEffect(() => {
    if (carouselRef.current) {
      const handleScroll = () => {
        setCarouselScroll(carouselRef.current.scrollLeft);
      };
      carouselRef.current.addEventListener('scroll', handleScroll);
      return () => {
        if (carouselRef.current) {
          carouselRef.current.removeEventListener('scroll', handleScroll);
        }
      };
    }
  }, [pendingTasks]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-purple-50'}`}>
        <div className={`animate-spin rounded-full h-16 w-16 border-4 ${darkMode ? 'border-emerald-400 border-t-transparent' : 'border-emerald-500 border-t-transparent'}`}></div>
      </div>
    );
  }

  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'}`}>
      {/* Top Header - Dynamic Style */}
      <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white/80 backdrop-blur-lg border-gray-200'} border-b px-6 py-4 flex items-center justify-between z-10`}>
        <div className="flex items-center gap-4">
          <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {darkMode ? '🔍 Premium Dark Audit Station' : '⚡ Dynamic Reviewer Hub'}
          </h1>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${darkMode ? 'bg-emerald-900/50 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
            {pendingTasks.length} PENDING
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-lg transition-all ${darkMode ? 'bg-gray-700 text-yellow-300 hover:bg-gray-600' : 'bg-white/60 text-gray-700 hover:bg-white/80'}`}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Detected Objects with Smart Highlight */}
        <div className={`w-80 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white/60 backdrop-blur-lg border-gray-200/50'} border-r flex flex-col`}>
          <div className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              DETECTED OBJECTS
            </h3>
            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {task?.labels?.objects?.length || 0} TOTAL
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {task?.labels?.objects?.map((obj, idx) => {
              const labelInfo = task?.projectId?.labelSet?.find(l => l.name === obj.label);
              const isHovered = hoveredObjectIndex === idx;
              return (
                <div
                  key={idx}
                  id={`object-${idx}`}
                  onMouseEnter={() => setHoveredObjectIndex(idx)}
                  onMouseLeave={() => setHoveredObjectIndex(null)}
                  className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                    isHovered
                      ? darkMode
                        ? 'bg-emerald-600/30 border-2 border-emerald-400 shadow-lg shadow-emerald-500/50'
                        : 'bg-emerald-100 border-2 border-emerald-400 shadow-lg'
                      : darkMode
                        ? 'bg-gray-700/50 border border-gray-600 hover:bg-gray-700'
                        : 'bg-white/40 border border-gray-300/50 hover:bg-white/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {obj.label || `OBJECT_${idx + 1}`}
                    </span>
                    <span 
                      className={`text-xs px-2 py-0.5 rounded ${darkMode ? 'bg-emerald-900/50 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}
                      title="Độ tin cậy của nhãn này (confidence score)"
                    >
                      {obj.confidence ? `${(obj.confidence * 100).toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  {obj.answer && (
                    <div className={`text-xs mt-1 ${darkMode ? 'text-emerald-300' : 'text-emerald-600'}`}>
                      ✓ Has answers
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Center - Image Viewer with Smart Highlight */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className={`flex-1 overflow-y-auto p-6 ${darkMode ? 'bg-gray-900' : ''}`}>
            {/* Status Banner - Show when task is already reviewed */}
            {isReviewed && (
              <div className={`mb-4 p-4 rounded-xl border-2 ${
                task?.status === 'approved'
                  ? darkMode 
                    ? 'bg-emerald-900/30 border-emerald-500 text-emerald-300'
                    : 'bg-emerald-100 border-emerald-500 text-emerald-800'
                  : darkMode
                    ? 'bg-red-900/30 border-red-500 text-red-300'
                    : 'bg-red-100 border-red-500 text-red-800'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">
                    {task?.status === 'approved' ? '✓' : '✕'}
                  </span>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">
                      {task?.status === 'approved' ? 'ĐÃ PHÊ DUYỆT' : 'ĐÃ TỪ CHỐI'}
                    </h3>
                    <p className="text-sm mt-1">
                      Task này đã được đánh giá bởi bạn vào {task?.reviewedAt ? new Date(task.reviewedAt).toLocaleString('vi-VN') : 'trước đó'}. 
                      Mỗi task chỉ có thể được đánh giá 1 lần.
                    </p>
                    {task?.reviewComments && (
                      <p className="text-sm mt-2 opacity-90">
                        <strong>Nhận xét của bạn:</strong> {task.reviewComments}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <div className="mb-4">
              <h2 className={`text-lg font-bold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                CURRENTLY AUDITING
              </h2>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {task?.dataItem?.filename || 'Image'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Review Queue (moved down here to replace comparison section) */}
              <div className={`${darkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-white/60 backdrop-blur-lg border-gray-200/50'} rounded-2xl border p-6 shadow-xl`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    REVIEW QUEUE
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${darkMode ? 'bg-emerald-900/50 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                    {pendingTasks.length} PENDING
                  </span>
                </div>
                <div className="space-y-3">
                  {pendingTasks.length === 0 ? (
                    <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Không có task nào đang chờ review.
                    </div>
                  ) : (
                    pendingTasks.map((pendingTask) => {
                      const isActive = pendingTask._id === id;
                      const timeAgo = pendingTask.submittedAt ? getTimeAgo(new Date(pendingTask.submittedAt)) : '';
                      return (
                        <button
                          key={pendingTask._id}
                          onClick={() => navigate(`/reviewer/tasks/${pendingTask._id}`)}
                          className={`w-full text-left rounded-xl p-3 transition-all duration-200 ${
                            isActive
                              ? darkMode
                                ? 'bg-emerald-600/30 border-2 border-emerald-400'
                                : 'bg-emerald-100 border-2 border-emerald-400'
                              : darkMode
                                ? 'bg-gray-700/50 border border-gray-600 hover:bg-gray-700'
                                : 'bg-white/40 border border-gray-300/50 hover:bg-white/60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {pendingTask.dataItem?.mimeType?.startsWith('image/') && (
                              <div className="w-20 h-14 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                                <img
                                  src={`${API_URL}/${pendingTask.dataItem?.path}`}
                                  alt="Task thumbnail"
                                  className="w-full h-full object-cover"
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                TSK-{pendingTask._id?.substring(0, 8).toUpperCase()}
                              </div>
                              <div className={`text-xs truncate ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                {pendingTask.projectId?.name || 'Project'}
                              </div>
                              {timeAgo && (
                                <div className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                  {timeAgo}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Annotator Output - Glassmorphism with Neon Glow on Hover */}
              <div className={`${darkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-white/60 backdrop-blur-lg border-gray-200/50'} rounded-2xl border p-6 shadow-xl`}>
                <h3 className={`font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  ANNOTATOR OUTPUT
                </h3>
                {task?.dataItem?.mimeType?.startsWith('image/') ? (
                  <>
                    <div className={`mb-4 rounded-xl overflow-hidden transition-all duration-300 ${
                      hoveredObjectIndex !== null 
                        ? darkMode 
                          ? 'ring-4 ring-emerald-400/50 shadow-2xl shadow-emerald-500/30' 
                          : 'ring-4 ring-emerald-300/50 shadow-2xl'
                        : ''
                    }`}>
                      <ImageViewer
                        imageUrl={`${API_URL}/${task.dataItem.path}`}
                        annotations={task?.labels?.objects?.map((obj, idx) => ({
                          id: idx,
                          bbox: obj.bbox,
                          label: obj.label,
                          index: idx,
                        })) || []}
                        labelSet={task?.projectId?.labelSet || []}
                        reviewNotes={reviewNotes}
                        readOnly={false}
                        highlightedIndex={hoveredObjectIndex}
                        maxHeight="400px"
                        onAnnotationClick={(ann) => {
                          setHoveredObjectIndex(ann.index);
                          const element = document.getElementById(`object-${ann.index}`);
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span 
                        className={`font-semibold ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}
                        title="Độ tin cậy trung bình của tất cả các đối tượng được gán nhãn trong ảnh này"
                      >
                        AVG CONFIDENCE {averageConfidence.toFixed(1)}%
                      </span>
                      <span 
                        className={darkMode ? 'text-gray-400' : 'text-gray-600'}
                        title="Tổng số đối tượng (objects) đã được gán nhãn trong ảnh này"
                      >
                        CLASSES {task?.labels?.objects?.length || 0} Total
                      </span>
                    </div>
                  </>
                ) : (
                  <div className={`text-center py-12 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Not an image
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Quality Metrics & Error Classification */}
        <div className={`w-96 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white/60 backdrop-blur-lg border-gray-200/50'} border-l overflow-y-auto`}>
          <div className="p-6 space-y-6">
            {/* Quality Metrics - Circular Progress */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  QUALITY METRICS
                </h3>
                <button
                  onClick={() => {
                    alert(`GIẢI THÍCH CÁC THÔNG SỐ:\n\n` +
                      `1. AVG CONFIDENCE: Độ tin cậy trung bình của tất cả các đối tượng được gán nhãn trong ảnh hiện tại.\n` +
                      `2. CLASSES: Tổng số đối tượng (objects) đã được gán nhãn trong ảnh.\n` +
                      `3. BATCH PROGRESS: Tiến độ xem xét - số task đã xem / tổng số task trong hàng đợi.\n` +
                      `4. ACCURACY: Tỷ lệ task được phê duyệt = Số task approved / Tổng số task đã review.\n` +
                      `   Hiện tại: ${reviewStats.approvedCount || 0} approved / ${reviewStats.totalReviewed || 0} reviewed = ${accuracy.toFixed(1)}%\n` +
                      `5. REJECTION: Tỷ lệ task bị từ chối = Số task rejected / Tổng số task đã review.\n` +
                      `   Hiện tại: ${reviewStats.rejectedCount || 0} rejected / ${reviewStats.totalReviewed || 0} reviewed = ${rejection.toFixed(1)}%\n\n` +
                      `Lưu ý: Các thông số này được tính dựa trên TẤT CẢ các task đã được bạn review (approved hoặc rejected), không chỉ các task trong hàng đợi hiện tại.`
                    );
                  }}
                  className={`text-xs px-2 py-1 rounded ${darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  title="Click để xem giải thích chi tiết về các thông số"
                >
                  ℹ️ Giải thích
                </button>
              </div>
              
              {/* Batch Progress */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span 
                    className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}
                    title="Tiến độ xem xét: số task đã xem / tổng số task trong hàng đợi"
                  >
                    Batch Progress
                  </span>
                  <span className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {Math.round(batchProgress)}%
                  </span>
                </div>
                <div className={`w-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-3 overflow-hidden`}>
                  <div 
                    className="bg-gradient-to-r from-emerald-400 to-teal-500 h-3 rounded-full transition-all duration-500 shadow-lg"
                    style={{ width: `${Math.max(0, Math.min(100, batchProgress))}%` }}
                  ></div>
                </div>
                <div className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  {currentTaskIndex >= 0 ? `${currentTaskIndex + 1} / ${pendingTasks.length} tasks` : '0 / 0 tasks'}
                </div>
              </div>

              {/* Circular Progress Charts */}
              <div className="grid grid-cols-2 gap-4">
                {/* Accuracy */}
                <div 
                  className="relative w-32 h-32 mx-auto cursor-help"
                  title={`Tỷ lệ task được phê duyệt: ${reviewStats.approvedCount || 0} approved / ${reviewStats.totalReviewed || 0} đã review = ${accuracy.toFixed(1)}%`}
                >
                  <svg className="transform -rotate-90 w-32 h-32">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke={darkMode ? '#374151' : '#e5e7eb'}
                      strokeWidth="12"
                      fill="none"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="#10b981"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={`${(Math.min(100, Math.max(0, accuracy)) / 100) * 352} 352`}
                      strokeLinecap="round"
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {accuracy.toFixed(1)}
                    </span>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      ACCURACY
                    </span>
                  </div>
                </div>

                {/* Rejection */}
                <div 
                  className="relative w-32 h-32 mx-auto cursor-help"
                  title={`Tỷ lệ task bị từ chối: ${reviewStats.rejectedCount || 0} rejected / ${reviewStats.totalReviewed || 0} đã review = ${rejection.toFixed(1)}%`}
                >
                  <svg className="transform -rotate-90 w-32 h-32">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke={darkMode ? '#374151' : '#e5e7eb'}
                      strokeWidth="12"
                      fill="none"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="#ef4444"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={`${(Math.min(100, Math.max(0, rejection)) / 100) * 352} 352`}
                      strokeLinecap="round"
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-2xl font-bold ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                      {rejection.toFixed(1)}%
                    </span>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      REJECTION
                    </span>
                  </div>
                </div>
              </div>
              <div className={`text-xs mt-2 text-center ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                <span className="cursor-help" title="Hover vào các biểu đồ để xem giải thích chi tiết">
                  💡 Hover để xem giải thích
                </span>
                {reviewStats.totalReviewed > 0 && (
                  <div className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    ({reviewStats.approvedCount || 0} approved, {reviewStats.rejectedCount || 0} rejected)
                  </div>
                )}
              </div>
            </div>

            {/* Error Classification - Tiles with Icons */}
            <div>
              <h3 className={`font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                ERROR CLASSIFICATION
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {errorTypes.map((errorType) => (
                  <button
                    key={errorType.id}
                    onClick={() => {
                      setSelectedError(errorType.id);
                      setErrorCategory(errorType.id);
                    }}
                    className={`p-4 rounded-xl transition-all duration-300 transform ${
                      selectedError === errorType.id
                        ? darkMode
                          ? `bg-gradient-to-br ${errorType.color} text-white shadow-2xl scale-105 ring-4 ring-white/20`
                          : `bg-gradient-to-br ${errorType.color} text-white shadow-2xl scale-105`
                        : darkMode
                          ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-700 hover:scale-102 border border-gray-600'
                          : 'bg-white/60 text-gray-700 hover:bg-white/80 hover:scale-102 border border-gray-300/50'
                    }`}
                  >
                    <div className="text-3xl mb-2">{errorType.icon}</div>
                    <div className="text-xs font-bold mb-1">{errorType.name}</div>
                    <div className={`text-xs ${selectedError === errorType.id ? 'text-white/90' : (darkMode ? 'text-gray-400' : 'text-gray-600')}`}>
                      {errorType.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat-like Feedback System */}
            <div>
              <h3 className={`font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                AUDITOR FEEDBACK
              </h3>
              <div className={`${darkMode ? 'bg-gray-900/50' : 'bg-white/40'} rounded-xl p-4 h-64 flex flex-col`}>
                <div className="flex-1 overflow-y-auto space-y-3 mb-3">
                  {chatMessages.length === 0 ? (
                    <div className={`text-center text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      No feedback yet. Start typing...
                    </div>
                  ) : (
                    chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender === 'reviewer' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] rounded-lg px-3 py-2 ${
                          msg.sender === 'reviewer'
                            ? darkMode ? 'bg-emerald-600 text-white' : 'bg-emerald-500 text-white'
                            : darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800'
                        }`}>
                          <p className="text-sm">{msg.text}</p>
                          <p className={`text-xs mt-1 ${msg.sender === 'reviewer' ? (darkMode ? 'text-emerald-200' : 'text-emerald-100') : (darkMode ? 'text-gray-400' : 'text-gray-500')}`}>
                            {msg.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Add rejection comment..."
                    className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                      darkMode 
                        ? 'bg-gray-800 text-white border-gray-600 focus:border-emerald-500' 
                        : 'bg-white text-gray-900 border-gray-300 focus:border-emerald-500'
                    } border focus:outline-none focus:ring-2 focus:ring-emerald-500/50`}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      darkMode
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                        : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg'
                    }`}
                  >
                    ➤
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Dock */}
      {!isReviewed && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl ${
          darkMode 
            ? 'bg-gray-800/90 backdrop-blur-xl border border-gray-700' 
            : 'bg-white/90 backdrop-blur-xl border border-gray-200/50'
        }`}>
          <button
            onClick={handleSkip}
            className={`px-6 py-3 rounded-xl font-bold transition-all transform hover:scale-105 ${
              darkMode
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <span className="mr-2">⏭️</span> Skip
          </button>
          <button
            onClick={handleReject}
            disabled={processing || !reviewComments.trim() || isReviewed}
            className="px-8 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/50 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            title={isReviewed ? 'Task này đã được đánh giá rồi' : (!reviewComments.trim() ? 'Vui lòng nhập nhận xét trước khi từ chối' : '')}
          >
            <span className="mr-2">✕</span> Request Change
          </button>
          <button
            onClick={handleApprove}
            disabled={processing || isReviewed}
            className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/50 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            title={isReviewed ? 'Task này đã được đánh giá rồi' : ''}
          >
            <span className="mr-2">✓</span> Approve Task
          </button>
          <div className={`flex items-center gap-2 ml-4 pl-4 border-l ${darkMode ? 'border-gray-700' : 'border-gray-300'}`}>
            <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              AUTO-NEXT
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoNext}
                onChange={(e) => setAutoNext(e.target.checked)}
                className="sr-only peer"
              />
              <div className={`w-12 h-6 rounded-full peer transition-all ${
                autoNext
                  ? darkMode ? 'bg-emerald-600' : 'bg-emerald-500'
                  : darkMode ? 'bg-gray-700' : 'bg-gray-300'
              } peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300/50`}>
                <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all ${
                  autoNext ? 'translate-x-6' : 'translate-x-0'
                }`}></div>
              </div>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewerTask;
>>>>>>> NDuy
