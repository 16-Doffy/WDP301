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
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterFormat, setFilterFormat] = useState('all');
  const [sortDir] = useState('asc');
  const navigate = useNavigate();

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/tasks/my-tasks`);
      const tasks = response.data || [];

      const batchMap = new Map();
      tasks.forEach((task) => {
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

        const isApproved = task.status === 'approved';
        const isPendingReview = task.status === 'submitted';
        const isWorking = ['in_progress', 'rejected', 'assigned', 'new', undefined, null].includes(task.status);

        if (isApproved || isPendingReview) {
          batch.completedTasks++;
        }
        if (isWorking) {
          batch.inProgressTasks++;
        }

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

        if (batch.deadline && new Date(batch.deadline) < new Date() && !['completed', 'pending'].includes(batch.status)) {
          batch.status = 'overdue';
        }

        if (new Date(task.createdAt) < new Date(batch.assignedDate)) {
          batch.assignedDate = task.createdAt;
        }

        if (!batch.previewImage && task.dataItem?.path) {
          batch.previewImage = task.dataItem.path;
        }
      });

      setBatches(Array.from(batchMap.values()));
    } catch (error) {
      console.error('Error fetching batches:', error);
      if (error.response?.status === 403) {
        alert('Bạn không có quyền xem tasks. Vui lòng liên hệ Manager.');
      } else {
        alert(`Lỗi khi tải danh sách batches: ${error.response?.data?.message || error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      new: { text: 'NEW', color: 'bg-emerald-500/10 text-emerald-400' },
      in_progress: { text: 'IN PROGRESS', color: 'bg-blue-500/10 text-blue-400' },
      pending: { text: 'PENDING REVIEW', color: 'bg-amber-500/10 text-amber-400' },
      completed: { text: 'COMPLETED', color: 'bg-gray-500/10 text-gray-300' },
      overdue: { text: 'OVERDUE', color: 'bg-rose-500/10 text-rose-400' },
      urgent: { text: 'URGENT', color: 'bg-orange-500/10 text-orange-400' },
    };
    return badges[status] || badges.new;
  };

  const getProgressPercentage = (batch) => {
    if (batch.totalTasks === 0) return 0;
    return Math.round((batch.completedTasks / batch.totalTasks) * 100);
  };

  const isPendingReviewBatch = (batch) => {
    const hasSubmittedTask = batch.tasks.some((task) => task.status === 'submitted');
    const isAllDoneByAnnotator = batch.tasks.every((task) => task.status === 'submitted' || task.status === 'approved');
    return hasSubmittedTask && isAllDoneByAnnotator;
  };

  const isCompletedReviewedBatch = (batch) => batch.tasks.length > 0 && batch.tasks.every((task) => task.status === 'approved');

  const statusOrder = { in_progress: 0, new: 0, pending_review: 1, completed: 2, overdue: 3 };

  const filteredSorted = batches
    .filter((batch) => {
      const matchesSearch =
        batch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        batch.project.toLowerCase().includes(searchTerm.toLowerCase());

      const pendingReview = isPendingReviewBatch(batch);
      const reviewedCompleted = isCompletedReviewedBatch(batch);

      const filterMatch =
        filterStatus === 'all' ||
        (filterStatus === 'active' && !pendingReview && !reviewedCompleted && batch.status !== 'overdue') ||
        (filterStatus === 'pending' && pendingReview) ||
        (filterStatus === 'completed' && reviewedCompleted) ||
        (filterStatus === 'overdue' && batch.status === 'overdue');

      const formatMatch = filterFormat === 'all' || batch.format === filterFormat;

      return matchesSearch && filterMatch && formatMatch;
    })
    .sort((a, b) => {
      const statusA = isPendingReviewBatch(a) ? 'pending_review' : a.status;
      const statusB = isPendingReviewBatch(b) ? 'pending_review' : b.status;
      const diff = statusOrder[statusA] - statusOrder[statusB];
      return sortDir === 'asc' ? diff : -diff;
    });

  const overdueBatches = filteredSorted.filter((batch) => batch.status === 'overdue');
  const activeBatches = filteredSorted.filter((batch) => {
    const pendingReview = isPendingReviewBatch(batch);
    const reviewedCompleted = isCompletedReviewedBatch(batch);
    return !pendingReview && !reviewedCompleted && batch.status !== 'overdue';
  });
  const pendingReviewBatches = filteredSorted.filter((batch) => isPendingReviewBatch(batch));
  const completedBatches = filteredSorted.filter((batch) => isCompletedReviewedBatch(batch));

  const getFormatUi = (format) => {
    const map = {
      image: {
        icon: '🖼️',
        label: 'Image Project',
        pill: 'bg-sky-500/10 text-sky-300',
        border: 'border-sky-700/40',
      },
      audio: {
        icon: '🎧',
        label: 'Audio Project',
        pill: 'bg-violet-500/10 text-violet-300',
        border: 'border-violet-700/40',
      },
      text: {
        icon: '📄',
        label: 'Text Project',
        pill: 'bg-emerald-500/10 text-emerald-300',
        border: 'border-emerald-700/40',
      },
      mixed: {
        icon: '🧩',
        label: 'Mixed Project',
        pill: 'bg-amber-500/10 text-amber-300',
        border: 'border-amber-700/40',
      },
      other: {
        icon: '📦',
        label: 'Other Format',
        pill: 'bg-gray-500/10 text-gray-300',
        border: 'border-gray-700/40',
      },
    };

    return map[format] || map.other;
  };

  const renderBatchCard = (batch) => {
    const progress = getProgressPercentage(batch);
    const statusBadge = getStatusBadge(batch.status);
    const firstTask = batch.tasks[0];
    const formatUi = getFormatUi(batch.format);

    return (
      <div
        key={batch.id}
        className={`overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-lg transition ${
          batch.status === 'overdue' ? 'cursor-not-allowed opacity-95' : 'cursor-pointer hover:border-gray-600'
        }`}
        onClick={() => {
          if (batch.status === 'overdue') return;
          if (firstTask) navigate(`/annotator/tasks/${firstTask._id}`);
        }}
      >
        <div className={`relative h-48 overflow-hidden border-b ${formatUi.border}`}>
          {batch.format === 'image' && batch.previewImage ? (
            <img
              src={`${API_URL}/${batch.previewImage}`}
              alt={batch.name}
              className="h-full w-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
              <div className="text-center">
                <div className="mb-2 text-5xl">{formatUi.icon}</div>
                <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${formatUi.pill}`}>
                  {formatUi.label}
                </div>
              </div>
            </div>
          )}

          <div className={`absolute left-3 top-3 rounded px-2 py-1 text-xs font-semibold ${formatUi.pill}`}>{formatUi.label}</div>
          <div className={`absolute right-3 top-3 rounded px-2 py-1 text-xs font-medium ${statusBadge.color}`}>{statusBadge.text}</div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>

        <div className="p-4">
          <h3 className="mb-1 font-semibold text-gray-100">{batch.name}</h3>
          <p className="mb-2 text-sm text-gray-400">Project: {batch.project}</p>

          {batch.tasks.some((t) => t.status === 'rejected') && (
            <div className="mb-2 rounded border border-rose-700/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-300">
              {batch.tasks.filter((t) => t.status === 'rejected').length} task(s) rejected - needs revision
            </div>
          )}
          {batch.tasks.some((t) => t.status === 'approved') && (
            <div className="mb-2 rounded border border-emerald-700/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
              {batch.tasks.filter((t) => t.status === 'approved').length} task(s) approved
            </div>
          )}
          {batch.tasks.some((t) => t.status === 'submitted') && (
            <div className="mb-2 rounded border border-amber-700/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-300">
              {batch.tasks.filter((t) => t.status === 'submitted').length} task(s) pending review
            </div>
          )}

          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-gray-400">Progress</span>
              <span className="text-sm font-medium text-gray-200">{progress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-700">
              <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="mb-4 space-y-1 text-xs text-gray-500">
            <div>Assigned: {batch.assignedDate ? new Date(batch.assignedDate).toLocaleString('vi-VN') : '-'}</div>
            {batch.deadline && <div className="font-semibold text-rose-400">Deadline: {new Date(batch.deadline).toLocaleString('vi-VN')}</div>}
          </div>

          {(() => {
            const rejectedTask = batch.tasks.find((t) => t.status === 'rejected');
            const inProgressTask = batch.tasks.find((t) => t.status === 'in_progress');
            const newTask = batch.tasks.find((t) => !t.status || t.status === 'new' || t.status === 'assigned');
            const submittedTask = batch.tasks.find((t) => t.status === 'submitted');
            const approvedTask = batch.tasks.find((t) => t.status === 'approved');
            const targetTask = rejectedTask || inProgressTask || newTask || submittedTask || approvedTask || firstTask;

            let buttonText = 'View Tasks';
            let buttonColor = 'bg-blue-600 text-white hover:bg-blue-700';

            if (rejectedTask) {
              buttonText = 'Fix Rejected Task';
              buttonColor = 'bg-rose-600 text-white hover:bg-rose-700';
            } else if (inProgressTask) {
              buttonText = 'Continue Labeling';
            } else if (newTask) {
              buttonText = 'Start Labeling';
              buttonColor = 'bg-emerald-600 text-white hover:bg-emerald-700';
            } else if (submittedTask) {
              buttonText = 'Check Review Status';
              buttonColor = 'bg-amber-600 text-white hover:bg-amber-700';
            } else if (batch.tasks.every((t) => t.status === 'approved')) {
              buttonText = 'View Completed';
              buttonColor = 'bg-emerald-500 text-white hover:bg-emerald-600';
            }

            if (batch.status === 'overdue') {
              return (
                <button
                  type="button"
                  disabled
                  className="w-full cursor-not-allowed rounded-lg bg-gray-700 py-2 font-medium text-gray-400"
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
                  if (targetTask) navigate(`/annotator/tasks/${targetTask._id}`);
                }}
                className={`w-full rounded-lg py-2 font-medium transition-colors ${buttonColor}`}
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
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-gray-200">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">My Tasks</h1>
              <p className="mt-1 text-sm text-gray-400">Manage and track your assigned data collection batches.</p>
            </div>

            <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
              <div className="relative w-full md:w-80">
                <input
                  type="text"
                  placeholder="Search batches..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900 py-2 pl-10 pr-3 text-gray-100 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-lg border border-gray-600 bg-gray-900 px-4 py-2 text-gray-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All</option>
                <option value="active">Active Projects</option>
                <option value="pending">Pending Review Projects</option>
                <option value="completed">Completed Projects</option>
                <option value="overdue">Overdue Tasks</option>
              </select>

              <select
                value={filterFormat}
                onChange={(e) => setFilterFormat(e.target.value)}
                className="rounded-lg border border-gray-600 bg-gray-900 px-4 py-2 text-gray-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Types</option>
                <option value="image">Image</option>
                <option value="audio">Audio</option>
                <option value="text">Text</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
          </div>
        </div>

        {(filterStatus === 'all' || filterStatus === 'active') && (
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-100">Active Projects</h2>
                <p className="mt-1 text-sm text-gray-400">Các project đang được giao và cần hoàn thành</p>
              </div>
              <span className="rounded bg-blue-500/10 px-2 py-1 text-sm text-blue-400">{activeBatches.length} Active</span>
            </div>

            {activeBatches.length === 0 ? (
              <div className="rounded-lg border border-gray-700 bg-gray-900 p-10 text-center">
                <p className="text-gray-400">
                  {searchTerm ? 'No active batches found matching your search.' : 'Bạn chưa có project nào đang được giao. Vui lòng liên hệ Manager để được phân công tasks.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{activeBatches.map((batch) => renderBatchCard(batch))}</div>
            )}
          </div>
        )}

        {(filterStatus === 'all' || filterStatus === 'pending') && pendingReviewBatches.length > 0 && (
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-100">Pending Review Projects</h2>
                <p className="mt-1 text-sm text-gray-400">Các project đã nộp và đang chờ reviewer chấm</p>
              </div>
              <span className="rounded bg-amber-500/10 px-2 py-1 text-sm text-amber-400">{pendingReviewBatches.length} Pending</span>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{pendingReviewBatches.map((batch) => renderBatchCard(batch))}</div>
          </div>
        )}

        {(filterStatus === 'all' || filterStatus === 'completed') && completedBatches.length > 0 && (
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-100">Completed Projects</h2>
                <p className="mt-1 text-sm text-gray-400">Các project đã được reviewer chấm xong</p>
              </div>
              <span className="rounded bg-green-500/10 px-2 py-1 text-sm text-green-400">{completedBatches.length} Completed</span>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{completedBatches.map((batch) => renderBatchCard(batch))}</div>
          </div>
        )}

        {overdueBatches.length > 0 && (
          <div className="rounded-xl border border-rose-700/50 bg-gray-800 p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-rose-300">Overdue Tasks</h2>
                <p className="mt-1 text-sm text-rose-300/80">Các project đã quá hạn deadline</p>
              </div>
              <span className="rounded bg-rose-500/10 px-2 py-1 text-sm text-rose-400">{overdueBatches.length} Overdue</span>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{overdueBatches.map((batch) => renderBatchCard(batch))}</div>
          </div>
        )}

        {activeBatches.length === 0 && pendingReviewBatches.length === 0 && completedBatches.length === 0 && !searchTerm && (
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-12 text-center shadow-lg">
            <p className="text-gray-400">Bạn chưa có batches nào được phân công. Vui lòng liên hệ Manager để được phân công tasks.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnnotatorDashboard;
