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
          // If no questions, progress based on annotations count
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
      // If no questions, progress based on annotations count
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

    // Check if project has questions and validate answers
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-purple-700">Annotator Task Studio</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">PROJECT</span>
              <span className="text-gray-900 font-semibold">{task?.projectId?.name || 'Project'}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-gray-500">TASK PROGRESS</div>
              <div className="text-sm font-bold text-gray-900">
                {Math.round(progress)} / 100
              </div>
            </div>
            <button className="text-gray-600 hover:text-gray-900 text-xl">🌙</button>
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-xs font-medium text-purple-700">U</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Tools */}
        <div className="w-16 bg-gray-800 flex flex-col items-center py-4 gap-3">
          <button
            onClick={() => setSelectedTool('send')}
            className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors ${
              selectedTool === 'send' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Send/Submit"
          >
            ✈️
          </button>
          <button
            onClick={() => setSelectedTool('bbox')}
            className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors ${
              selectedTool === 'bbox' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Bounding Box"
          >
            ▢
          </button>
          <button
            onClick={() => setSelectedTool('polygon')}
            className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors ${
              selectedTool === 'polygon' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Polygon"
          >
            ⬟
          </button>
          <button
            onClick={() => setSelectedTool('point')}
            className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors ${
              selectedTool === 'point' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Point"
          >
            🎯
          </button>
          <button
            onClick={() => setSelectedTool('edit')}
            className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors ${
              selectedTool === 'edit' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Edit"
          >
            ✏️
          </button>
          <div className="border-t border-gray-600 my-2 w-8"></div>
          <button
            onClick={() => {/* Zoom in */}}
            className="w-12 h-12 flex items-center justify-center rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            title="Zoom In"
          >
            🔍+
          </button>
          <button
            onClick={() => {/* Zoom out */}}
            className="w-12 h-12 flex items-center justify-center rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            title="Zoom Out"
          >
            🔍-
          </button>
          <button
            onClick={() => {/* Pan */}}
            className="w-12 h-12 flex items-center justify-center rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            title="Pan"
          >
            ✋
          </button>
        </div>

        {/* Main Annotation Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Task Info Bar */}
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">
                Task ID: {id?.substring(0, 8) || 'TSK-XXXXX'}
              </span>
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <button className="text-xs text-blue-600 hover:text-blue-800">View History</button>
            </div>
          </div>

          {/* Image Annotation Area */}
          <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
          {task?.dataItem?.mimeType?.startsWith('image/') ? (
              <div className="bg-white rounded-lg shadow-lg p-4">
                <ImageAnnotator
                  imageUrl={`${API_URL}/${task.dataItem.path}`}
                  labelSet={task?.projectId?.labelSet || []}
                  questions={task?.projectId?.questions || []}
                  onAnnotationsChange={handleAnnotationsChange}
                  initialAnnotations={annotations}
                />
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                File không phải hình ảnh. Vui lòng sử dụng JSON Editor.
              </div>
            )}
          </div>

          {/* Bottom Action Bar */}
          <div className="border-t border-gray-200 bg-white px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button className="text-sm text-gray-600 hover:text-gray-900">← PREVIOUS TASK</button>
              <button className="text-sm text-gray-600 hover:text-gray-900">SKIP →</button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">Brightness</span>
              <input
                type="range"
                min="0"
                max="200"
                value={brightness}
                onChange={(e) => setBrightness(e.target.value)}
                className="w-32"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving || task?.status === 'submitted' || task?.status === 'approved'}
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                SAVE DRAFT
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || task?.status === 'submitted' || task?.status === 'approved'}
                className={`px-4 py-2 rounded-lg font-medium text-white transition-colors ${
                  task?.status === 'rejected' 
                    ? 'bg-yellow-600 hover:bg-yellow-700' 
                    : 'bg-purple-600 hover:bg-purple-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                COMPLETE & SUBMIT
              </button>
            </div>
          </div>

          {/* Status Bar */}
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-1.5 flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                STATUS: CONNECTED
              </span>
              <span>MOUSE POSITION: {mousePosition.x}, {mousePosition.y}</span>
            </div>
            <div className="flex items-center gap-4">
              <span>LABELS: {annotations.length}</span>
              <span>OBJECTS: {annotations.length}</span>
              <span className="text-green-600">AUTO-SAVE ACTIVE</span>
            </div>
          </div>
        </div>

        {/* Right Panel - Tabs */}
        <div className="w-96 border-l border-gray-200 bg-white flex flex-col">
          {/* Tabs */}
          <div className="border-b border-gray-200 flex">
            <button
              onClick={() => setRightTab('labels')}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                rightTab === 'labels'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              LABELS
            </button>
            <button
              onClick={() => setRightTab('instructions')}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                rightTab === 'instructions'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              INSTRUCTIONS
            </button>
            <button
              onClick={() => setRightTab('issues')}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors relative ${
                rightTab === 'issues'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              ISSUES
              {task?.reviewNotes && task.reviewNotes.length > 0 && (
                <span className="absolute top-1 right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {task.reviewNotes.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {rightTab === 'labels' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 mb-4">LABEL CLASSES</h3>
                {task?.projectId?.labelSet && task.projectId.labelSet.length > 0 ? (
                  <div className="space-y-2">
                    {task.projectId.labelSet.map((label, idx) => {
                      const count = annotations.filter(a => a.label === label.name).length;
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            // Find first annotation with this label, or create a new one
                            const existingAnn = annotations.find(a => a.label === label.name);
                            if (existingAnn) {
                              setSelectedAnnotation(existingAnn);
                            }
                          }}
                          className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                            selectedTool === 'bbox' ? 'border-purple-300 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: label.color || '#9333ea' }}
                            ></div>
                            <span className="font-medium text-gray-900">{label.name}</span>
                          </div>
                          <span className="text-sm text-gray-600">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No labels defined</p>
                )}

                {/* Attributes for selected annotation */}
                {selectedAnnotation && task?.projectId?.questions && (
                  <div className="mt-6">
                    <h4 className="font-semibold text-gray-900 mb-3">
                      ATTRIBUTES: {selectedAnnotation.label?.toUpperCase()} #{selectedAnnotation.id}
                    </h4>
                    {task.projectId.questions.map((question, qIdx) => (
                      <div key={qIdx} className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {question.question}
                        </label>
                        {question.options ? (
                          <div className="space-y-2">
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
                                  className="text-purple-600"
                                />
                                <span className="text-sm text-gray-700">{opt.value}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <input
                            type="text"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                  <div className="mt-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                    <p className="text-sm font-semibold text-red-800 mb-2">
                      Reviewer: {task?.reviewers?.[0]?.reviewerId?.fullName || 'Reviewer'} {task?.reviewedAt ? `${Math.floor((Date.now() - new Date(task.reviewedAt).getTime()) / (1000 * 60 * 60))}h ago` : ''}
                    </p>
                    <p className="text-sm text-red-700 italic">"{task.reviewComments}"</p>
                  </div>
                )}

                {/* Next in Queue */}
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">NEXT IN QUEUE</h4>
                  <div className="flex gap-2">
                    <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center">👍</div>
                    <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center">👎</div>
                    <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center">⋯</div>
                    <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center">?</div>
                  </div>
                </div>
              </div>
            )}

            {rightTab === 'instructions' && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">INSTRUCTIONS</h3>
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-600 whitespace-pre-wrap mb-4">
                    {task?.projectId?.guidelines || 'No instructions provided.'}
                  </p>
                  {task?.projectId?.labelSet && task.projectId.labelSet.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-green-600">✓</span>
                        <span className="text-gray-700">Boxes should include shadow under car.</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-red-600">✗</span>
                        <span className="text-gray-700">Do not label occluded parts.</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {rightTab === 'issues' && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">ISSUES</h3>
                {task?.reviewNotes && task.reviewNotes.length > 0 ? (
                  <div className="space-y-3">
                    {task.reviewNotes.map((note, idx) => (
                      <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm font-medium text-red-800 mb-1">
                          Position: [{Math.round(note.bbox?.[0] || 0)}%, {Math.round(note.bbox?.[1] || 0)}%]
                        </p>
                        <p className="text-sm text-red-700">{note.comment}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No issues reported</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnotatorTask;
