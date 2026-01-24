import React, { useEffect, useState, useCallback } from 'react';
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
  const [viewMode, setViewMode] = useState('side-by-side');
  const [selectedError, setSelectedError] = useState('');
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
    } catch (error) {
      console.error('Error fetching task:', error);
    } finally {
      setLoading(false);
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
        navigate('/reviewer/tasks');
      } catch (error) {
        const errorMessage = error.response?.data?.message || 'Lỗi khi phê duyệt task';
        alert(errorMessage);
        console.error('Error approving task:', error);
      } finally {
        setProcessing(false);
      }
    }
  }, [id, reviewComments, reviewNotes, navigate]);

  const handleReject = useCallback(async () => {
    if (!reviewComments.trim()) {
      alert('Vui lòng nhập nhận xét khi từ chối task');
      return;
    }
    if (!reviewNotes || reviewNotes.length === 0) {
      alert('Bạn cần thêm ít nhất một ghi chú trên ảnh trước khi từ chối');
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
          errorCategory: errorCategory || 'other',
          reviewNotes: payloadNotes,
        });
        alert('Đã từ chối task thành công!');
        navigate('/reviewer/tasks');
      } catch (error) {
        const errorMessage = error.response?.data?.message || error.response?.data?.errors?.[0]?.msg || 'Lỗi khi từ chối task';
        alert(errorMessage);
        console.error('Error rejecting task:', error);
      } finally {
        setProcessing(false);
      }
    }
  }, [id, reviewComments, reviewNotes, errorCategory, navigate]);

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
        if (reviewComments.trim() && reviewNotes.length > 0) {
          handleReject();
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [task, reviewComments, reviewNotes, handleApprove, handleReject]);

  // Calculate accuracy/quality score
  const calculateQualityScore = () => {
    if (!task?.labels?.objects || task.labels.objects.length === 0) return 0;
    const totalObjects = task.labels.objects.length;
    const hasAnswers = task.labels.objects.filter(obj => obj.answer).length;
    const completeness = totalObjects > 0 ? (hasAnswers / totalObjects) * 100 : 0;
    return Math.round(completeness);
  };

  const qualityScore = calculateQualityScore();
  const isReviewed = task?.status === 'approved' || task?.status === 'rejected';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-gray-50">
      {/* Left Sidebar - Review Queue */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-gray-900">REVIEW QUEUE</h2>
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
              12 Pending
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-2">
            <div className="p-3 bg-green-50 border-2 border-green-300 rounded-lg cursor-pointer hover:bg-green-100">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900">TASK #{id?.substring(0, 8)}</span>
                <span className="text-xs text-gray-500">2m ago</span>
              </div>
              <p className="text-sm text-gray-700 mb-1">Vehicle Detection: Urban St.</p>
              <p className="text-xs text-gray-600">Annotator: {task?.annotatorId?.fullName || task?.annotatorId?.username || 'Unknown'}</p>
            </div>
            <div className="p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900">TASK #84022</span>
                <span className="text-xs text-gray-500">15m ago</span>
              </div>
              <p className="text-sm text-gray-700 mb-1">Lane Segmentation: Highway</p>
              <p className="text-xs text-gray-600">Annotator: Sarah K.</p>
            </div>
            <div className="p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900">TASK #84023</span>
                <span className="text-xs text-gray-500">1h ago</span>
              </div>
              <p className="text-sm text-gray-700 mb-1">Traffic Sign Recognition</p>
              <p className="text-xs text-gray-600">Annotator: John D.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-lg font-bold text-green-700">LABELCORE PRO - QUALITY AUDIT SYSTEM</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                <button 
                  onClick={() => setViewMode('side-by-side')}
                  className={`px-3 py-1 text-sm font-medium rounded ${viewMode === 'side-by-side' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                >
                  Side-by-Side
                </button>
                <button 
                  onClick={() => setViewMode('overlay')}
                  className={`px-3 py-1 text-sm font-medium rounded ${viewMode === 'overlay' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                >
                  Overlay View
                </button>
              </div>
              <button className="text-gray-600 hover:text-gray-900">🌙</button>
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-xs font-medium text-green-700">JD</span>
              </div>
            </div>
          </div>
        </div>


        {/* Main Content - Side by Side View */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900 mb-1">CURRENTLY AUDITING</h2>
            <p className="text-sm text-gray-600">{task?.dataItem?.filename || 'Image'}</p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Reference Guidelines */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">REFERENCE GUIDELINES</h3>
                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded">Strict Mode</span>
              </div>
          {task?.dataItem?.mimeType?.startsWith('image/') && (
                <div className="mb-3">
                  <ImageViewer
                    imageUrl={`${API_URL}/${task.dataItem.path}`}
                    annotations={[]}
                    labelSet={task?.projectId?.labelSet || []}
                    reviewNotes={[]}
                    readOnly={true}
                    maxHeight="300px"
                  />
                </div>
              )}
              <div className="text-sm text-gray-700">
                <p className="font-semibold mb-1">Guideline 2.4: Tight Bounding Boxes</p>
                <p className="text-gray-600">Ensure bounding boxes touch the outermost pixels of the object. No more than 2px gap allowed.</p>
              </div>
            </div>

            {/* Annotator Output */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-bold text-gray-900 mb-3">ANNOTATOR OUTPUT</h3>
              {task?.dataItem?.mimeType?.startsWith('image/') ? (
                <>
                  <div className="mb-3">
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
                      maxHeight="300px"
                      onAnnotationClick={(ann) => {
                        const element = document.getElementById(`object-${ann.index}`);
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-600 font-semibold">CONFIDENCE 94.2%</span>
                    <span className="text-gray-600">CLASSES {task?.labels?.objects?.length || 0} Total</span>
                    <span className="text-gray-600">TIME TAKEN 04:12s</span>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">Not an image</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Quality Metrics */}
        <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
          <div className="p-6 space-y-6">
            <div>
              <h3 className="font-bold text-gray-900 mb-4">QUALITY METRICS</h3>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Batch Progress</span>
                  <span className="text-sm font-semibold text-gray-900">75%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: '75%' }}></div>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-600">ACCURACY</span>
                  <p className="text-2xl font-bold text-gray-900">98.1</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">REJECTION</span>
                  <p className="text-2xl font-bold text-red-600">4.2%</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-4">ERROR CLASSIFICATION</h3>
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="error"
                    value="tightness"
                    checked={selectedError === 'tightness'}
                    onChange={(e) => setSelectedError(e.target.value)}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Tightness Issue</p>
                    <p className="text-xs text-gray-600">Bounding box doesn't fit object</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="error"
                    value="missed"
                    checked={selectedError === 'missed'}
                    onChange={(e) => setSelectedError(e.target.value)}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Missed Object</p>
                    <p className="text-xs text-gray-600">Visible object not labeled</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="error"
                    value="wrong_class"
                    checked={selectedError === 'wrong_class'}
                    onChange={(e) => setSelectedError(e.target.value)}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Wrong Class</p>
                    <p className="text-xs text-gray-600">Categorization error</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="error"
                    value="occlusion"
                    checked={selectedError === 'occlusion'}
                    onChange={(e) => setSelectedError(e.target.value)}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Occlusion Error</p>
                    <p className="text-xs text-gray-600">Improper handling of overlap</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      {!isReviewed && (
        <div className="border-t border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
          <input
            type="text"
          value={reviewComments}
          onChange={(e) => setReviewComments(e.target.value)}
            placeholder="Add mandatory feedback for rejection..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <div className="flex items-center gap-3 ml-4">
            <button
              onClick={handleReject}
              disabled={processing || !reviewComments.trim() || reviewNotes.length === 0}
              className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <span>×</span> Reject Annotation
            </button>
            <button
              onClick={handleApprove}
              disabled={processing}
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <span>✓</span> Approve Task
            </button>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <span className="text-sm text-gray-600">►I</span>
            <span className="text-sm text-gray-600">AUTO-NEXT</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoNext}
                onChange={(e) => setAutoNext(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewerTask;
