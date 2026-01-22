import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';
import ImageViewer from '../../components/ImageViewer';

const ReviewerTask = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [reviewComments, setReviewComments] = useState('');
  const [errorCategory, setErrorCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [reviewNotes, setReviewNotes] = useState([]);
  const [noteDrafts, setNoteDrafts] = useState({});
  const [viewMode, setViewMode] = useState('side-by-side');
  const [selectedError, setSelectedError] = useState('');
  const [autoNext, setAutoNext] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [zoom, setZoom] = useState(100);
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    fetchTask();
    fetchPendingTasks();
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

  const fetchPendingTasks = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/reviews/all`);
      setPendingTasks(response.data.pending || []);
    } catch (error) {
      console.error('Error fetching pending tasks:', error);
    }
  };

  const handleApprove = useCallback(async () => {
    if (window.confirm('Bạn có chắc muốn phê duyệt task này? Task sẽ được đánh dấu là approved và không thể chỉnh sửa nữa.')) {
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
        alert('Đã phê duyệt task thành công!');
        if (autoNext) {
          // Find next task
          const currentIndex = pendingTasks.findIndex(t => t._id === id);
          if (currentIndex < pendingTasks.length - 1) {
            navigate(`/reviewer/tasks/${pendingTasks[currentIndex + 1]._id}`);
          } else {
            navigate('/reviewer/tasks');
          }
        } else {
        navigate('/reviewer/tasks');
        }
      } catch (error) {
        const errorMessage = error.response?.data?.message || 'Lỗi khi phê duyệt task';
        alert(errorMessage);
        console.error('Error approving task:', error);
      } finally {
        setProcessing(false);
      }
    }
  }, [id, reviewComments, reviewNotes, navigate, autoNext, pendingTasks]);

  const handleReject = useCallback(async () => {
    if (!reviewComments.trim()) {
      alert('Vui lòng nhập nhận xét khi từ chối task');
      return;
    }
    if (!reviewNotes || reviewNotes.length === 0) {
      alert('Bạn cần thêm ít nhất một ghi chú trên ảnh trước khi từ chối');
      return;
    }
    if (!selectedError && !errorCategory) {
      alert('Vui lòng chọn loại lỗi');
      return;
    }

    if (window.confirm('Bạn có chắc muốn từ chối task này? Annotator sẽ nhận được phản hồi và cần chỉnh sửa lại.')) {
      setProcessing(true);
      try {
        const payloadNotes = reviewNotes.map(n => ({
          bbox: n.bbox,
          label: n.label,
          comment: n.comment
        }));
        await axios.post(`${API_URL}/api/reviews/${id}/reject`, {
          reviewComments: reviewComments.trim(),
          errorCategory: selectedError || errorCategory || 'other',
          reviewNotes: payloadNotes,
        });
        alert('Đã từ chối task thành công!');
        if (autoNext) {
          const currentIndex = pendingTasks.findIndex(t => t._id === id);
          if (currentIndex < pendingTasks.length - 1) {
            navigate(`/reviewer/tasks/${pendingTasks[currentIndex + 1]._id}`);
          } else {
            navigate('/reviewer/tasks');
          }
        } else {
        navigate('/reviewer/tasks');
        }
      } catch (error) {
        const errorMessage = error.response?.data?.message || error.response?.data?.errors?.[0]?.msg || 'Lỗi khi từ chối task';
        alert(errorMessage);
        console.error('Error rejecting task:', error);
      } finally {
        setProcessing(false);
      }
    }
  }, [id, reviewComments, reviewNotes, selectedError, errorCategory, navigate, autoNext, pendingTasks]);

  const addNoteForObject = (obj, idx) => {
    const text = (noteDrafts[idx] || '').trim();
    if (!text) {
      alert('Nhập nội dung ghi chú trước khi thêm');
      return;
    }
    if (!obj?.bbox || obj.bbox.length < 4) {
      alert('BBox không hợp lệ để ghi chú');
      return;
    }
    const newNote = {
      bbox: obj.bbox,
      label: obj.label,
      comment: text,
      localId: Date.now() + idx
    };
    setReviewNotes([...reviewNotes, newNote]);
    setNoteDrafts({ ...noteDrafts, [idx]: '' });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (task?.status === 'approved' || task?.status === 'rejected') return;
      // Ctrl/Cmd + Enter to approve
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleApprove();
      }
      // Ctrl/Cmd + Shift + Enter to reject
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        if (reviewComments.trim() && reviewNotes.length > 0 && (selectedError || errorCategory)) {
          handleReject();
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [task, reviewComments, reviewNotes, selectedError, errorCategory, handleApprove, handleReject]);

  // Calculate quality metrics
  const calculateMetrics = () => {
    if (!task?.labels?.objects || task.labels.objects.length === 0) {
      return { accuracy: 0, rejectionRate: 0, batchProgress: 0 };
    }
    const totalObjects = task.labels.objects.length;
    const hasAnswers = task.labels.objects.filter(obj => obj.answer).length;
    const accuracy = totalObjects > 0 ? Math.round((hasAnswers / totalObjects) * 100) : 0;
    const rejectionRate = 4.2; // Mock data, can be calculated from project stats
    const batchProgress = 75; // Mock data
    return { accuracy, rejectionRate, batchProgress };
  };

  const metrics = calculateMetrics();
  const isReviewed = task?.status === 'approved' || task?.status === 'rejected';

  const errorCategories = [
    { value: 'tightness', label: 'Tightness Issue', description: 'Bounding box doesn\'t fit object' },
    { value: 'missed', label: 'Missed Object', description: 'Visible object not labeled' },
    { value: 'wrong_class', label: 'Wrong Class', description: 'Categorization error' },
    { value: 'occlusion', label: 'Occlusion Error', description: 'Improper handling of overlap' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Left Sidebar - Navigation (Navy/Black) */}
      <div className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xl">
              V
            </div>
            <div>
              <div className="font-bold text-sm">LabelFlow</div>
              <div className="text-xs text-slate-400">REVIEWER PORTAL</div>
            </div>
          </div>
          <nav className="space-y-1">
            <a href="/reviewer/tasks" className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
              <span>📊</span>
              <span className="text-sm">Dashboard</span>
            </a>
            <a href="/reviewer/tasks" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-600 text-white">
              <span>✅</span>
              <span className="text-sm font-medium">Reviews</span>
            </a>
            <a href="/reviewer/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
              <span>⚙️</span>
              <span className="text-sm">Settings</span>
            </a>
          </nav>
        </div>
        <div className="mt-auto p-6 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-semibold text-sm">
              TT
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">Thai Tan Tien</div>
              <div className="text-xs text-slate-400">Reviewer</div>
            </div>
          </div>
          <a href="/logout" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
            <span>→</span>
            <span>Logout</span>
          </a>
        </div>
      </div>

      {/* Task Queue Panel */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-gray-900">REVIEW QUEUE</h2>
            <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
              {pendingTasks.length} PENDING
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-2">
            {pendingTasks.map((t) => {
              const isActive = t._id === id;
              const timeAgo = t.submittedAt 
                ? `${Math.floor((Date.now() - new Date(t.submittedAt).getTime()) / (1000 * 60))}m ago`
                : 'N/A';
                return (
                <div
                  key={t._id}
                  onClick={() => navigate(`/reviewer/tasks/${t._id}`)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : 'bg-white border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-900">TASK #{t._id?.substring(0, 8)}</span>
                    <span className="text-xs text-gray-500">{timeAgo}</span>
                  </div>
                  <p className="text-xs text-gray-700 mb-1">{t.projectId?.name || 'Project'}</p>
                  <p className="text-xs text-gray-600">Annotator: {t.annotatorId?.fullName || t.annotatorId?.username || 'Unknown'}</p>
                </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Main Audit Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Toolbar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-xs font-bold text-gray-900">LABELCORE PRO</div>
                <div className="text-xs text-gray-600">QUALITY AUDIT SYSTEM</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('side-by-side')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    viewMode === 'side-by-side'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Side-by-Side
                </button>
                <button
                  onClick={() => setViewMode('overlay')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    viewMode === 'overlay'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Overlay View
                </button>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Brightness</label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={brightness}
                  onChange={(e) => setBrightness(e.target.value)}
                  className="w-24"
                />
                <span className="text-xs text-gray-600 w-8">{brightness}%</span>
              </div>
              <button
                onClick={() => setShowOverlay(!showOverlay)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  showOverlay ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {showOverlay ? 'Hide' : 'Show'} Overlay
              </button>
              <button className="text-gray-400 hover:text-gray-600 text-lg">🌙</button>
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-xs font-medium text-blue-700">JD</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Side by Side View */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-gray-900 mb-1">CURRENTLY AUDITING</h2>
            <div className="flex items-center gap-4">
              <p className="text-xs text-gray-600">{task?.dataItem?.filename || 'Image'}</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoom(Math.max(25, zoom - 10))}
                  className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50"
                  title="Zoom Out"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"/>
                  </svg>
                </button>
                <span className="text-xs text-gray-600 w-12 text-center">{zoom}%</span>
                <button
                  onClick={() => setZoom(Math.min(200, zoom + 10))}
                  className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50"
                  title="Zoom In"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"/>
                  </svg>
                </button>
                <button
                  onClick={() => setZoom(100)}
                  className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50"
                  title="Full Screen"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {viewMode === 'side-by-side' ? (
            <div className="grid grid-cols-2 gap-6">
              {/* Reference Guidelines */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900">REFERENCE GUIDELINES</h3>
                  <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs font-semibold rounded">STRICT MODE</span>
                </div>
                {task?.dataItem?.mimeType?.startsWith('image/') && (
                  <div className="mb-3" style={{ filter: `brightness(${brightness}%)` }}>
                    <ImageViewer
                      imageUrl={`${API_URL}/${task.dataItem.path}`}
                      annotations={[]}
                      labelSet={task?.projectId?.labelSet || []}
                      reviewNotes={[]}
                      readOnly={true}
                      maxHeight="400px"
                    />
                  </div>
                )}
                <div className="text-xs text-gray-700 space-y-2">
                  <div>
                    <p className="font-semibold mb-1">Guideline 2.4: Tight Bounding Boxes</p>
                    <p className="text-gray-600">Ensure bounding boxes touch the outermost pixels of the object. No more than 2px gap allowed.</p>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Guideline 3.1: Complete Coverage</p>
                    <p className="text-gray-600">All visible objects must be labeled. Partial visibility requires special handling.</p>
                  </div>
                </div>
              </div>

              {/* Annotator Output */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900">ANNOTATOR OUTPUT</h3>
                  <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded">
                    Confidence: {metrics.accuracy}%
                  </span>
                </div>
                {task?.dataItem?.mimeType?.startsWith('image/') ? (
                  <>
                    <div className="mb-3" style={{ filter: `brightness(${brightness}%)` }}>
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
                        maxHeight="400px"
                        onAnnotationClick={(ann) => {
                          const element = document.getElementById(`object-${ann.index}`);
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-green-600 font-semibold">CONFIDENCE {metrics.accuracy}%</span>
                      <span className="text-gray-600">CLASSES {task?.labels?.objects?.length || 0} Total</span>
                      <span className="text-gray-600">TIME TAKEN 04:12s</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-gray-500 text-sm">Not an image</div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900">OVERLAY VIEW</h3>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                  Annotations Overlay
                </span>
              </div>
              {task?.dataItem?.mimeType?.startsWith('image/') && (
                <div style={{ filter: `brightness(${brightness}%)` }}>
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
                    maxHeight="600px"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Action Bar */}
        {!isReviewed && (
          <div className="border-t border-gray-200 bg-white px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <input
                type="text"
          value={reviewComments}
          onChange={(e) => setReviewComments(e.target.value)}
                placeholder="Add mandatory feedback for rejection..."
                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">AUTO-NEXT</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoNext}
                    onChange={(e) => setAutoNext(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
            <div className="flex items-center gap-3 ml-4">
              <button
                onClick={handleReject}
                disabled={processing || !reviewComments.trim() || reviewNotes.length === 0 || (!selectedError && !errorCategory)}
                className="px-6 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <span>×</span>
                REJECT TASK
              </button>
              <button
              onClick={handleApprove}
              disabled={processing}
                className="px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <span>✓</span>
                APPROVE TASK
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar - Quality Control Panel */}
      <div className="w-96 border-l border-gray-200 bg-white overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Quality Metrics */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-4">QUALITY METRICS</h3>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-600">BATCH PROGRESS</span>
                <span className="text-xs font-semibold text-gray-900">{metrics.batchProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${metrics.batchProgress}%` }}
                ></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="text-xs text-gray-600 mb-1">ACCURACY</div>
                <div className="text-2xl font-bold text-gray-900">{metrics.accuracy}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="text-xs text-gray-600 mb-1">REJECTION</div>
                <div className="text-2xl font-bold text-red-600">{metrics.rejectionRate}%</div>
              </div>
            </div>
          </div>

          {/* Error Classification */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-4">ERROR CLASSIFICATION</h3>
            <div className="space-y-2">
              {errorCategories.map((category) => (
                <label
                  key={category.value}
                  className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedError === category.value || errorCategory === category.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="error"
                    value={category.value}
                    checked={selectedError === category.value || errorCategory === category.value}
                    onChange={(e) => {
                      setSelectedError(e.target.value);
                      setErrorCategory(e.target.value);
                    }}
                    className="mt-1 text-blue-600"
                  />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-900">{category.label}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{category.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Found Objects */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-4">FOUND OBJECTS ({task?.labels?.objects?.length || 0})</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {task?.labels?.objects?.map((obj, idx) => (
                <div
                  key={idx}
                  id={`object-${idx}`}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-900">#{String(idx + 1).padStart(3, '0')}</span>
                      <span className="text-xs font-medium text-gray-700">{obj.label || 'Unknown'}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {obj.confidence ? `${(obj.confidence * 100).toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mb-2">
                    {obj.label ? `${obj.label} Class` : 'Unknown Class'}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={noteDrafts[idx] || ''}
                      onChange={(e) => setNoteDrafts({ ...noteDrafts, [idx]: e.target.value })}
                      placeholder="Add note..."
                      className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => addNoteForObject(obj, idx)}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                  {reviewNotes.filter(n => n.bbox && n.bbox[0] === obj.bbox?.[0] && n.bbox[1] === obj.bbox?.[1]).map((note, noteIdx) => (
                    <div key={noteIdx} className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                      <p className="text-yellow-800">{note.comment}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Reviewer Summary */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-4">REVIEWER SUMMARY</h3>
            <textarea
              value={reviewComments}
              onChange={(e) => setReviewComments(e.target.value)}
              placeholder="Overall comments..."
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows="4"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewerTask;
