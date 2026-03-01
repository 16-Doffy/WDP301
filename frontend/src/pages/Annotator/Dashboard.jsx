import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';

const AnnotatorDashboard = () => {
  const [batches, setBatches] = useState([]);

  const getTaskFormat = (task) => {
    const mime = (task?.dataItem?.mimeType || '').toLowerCase();
    const fileName = (task?.dataItem?.originalName || task?.dataItem?.filename || task?.dataItem?.path || '').toLowerCase();

    if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(fileName)) return 'image';
    if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|mp4)$/i.test(fileName)) return 'audio';
    if (mime.startsWith('text/') || ['application/json', 'application/xml', 'text/csv'].includes(mime) || /\.(txt|csv|json|xml)$/i.test(fileName)) return 'text';
    return 'other';
  };
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/tasks/my-tasks`);
      const tasks = response.data || [];
      
      // Group tasks by dataset
      const batchMap = new Map();
      tasks.forEach(task => {
        const datasetId = task.datasetId?._id || task.datasetId || 'unknown';
        const datasetName = task.datasetId?.name || 'Unknown Dataset';
        const projectName = task.projectId?.name || 'Unknown Project';
        const taskFormat = getTaskFormat(task);
        
        if (!batchMap.has(datasetId)) {
          batchMap.set(datasetId, {
            id: datasetId,
            name: datasetName,
            project: projectName,
            tasks: [],
            totalTasks: 0,
            completedTasks: 0,
            inProgressTasks: 0,
            status: 'new',
            assignedDate: task.createdAt || new Date(),
            previewImage: task.dataItem?.path || null,
            deadline: task.projectId?.deadline || null,
            format: taskFormat,
          });
        }
        
        const batch = batchMap.get(datasetId);
        if (batch.format !== taskFormat) {
          batch.format = 'mixed';
        }
        batch.tasks.push(task);
        batch.totalTasks++;
        
        // Determine review stages
        const isApproved = task.status === 'approved';
        const isPendingReview = task.status === 'submitted';
        const isWorking = ['in_progress', 'rejected', 'assigned', 'new', undefined, null].includes(task.status);

        if (isApproved) {
          batch.completedTasks++;
        }
        if (isPendingReview) {
          batch.completedTasks++;
        }
        if (isWorking) {
          batch.inProgressTasks++;
        }

        // Determine batch status by reviewer stage
        const approvedCount = batch.tasks.filter((t) => t.status === 'approved').length;
        const submittedCount = batch.tasks.filter((t) => t.status === 'submitted').length;
        const totalCount = batch.totalTasks;

        if (approvedCount === totalCount && totalCount > 0) {
          batch.status = 'completed';
        } else if (approvedCount + submittedCount === totalCount && submittedCount > 0) {
          batch.status = 'pending';
        } else if (batch.inProgressTasks > 0 || batch.completedTasks > 0) {
          batch.status = 'in_progress';
        } else {
          batch.status = 'new';
        }

        // Check overdue by deadline (only lock unfinished/non-reviewed items)
        if (batch.deadline && new Date(batch.deadline) < new Date() && !['completed', 'pending'].includes(batch.status)) {
          batch.status = 'overdue';
        }
        
        // Get earliest assigned date
        if (new Date(task.createdAt) < new Date(batch.assignedDate)) {
          batch.assignedDate = task.createdAt;
        }
        
        // Get first image as preview
        if (!batch.previewImage && task.dataItem?.path) {
          batch.previewImage = task.dataItem.path;
        }
      });
      
      const batchesList = Array.from(batchMap.values());
      setBatches(batchesList);
    } catch (error) {
      console.error('Error fetching batches:', error);
      if (error.response?.status === 403) {
        alert('Bạn không có quyền xem tasks. Vui lòng liên hệ Manager.');
      } else {
        alert('Lỗi khi tải danh sách batches: ' + (error.response?.data?.message || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      new: { text: 'NEW', color: 'bg-green-100 text-green-800' },
      in_progress: { text: 'IN PROGRESS', color: 'bg-blue-100 text-blue-800' },
      pending: { text: 'PENDING REVIEW', color: 'bg-yellow-100 text-yellow-800' },
      completed: { text: 'COMPLETED', color: 'bg-gray-100 text-gray-800' },
      overdue: { text: 'OVERDUE', color: 'bg-red-100 text-red-800' },
      urgent: { text: 'URGENT', color: 'bg-orange-100 text-orange-800' },
    };
    return badges[status] || badges.new;
  };

  const getProgressPercentage = (batch) => {
    if (batch.totalTasks === 0) return 0;
    return Math.round((batch.completedTasks / batch.totalTasks) * 100);
  };

  // Filter & Sort controls
  const [filterStatus, setFilterStatus] = useState('all'); // all | active | pending | completed | overdue
  const [sortDir] = useState('asc'); // asc => Active>Pending>Completed>Overdue, desc => reverse

  const isPendingReviewBatch = (batch) => {
    const hasSubmittedTask = batch.tasks.some((task) => task.status === 'submitted');
    const isAllDoneByAnnotator = batch.tasks.every((task) => task.status === 'submitted' || task.status === 'approved');
    return hasSubmittedTask && isAllDoneByAnnotator;
  };

  const isCompletedReviewedBatch = (batch) => {
    return batch.tasks.length > 0 && batch.tasks.every((task) => task.status === 'approved');
  };

  // Apply search, filter and sort
  const statusOrder = { in_progress: 0, new: 0, pending_review: 1, completed: 2, overdue: 3 };

  const filteredSorted = batches
    .filter(batch => {
      const matchesSearch = batch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        batch.project.toLowerCase().includes(searchTerm.toLowerCase());

      const pendingReview = isPendingReviewBatch(batch);
      const reviewedCompleted = isCompletedReviewedBatch(batch);

      const filterMatch = filterStatus === 'all' ||
        (filterStatus === 'active' && !pendingReview && !reviewedCompleted && batch.status !== 'overdue') ||
        (filterStatus === 'pending' && pendingReview) ||
        (filterStatus === 'completed' && reviewedCompleted) ||
        (filterStatus === 'overdue' && batch.status === 'overdue');

      return matchesSearch && filterMatch;
    })
    .sort((a, b) => {
      const statusA = isPendingReviewBatch(a) ? 'pending_review' : a.status;
      const statusB = isPendingReviewBatch(b) ? 'pending_review' : b.status;
      const diff = statusOrder[statusA] - statusOrder[statusB];
      return sortDir === 'asc' ? diff : -diff;
    });

  // Separate batches by section
  const overdueBatches = filteredSorted.filter(batch => batch.status === 'overdue');

  const activeBatches = filteredSorted.filter(batch => {
    const pendingReview = isPendingReviewBatch(batch);
    const reviewedCompleted = isCompletedReviewedBatch(batch);
    return !pendingReview && !reviewedCompleted && batch.status !== 'overdue';
  });

  const pendingReviewBatches = filteredSorted.filter(batch => isPendingReviewBatch(batch));

  const completedBatches = filteredSorted.filter(batch => isCompletedReviewedBatch(batch));

  const getFormatUi = (format) => {
    const map = {
      image: {
        icon: '🖼️',
        label: 'Image Project',
        pill: 'bg-sky-100 text-sky-800',
        border: 'border-sky-200',
      },
      audio: {
        icon: '🎧',
        label: 'Audio Project',
        pill: 'bg-violet-100 text-violet-800',
        border: 'border-violet-200',
      },
      text: {
        icon: '📄',
        label: 'Text Project',
        pill: 'bg-emerald-100 text-emerald-800',
        border: 'border-emerald-200',
      },
      mixed: {
        icon: '🧩',
        label: 'Mixed Project',
        pill: 'bg-amber-100 text-amber-800',
        border: 'border-amber-200',
      },
      other: {
        icon: '📦',
        label: 'Other Format',
        pill: 'bg-gray-100 text-gray-800',
        border: 'border-gray-200',
      },
    };

    return map[format] || map.other;
  };

  // Helper function to render batch card
  const renderBatchCard = (batch) => {
    const progress = getProgressPercentage(batch);
    const statusBadge = getStatusBadge(batch.status);
    const firstTask = batch.tasks[0];
    const formatUi = getFormatUi(batch.format);

    return (
      <div
        key={batch.id}
        className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-shadow ${batch.status === 'overdue' ? 'cursor-not-allowed opacity-95' : 'hover:shadow-md cursor-pointer'}`}
        onClick={() => {
          if (batch.status === 'overdue') return;
          if (firstTask) {
            navigate(`/annotator/tasks/${firstTask._id}`);
          }
        }}
      >
        {/* Media Preview (format-based) */}
        <div className={`relative h-48 overflow-hidden ${formatUi.border} border-b`}>
          {batch.format === 'image' && batch.previewImage ? (
            <img
              src={`${API_URL}/${batch.previewImage}`}
              alt={batch.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
              <div className="text-center">
                <div className="text-5xl mb-2">{formatUi.icon}</div>
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${formatUi.pill}`}>
                  {formatUi.label}
                </div>
              </div>
            </div>
          )}
          <div className={`absolute top-3 left-3 px-2 py-1 rounded text-xs font-semibold ${formatUi.pill}`}>
            {formatUi.label}
          </div>
          <div className={`absolute top-3 right-3 px-2 py-1 rounded text-xs font-medium ${statusBadge.color}`}>
            {statusBadge.text}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
        </div>

        {/* Batch Info */}
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 mb-1">{batch.name}</h3>
          <p className="text-sm text-gray-600 mb-2">Project: {batch.project}</p>
          
          {/* Task Status Summary */}
          {batch.tasks.some(t => t.status === 'rejected') && (
            <div className="mb-2 px-2 py-1 bg-red-50 border border-red-200 rounded text-xs">
              <span className="text-red-700 font-semibold">⚠ {batch.tasks.filter(t => t.status === 'rejected').length} task(s) rejected - needs revision</span>
            </div>
          )}
          {batch.tasks.some(t => t.status === 'approved') && (
            <div className="mb-2 px-2 py-1 bg-green-50 border border-green-200 rounded text-xs">
              <span className="text-green-700 font-semibold">✓ {batch.tasks.filter(t => t.status === 'approved').length} task(s) approved</span>
            </div>
          )}
          {batch.tasks.some(t => t.status === 'submitted') && (
            <div className="mb-2 px-2 py-1 bg-yellow-50 border border-yellow-200 rounded text-xs">
              <span className="text-yellow-700 font-semibold">⏳ {batch.tasks.filter(t => t.status === 'submitted').length} task(s) pending review</span>
            </div>
          )}

          {/* Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Progress</span>
              <span className="text-sm font-medium text-gray-900">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>


          {/* Assigned time & Deadline */}
          <div className="text-xs text-gray-500 mb-4 space-y-1">
            <div>
              Assigned: {batch.assignedDate ? new Date(batch.assignedDate).toLocaleString('vi-VN') : '-'}
            </div>
            {batch.deadline && (
              <div className="text-red-600 font-semibold">
                Deadline: {new Date(batch.deadline).toLocaleString('vi-VN')}
              </div>
            )}
          </div>

          {/* Action Button */}
          {(() => {
            const rejectedTask = batch.tasks.find(t => t.status === 'rejected');
            const inProgressTask = batch.tasks.find(t => t.status === 'in_progress');
            const newTask = batch.tasks.find(t => !t.status || t.status === 'new' || t.status === 'assigned');
            const submittedTask = batch.tasks.find(t => t.status === 'submitted');
            const approvedTask = batch.tasks.find(t => t.status === 'approved');
            const targetTask = rejectedTask || inProgressTask || newTask || submittedTask || approvedTask || firstTask;
            
            let buttonText = 'View Tasks';
            let buttonColor = 'bg-blue-600 text-white hover:bg-blue-700';
            
            if (rejectedTask) {
              buttonText = '🔧 Fix Rejected Task';
              buttonColor = 'bg-red-600 text-white hover:bg-red-700';
            } else if (inProgressTask) {
              buttonText = 'Continue Labeling';
              buttonColor = 'bg-blue-600 text-white hover:bg-blue-700';
            } else if (newTask) {
              buttonText = 'Start Labeling';
              buttonColor = 'bg-green-600 text-white hover:bg-green-700';
            } else if (submittedTask) {
              buttonText = '⏳ Check Review Status';
              buttonColor = 'bg-yellow-600 text-white hover:bg-yellow-700';
            } else if (batch.tasks.every(t => t.status === 'approved')) {
              buttonText = '✓ View Completed';
              buttonColor = 'bg-green-500 text-white hover:bg-green-600';
            }
            
            if (batch.status === 'overdue') {
              return (
                <button
                  type="button"
                  disabled
                  className="w-full py-2 rounded-lg font-medium bg-gray-200 text-gray-500 cursor-not-allowed"
                  title="Project đã quá hạn, không thể thực hiện lại"
                >
                  Overdue - Locked
                </button>
              );
            }

            return (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (targetTask) {
                    navigate(`/annotator/tasks/${targetTask._id}`);
                  }
                }}
                className={`w-full py-2 rounded-lg font-medium transition-colors ${buttonColor}`}
              >
                {buttonText}
              </button>
            );
          })()}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-transparent">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8">
      <div className="rounded-[28px] p-6 md:p-8 bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 shadow-[0_30px_80px_rgba(0,0,0,0.28)] border border-white/20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.25),transparent_50%),radial-gradient(circle_at_85%_30%,rgba(255,255,255,0.18),transparent_45%)] pointer-events-none" />

        <div className="relative mb-6">
          <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">My Tasks</h1>
          <p className="text-white/80">Manage and track your assigned data collection batches.</p>
      </div>

      {/* Search and Filter */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search batches..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-white/50 rounded-lg bg-white text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ color: '#111827' }}
        >
          <option value="all" style={{ color: '#111827', backgroundColor: '#ffffff' }}>All</option>
          <option value="active" style={{ color: '#111827', backgroundColor: '#ffffff' }}>Active Projects</option>
          <option value="pending" style={{ color: '#111827', backgroundColor: '#ffffff' }}>Pending Review Projects</option>
          <option value="completed" style={{ color: '#111827', backgroundColor: '#ffffff' }}>Completed Projects</option>
          <option value="overdue" style={{ color: '#111827', backgroundColor: '#ffffff' }}>Overdue Tasks</option>
        </select>

      </div>

      {/* --OVERDUE-SECTION-REMOVED-- */}
      {false && overdueBatches.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-red-800">Overdue Tasks</h2>
              <p className="text-sm text-red-600 mt-1">Các project đã quá hạn deadline</p>
            </div>
            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
              {overdueBatches.length} Overdue
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {overdueBatches.map((batch) => {
              return renderBatchCard(batch);
            })}
          </div>
        </div>
      )}

      {/* --SECTIONS-START-- */}
      {(filterStatus==='all' || filterStatus==='active') &&
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Active Projects</h2>
            <p className="text-sm text-gray-600 mt-1">Các project đang được giao và cần hoàn thành</p>
          </div>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            {activeBatches.length} Active
          </span>
        </div>

        {activeBatches.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-600 mb-4">
              {searchTerm ? 'No active batches found matching your search.' : 'Bạn chưa có project nào đang được giao. Vui lòng liên hệ Manager để được phân công tasks.'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => alert('Vui lòng liên hệ Manager để được phân thêm batch.')}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Request Batch
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeBatches.map((batch) => {
              return renderBatchCard(batch);
            })}

            {/* Request More Work Card - Only show in active section */}
            <div className="bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300 p-8 flex flex-col items-center justify-center text-center hover:border-blue-400 transition-colors">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">✓</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Request More Work</h3>
              <p className="text-sm text-gray-600 mb-4">
                Finished your batches? Ask your manager for more assignments.
              </p>
              <button className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                Request Batch
              </button>
            </div>
          </div>
        )}
      </div>
      }

      {(filterStatus === 'all' || filterStatus === 'pending') && pendingReviewBatches.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Pending Review Projects</h2>
              <p className="text-sm text-gray-600 mt-1">Các project đã nộp và đang chờ reviewer chấm</p>
            </div>
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
              {pendingReviewBatches.length} Pending
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingReviewBatches.map((batch) => {
              return renderBatchCard(batch);
            })}
          </div>
        </div>
      )}

      {(filterStatus === 'all' || filterStatus === 'completed') && completedBatches.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Completed Projects</h2>
              <p className="text-sm text-gray-600 mt-1">Các project đã được reviewer chấm xong</p>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              {completedBatches.length} Completed
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {completedBatches.map((batch) => {
              return renderBatchCard(batch);
            })}
          </div>
        </div>
      )}

      {/* --OVERDUE-SECTION-NEW-- */}
      {overdueBatches.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-red-800">Overdue Tasks</h2>
              <p className="text-sm text-red-600 mt-1">Các project đã quá hạn deadline</p>
            </div>
            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
              {overdueBatches.length} Overdue
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {overdueBatches.map((batch) => {
              return renderBatchCard(batch);
            })}
          </div>
        </div>
      )}

      {/* Show empty state only if all sections are empty */}
      {activeBatches.length === 0 && pendingReviewBatches.length === 0 && completedBatches.length === 0 && !searchTerm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-600 mb-4">
            Bạn chưa có batches nào được phân công. Vui lòng liên hệ Manager để được phân công tasks.
          </p>
          <button
            onClick={() => alert('Vui lòng liên hệ Manager để được phân thêm batch.')}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Request Batch
          </button>
        </div>
      )}
      </div>
    </div>
  );
};

export default AnnotatorDashboard;
