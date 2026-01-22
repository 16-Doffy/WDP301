import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';
import ImageAnnotator from '../../components/ImageAnnotator';

const AnnotatorTask = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [labels, setLabels] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [annotations, setAnnotations] = useState([]);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [selectedTool, setSelectedTool] = useState('bbox');
  const [rightTab, setRightTab] = useState('labels');
  const [brightness, setBrightness] = useState(100);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  const [zoom, setZoom] = useState(100);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [leftToolbarCollapsed, setLeftToolbarCollapsed] = useState(false);

  useEffect(() => {
    fetchTask();
  }, [id]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchTask = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/tasks/${id}`);
      setTask(response.data);
      const initialLabels = response.data.labels || {};
      setLabels(initialLabels);
      
      if (initialLabels.objects && Array.isArray(initialLabels.objects)) {
        const loadedAnnotations = initialLabels.objects.map((obj, idx) => ({
          id: Date.now() + idx,
          label: obj.label,
          bbox: obj.bbox || [0, 0, 10, 10],
          confidence: obj.confidence || 1.0,
          type: 'bbox',
          answer: obj.answer || null,
        }));
        setAnnotations(loadedAnnotations);
        
        // Calculate progress
        const projectData = response.data?.projectId;
        if (projectData?.questions && projectData.questions.length > 0) {
          const totalRequired = projectData.questions.length;
          const completed = loadedAnnotations.filter(a => a.answer).length;
          setProgress(totalRequired > 0 ? (completed / totalRequired) * 100 : 0);
        } else {
          setProgress(loadedAnnotations.length > 0 ? 50 : 0);
        }
      }
    } catch (error) {
      console.error('Error fetching task:', error);
      setMessage(`Lỗi: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAnnotationsChange = useCallback((newAnnotations) => {
    setAnnotations(newAnnotations);
    const labelsObj = {
      objects: newAnnotations.map(ann => ({
        label: ann.label,
        bbox: ann.bbox,
        confidence: ann.confidence,
        answer: ann.answer || null,
      })),
    };
    setLabels(labelsObj);
    
    // Update progress
    if (task?.projectId?.questions) {
      const totalRequired = task.projectId.questions.length || 0;
      const completed = newAnnotations.filter(a => a.answer).length;
      setProgress(totalRequired > 0 ? (completed / totalRequired) * 100 : 0);
    } else {
      setProgress(newAnnotations.length > 0 ? 50 : 0);
    }
  }, [task]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/tasks/${id}/label`, {
        labels,
        status: 'in_progress',
      });
      setMessage('Đã lưu thành công!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Lỗi khi lưu: ' + (error.response?.data?.message || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (Object.keys(labels).length === 0 || (labels.objects && labels.objects.length === 0)) {
      alert('Bạn chưa khoanh vùng đối tượng nào. Vui lòng thêm annotations trước khi nộp bài.');
      return;
    }

    if (!task?.reviewers || task.reviewers.length === 0) {
      alert('Task chưa được gán Reviewer. Liên hệ Manager để gán Reviewer trước khi nộp.');
      return;
    }

    if (task?.projectId?.questions && Array.isArray(task.projectId.questions) && task.projectId.questions.length > 0) {
      if (labels.objects && Array.isArray(labels.objects)) {
        const missingAnswers = [];
        labels.objects.forEach((obj, idx) => {
          if (!obj.answer || Object.keys(obj.answer).length === 0) {
            missingAnswers.push(`Đối tượng ${idx + 1} (${obj.label || 'chưa có label'})`);
          }
        });
        
        if (missingAnswers.length > 0) {
          alert(`Vui lòng trả lời câu hỏi cho các đối tượng sau:\n${missingAnswers.join('\n')}`);
          return;
        }
      }
    }

    if (window.confirm('Bạn có chắc chắn muốn nộp bài để review? Sau khi nộp, bạn sẽ không thể chỉnh sửa nữa cho đến khi được review.')) {
      setSaving(true);
      try {
        await axios.put(`${API_URL}/api/tasks/${id}/label`, {
          labels,
          status: 'in_progress',
        });
        await axios.post(`${API_URL}/api/tasks/${id}/submit`);
        alert('Nộp bài thành công! Reviewer sẽ kiểm tra và phản hồi.');
        navigate('/annotator/tasks');
      } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        setMessage('Lỗi khi nộp bài: ' + errorMessage);
        alert('Lỗi khi nộp bài: ' + errorMessage);
      } finally {
        setSaving(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Top Header Bar - Breadcrumbs & Actions */}
      <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">Projects</span>
          <span className="text-gray-400">/</span>
          <span className="text-gray-700 font-medium">{task?.projectId?.name || 'Project'}</span>
          <span className="text-gray-400">/</span>
          <span className="text-gray-900 font-semibold">Task #{id?.substring(0, 8) || 'XXXXX'}</span>
          <span className="ml-3 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">• LIVE SESSION</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-gray-500 leading-tight">BATCH PROGRESS</div>
              <div className="flex items-center gap-2">
                <div className="w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <span className="text-xs font-medium text-gray-700">{Math.round(progress)}%</span>
              </div>
            </div>
            <button className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1">History</button>
            <button className="text-gray-400 hover:text-gray-600 text-lg">🌙</button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Floating Left Toolbar */}
        {!leftToolbarCollapsed && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-30 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setSelectedTool('bbox')}
                className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
                  selectedTool === 'bbox' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Bounding Box (B)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2"/>
                </svg>
              </button>
              <button
                onClick={() => setSelectedTool('polygon')}
                className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
                  selectedTool === 'polygon' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Polygon (P)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                </svg>
              </button>
              <button
                onClick={() => setSelectedTool('point')}
                className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
                  selectedTool === 'point' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Point (O)"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="4"/>
                </svg>
              </button>
              <div className="border-t border-gray-200 my-1"></div>
              <button
                onClick={() => setZoom(Math.min(200, zoom + 10))}
                className="w-10 h-10 flex items-center justify-center rounded text-gray-600 hover:bg-gray-100"
                title="Zoom In (+)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"/>
                </svg>
              </button>
              <button
                onClick={() => setZoom(Math.max(25, zoom - 10))}
                className="w-10 h-10 flex items-center justify-center rounded text-gray-600 hover:bg-gray-100"
                title="Zoom Out (-)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"/>
                </svg>
              </button>
              <button
                onClick={() => setZoom(100)}
                className="w-10 h-10 flex items-center justify-center rounded text-gray-600 hover:bg-gray-100 text-xs font-medium"
                title="Reset Zoom (0)"
              >
                1:1
              </button>
            </div>
          </div>
        )}
        
        <button
          onClick={() => setLeftToolbarCollapsed(!leftToolbarCollapsed)}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-40 w-6 h-12 bg-white border border-gray-200 rounded-r-lg shadow-sm flex items-center justify-center hover:bg-gray-50"
        >
          <svg className={`w-4 h-4 text-gray-600 transition-transform ${leftToolbarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
          </svg>
        </button>

        {/* Canvas Area - 70-80% width */}
        <div className={`flex-1 flex flex-col overflow-hidden bg-gray-100 transition-all duration-300 ${rightPanelCollapsed ? '' : 'mr-80'}`}>
          {/* Image Canvas */}
          <div className="flex-1 overflow-auto relative" id="canvas-container">
            {task?.dataItem?.mimeType?.startsWith('image/') ? (
              <div className="flex items-center justify-center min-h-full p-8">
                <div className="bg-white rounded-lg shadow-xl border border-gray-200 relative" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center' }}>
                  <ImageAnnotator
                    imageUrl={`${API_URL}/${task.dataItem.path}`}
                    labelSet={task?.projectId?.labelSet || []}
                    questions={task?.projectId?.questions || []}
                    onAnnotationsChange={handleAnnotationsChange}
                    initialAnnotations={annotations}
                    selectedTool={selectedTool}
                    onMouseMove={(pos) => setMousePosition(pos)}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <p className="text-sm">File không phải hình ảnh. Vui lòng sử dụng JSON Editor.</p>
                </div>
              </div>
            )}
          </div>

          {/* Image Info Footer */}
          <div className="bg-white border-t border-gray-200 px-6 py-2 flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center gap-6">
              <span>Resolution: {task?.dataItem?.width || '1920'}x{task?.dataItem?.height || '1080'}</span>
              <span>Format: {task?.dataItem?.mimeType?.split('/')[1]?.toUpperCase() || 'PNG'}</span>
              <span>Camera: {task?.dataItem?.camera || 'Front_Main'}</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Image 1 of {task?.batchSize || 1}</span>
              <div className="flex items-center gap-2">
                <button className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50">←</button>
                <button className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50">→</button>
                <button className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50">☰</button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side Panel - Collapsible */}
        {!rightPanelCollapsed && (
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col shadow-lg">
            {/* Panel Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">FOUND OBJECTS ({annotations.length})</h3>
              <button
                onClick={() => setRightPanelCollapsed(true)}
                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 flex">
              <button
                onClick={() => setRightTab('labels')}
                className={`flex-1 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  rightTab === 'labels'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                OBJECTS
              </button>
              <button
                onClick={() => setRightTab('instructions')}
                className={`flex-1 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  rightTab === 'instructions'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                GUIDELINES
              </button>
              <button
                onClick={() => setRightTab('issues')}
                className={`flex-1 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors relative ${
                  rightTab === 'issues'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                ISSUES
                {task?.reviewNotes && task.reviewNotes.length > 0 && (
                  <span className="absolute top-1 right-2 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                    {task.reviewNotes.length}
                  </span>
                )}
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
              {rightTab === 'labels' && (
                <div className="p-4 space-y-3">
                  {/* Search */}
                  <input
                    type="text"
                    placeholder="Q Filter objects..."
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  {/* Label Classes */}
                  {task?.projectId?.labelSet && task.projectId.labelSet.length > 0 ? (
                    <div className="space-y-2">
                      {task.projectId.labelSet.map((label, idx) => {
                        const count = annotations.filter(a => a.label === label.name).length;
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              const existingAnn = annotations.find(a => a.label === label.name);
                              if (existingAnn) {
                                setSelectedAnnotation(existingAnn);
                              }
                            }}
                            className={`p-2.5 rounded-lg border cursor-pointer transition-colors ${
                              selectedAnnotation?.label === label.name
                                ? 'border-blue-300 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: label.color || '#3b82f6' }}
                                ></div>
                                <span className="text-xs font-medium text-gray-900">{label.name}</span>
                              </div>
                              <span className="text-xs text-gray-500">{count}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No labels defined</p>
                  )}

                  {/* Selected Annotation Attributes */}
                  {selectedAnnotation && task?.projectId?.questions && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <h4 className="text-xs font-semibold text-gray-900 mb-2">
                        {selectedAnnotation.label?.toUpperCase()} #{selectedAnnotation.id}
                      </h4>
                      {task.projectId.questions.map((question, qIdx) => (
                        <div key={qIdx} className="mb-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1.5">
                            {question.question}
                          </label>
                          {question.options ? (
                            <div className="space-y-1.5">
                              {question.options.map((opt) => (
                                <label key={opt.key} className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`question-${qIdx}`}
                                    value={opt.key}
                                    checked={selectedAnnotation.answer?.[qIdx] === opt.key}
                                    onChange={() => {
                                      const updated = annotations.map(a =>
                                        a.id === selectedAnnotation.id
                                          ? { ...a, answer: { ...a.answer, [qIdx]: opt.key } }
                                          : a
                                      );
                                      setAnnotations(updated);
                                    }}
                                    className="text-blue-600"
                                  />
                                  <span className="text-xs text-gray-700">{opt.value}</span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <input
                              type="text"
                              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={selectedAnnotation.answer?.[qIdx] || ''}
                              onChange={(e) => {
                                const updated = annotations.map(a =>
                                  a.id === selectedAnnotation.id
                                    ? { ...a, answer: { ...a.answer, [qIdx]: e.target.value } }
                                    : a
                                );
                                setAnnotations(updated);
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Review Feedback */}
                  {task?.status === 'rejected' && task?.reviewComments && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-xs font-semibold text-red-800 mb-1">
                        Reviewer: {task?.reviewers?.[0]?.reviewerId?.fullName || 'Reviewer'}
                      </p>
                      <p className="text-xs text-red-700 italic">"{task.reviewComments}"</p>
                    </div>
                  )}
                </div>
              )}

              {rightTab === 'instructions' && (
                <div className="p-4">
                  <h3 className="text-xs font-semibold text-gray-900 mb-3">GUIDELINES</h3>
                  <div className="prose prose-sm max-w-none">
                    <p className="text-xs text-gray-600 whitespace-pre-wrap mb-4 leading-relaxed">
                      {task?.projectId?.guidelines || 'No instructions provided.'}
                    </p>
                    {task?.projectId?.labelSet && task.projectId.labelSet.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 text-xs">
                          <span className="text-green-600 mt-0.5">✓</span>
                          <span className="text-gray-700">Boxes should include shadow under car.</span>
                        </div>
                        <div className="flex items-start gap-2 text-xs">
                          <span className="text-red-600 mt-0.5">✗</span>
                          <span className="text-gray-700">Do not label occluded parts.</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {rightTab === 'issues' && (
                <div className="p-4">
                  <h3 className="text-xs font-semibold text-gray-900 mb-3">ISSUES & COMMENTS</h3>
                  {task?.reviewNotes && task.reviewNotes.length > 0 ? (
                    <div className="space-y-2">
                      {task.reviewNotes.map((note, idx) => (
                        <div key={idx} className="p-2.5 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-xs font-medium text-red-800 mb-1">
                            Position: [{Math.round(note.bbox?.[0] || 0)}%, {Math.round(note.bbox?.[1] || 0)}%]
                          </p>
                          <p className="text-xs text-red-700">{note.comment}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No issues reported</p>
                  )}
                </div>
              )}
            </div>

            {/* Panel Footer */}
            <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50">
              <div className="text-xs text-gray-600 text-center">
                VIEWS ({annotations.length}/{annotations.length})
              </div>
            </div>
          </div>
        )}

        {/* Collapse Button for Right Panel */}
        {rightPanelCollapsed && (
          <button
            onClick={() => setRightPanelCollapsed(false)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-30 w-6 h-12 bg-white border border-gray-200 rounded-l-lg shadow-sm flex items-center justify-center hover:bg-gray-50"
          >
            <svg className="w-4 h-4 text-gray-600 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="bg-white border-t border-gray-200 px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1">← PREVIOUS</button>
          <button className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1">SKIP →</button>
          <button className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1">REQUEST REVISION</button>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || task?.status === 'submitted' || task?.status === 'approved'}
            className="px-4 py-1.5 text-xs font-medium bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            SAVE DRAFT
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || task?.status === 'submitted' || task?.status === 'approved'}
            className={`px-6 py-1.5 text-xs font-semibold text-white rounded transition-colors ${
              task?.status === 'rejected' 
                ? 'bg-yellow-600 hover:bg-yellow-700' 
                : 'bg-green-600 hover:bg-green-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            APPROVE BATCH
          </button>
        </div>
      </div>

      {/* Global Status Bar */}
      <div className="bg-gray-900 text-gray-300 px-6 py-1.5 flex items-center justify-between text-[10px] font-mono">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
            <span>CONNECTED</span>
          </span>
          <span>MOUSE: {mousePosition.x}, {mousePosition.y}</span>
          <span>ZOOM: {zoom}%</span>
          <span>LABELS: {annotations.length}</span>
        </div>
        <div className="flex items-center gap-4">
          <span>SHORTCUTS: B=Box, P=Polygon, O=Point, +/-=Zoom, 0=Reset</span>
          <span className="text-green-400">AUTO-SAVE ACTIVE</span>
        </div>
      </div>

      {/* Message Alert */}
      {message && (
        <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {message}
        </div>
      )}
    </div>
  );
};

export default AnnotatorTask;
