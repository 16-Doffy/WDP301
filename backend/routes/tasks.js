const express = require('express');
const Task = require('../models/Task');
const Dataset = require('../models/Dataset');
const Project = require('../models/Project');
const { auth, authorize } = require('../middleware/auth');
const { createActivityLog } = require('./activityLogs');

const router = express.Router();

// Helper function to normalize ID for comparison
const normalizeId = (id) => {
  if (!id) return null;
  if (typeof id === 'string') return id;
  if (id._id) return id._id.toString(); // Populated object
  if (id.toString) return id.toString(); // ObjectId
  return String(id);
};

const stableLabelKey = (value) => {
  if (value == null) return '__NULL__';
  if (typeof value === 'string') return `str:${value}`;
  if (typeof value === 'number' || typeof value === 'boolean') return `prim:${String(value)}`;
  if (typeof value === 'object') {
    if (typeof value.label === 'string') return `label:${value.label}`;
    if (Array.isArray(value.objects)) {
      const labels = value.objects
        .map((o) => o?.label)
        .filter(Boolean)
        .sort();
      if (labels.length > 0) return `objects:${labels.join('|')}`;
    }
    try {
      return `json:${JSON.stringify(value)}`;
    } catch {
      return '__UNSERIALIZABLE__';
    }
  }
  return `other:${String(value)}`;
};

const computeConsensus = (task) => {
  const candidates = Array.isArray(task?.annotatorLabels) ? task.annotatorLabels : [];
  const pool = candidates.length > 0
    ? candidates.map((entry) => entry?.labels).filter((labels) => labels != null)
    : (task?.labels ? [task.labels] : []);

  if (pool.length === 0) {
    return {
      consensusLabel: null,
      consensusScore: null,
      consensusMeta: {
        method: 'none',
        winningVotes: 0,
        totalVotes: 0,
        isTie: false,
        needsReview: true,
      },
    };
  }

  const tally = new Map();
  const samples = new Map();
  pool.forEach((labels) => {
    const key = stableLabelKey(labels);
    tally.set(key, (tally.get(key) || 0) + 1);
    if (!samples.has(key)) samples.set(key, labels);
  });

  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const [winnerKey, winnerVotes] = sorted[0];
  const secondVotes = sorted[1]?.[1] || 0;
  const totalVotes = pool.length;
  const isTie = winnerVotes === secondVotes && sorted.length > 1;

  return {
    consensusLabel: isTie ? null : samples.get(winnerKey),
    consensusScore: Number((winnerVotes / totalVotes).toFixed(4)),
    consensusMeta: {
      method: 'majority_vote',
      winningVotes: winnerVotes,
      totalVotes,
      isTie,
      needsReview: isTie,
    },
  };
};

// Helper function to normalize path to relative path from backend root
const normalizePath = (filePath) => {
  if (!filePath) return '';
  // Convert backslashes to forward slashes
  let normalized = filePath.replace(/\\/g, '/');
  
  // Extract relative path from 'uploads' onwards
  const uploadsIndex = normalized.indexOf('uploads/');
  if (uploadsIndex !== -1) {
    return normalized.substring(uploadsIndex);
  }
  
  // If already relative and starts with 'uploads/', return as is
  if (normalized.startsWith('uploads/')) {
    return normalized;
  }
  
  // Fallback: if path contains 'uploads' anywhere, try to extract
  const lastUploadsIndex = normalized.lastIndexOf('uploads/');
  if (lastUploadsIndex !== -1) {
    return normalized.substring(lastUploadsIndex);
  }
  
  // If no 'uploads' found, assume it's already relative or return empty
  return normalized;
};

// Get tasks for current user
router.get('/my-tasks', auth, async (req, res) => {
  try {
    let query = {};

    // Optional filtering by datasetId (used by Annotator batch navigation)
    if (req.query.datasetId) {
      query.datasetId = req.query.datasetId;
    }
    
    if (req.user.role === 'annotator') {
      query.annotatorId = req.user._id;
    } else if (req.user.role === 'reviewer') {
      const reviewerIdString = req.user._id.toString();
      query.status = 'submitted';
      query.$or = [
        { reviewers: { $exists: true, $size: 0 } },
        { reviewers: { $exists: false } },
        {
          reviewers: {
            $elemMatch: {
              reviewerId: { $in: [req.user._id, reviewerIdString] },
              status: 'pending',
            },
          },
        },
      ];
    } else if (req.user.role === 'manager') {
      // Managers can see all tasks in their projects
      const projects = await Project.find({ managerId: req.user._id }).select('_id');
      query.projectId = { $in: projects.map(p => p._id) };
    }

    const tasks = await Task.find(query)
      .populate('projectId', 'name labelSet guidelines questions deadline')
      .populate('datasetId', 'name')
      .populate('annotatorId', 'username fullName')
      .populate('reviewerId', 'username fullName')
      .populate('reviewers.reviewerId', 'username fullName')
      .sort({ createdAt: -1 });

    if (req.user.role === 'annotator') {
      console.log(`Found ${tasks.length} tasks for annotator ${req.user._id.toString()}`);
      tasks.forEach((task, idx) => {
        const taskAnnotatorId = normalizeId(task.annotatorId);
        const currentUserId = normalizeId(req.user._id);
        console.log(`Task ${idx + 1}:`, {
          taskId: task._id.toString(),
          annotatorId: taskAnnotatorId,
          userId: currentUserId,
          match: taskAnnotatorId === currentUserId,
          status: task.status
        });
      });
    }

    res.json(tasks);
  } catch (error) {
    console.error('Error in /my-tasks:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get task by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('projectId', 'name labelSet guidelines questions managerId')
      .populate('datasetId', 'name')
      .populate('annotatorId', 'username fullName')
      .populate('reviewerId', 'username fullName')
      .populate('reviewers.reviewerId', 'username fullName');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Authorization check
    if (req.user.role === 'annotator') {
      const annotatorId = normalizeId(task.annotatorId);
      const userId = normalizeId(req.user._id);
      
      console.log('Authorization check for annotator in GET /:id:', {
        taskId: task._id.toString(),
        annotatorId,
        userId,
        match: annotatorId === userId,
        annotatorIdRaw: task.annotatorId,
        userIdRaw: req.user._id
      });
      
      if (annotatorId !== userId) {
        return res.status(403).json({ 
          message: 'Not authorized to view this task. This task belongs to a different annotator.',
          debug: { annotatorId, userId, taskId: task._id.toString() }
        });
      }
    } else if (req.user.role === 'manager') {
      // Handle both populated and non-populated projectId
      const projectId = task.projectId?._id?.toString() || task.projectId?.toString();
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      const managerId = project.managerId?._id?.toString() || project.managerId?.toString();
      if (managerId !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to view this task' });
      }
    } else if (req.user.role === 'reviewer') {
      // Reviewer can view submitted tasks or tasks they reviewed/are assigned to
      const primaryReviewerId = task.reviewerId?._id?.toString() || task.reviewerId?.toString();
      const inReviewerList = Array.isArray(task.reviewers)
        && task.reviewers.some(r => (r.reviewerId?._id?.toString() || r.reviewerId?.toString?.() || r.reviewerId?.toString()) === req.user._id.toString());
      if (task.status !== 'submitted' && !inReviewerList && primaryReviewerId !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to view this task' });
      }
    }

    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get task consensus + reviewer vote summary
router.get('/:id/consensus-summary', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('projectId', 'name managerId')
      .populate('annotatorId', 'username fullName')
      .populate('reviewers.reviewerId', 'username fullName')
      .populate('reviewerId', 'username fullName')
      .select('status labels annotatorLabels consensusLabel consensusScore consensusMeta reviewers reviewerId updatedAt reviewedAt submittedAt');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (req.user.role === 'annotator') {
      const annotatorId = normalizeId(task.annotatorId);
      if (annotatorId !== normalizeId(req.user._id)) {
        return res.status(403).json({ message: 'Not authorized to view this task summary' });
      }
    } else if (req.user.role === 'manager') {
      const projectId = task.projectId?._id?.toString() || task.projectId?.toString();
      const project = await Project.findById(projectId).select('managerId');
      const managerId = normalizeId(project?.managerId);
      if (managerId !== normalizeId(req.user._id)) {
        return res.status(403).json({ message: 'Not authorized to view this task summary' });
      }
    } else if (req.user.role === 'reviewer') {
      const isAssigned = Array.isArray(task.reviewers)
        && task.reviewers.some((r) => normalizeId(r.reviewerId) === normalizeId(req.user._id));
      const isPrimaryReviewer = normalizeId(task.reviewerId) === normalizeId(req.user._id);
      if (!isAssigned && !isPrimaryReviewer && task.status !== 'submitted') {
        return res.status(403).json({ message: 'Not authorized to view this task summary' });
      }
    }

    const reviewers = Array.isArray(task.reviewers) ? task.reviewers : [];
    const approveVotes = reviewers.filter((r) => r.status === 'approved').length;
    const rejectVotes = reviewers.filter((r) => r.status === 'rejected').length;
    const pendingVotes = reviewers.filter((r) => r.status === 'pending').length;
    const decidedVotes = approveVotes + rejectVotes;
    const totalVotes = reviewers.length;

    const consensus = task.consensusLabel != null || task.consensusMeta
      ? {
          label: task.consensusLabel ?? null,
          score: task.consensusScore ?? null,
          method: task.consensusMeta?.method || 'none',
          winningVotes: task.consensusMeta?.winningVotes || 0,
          totalVotes: task.consensusMeta?.totalVotes || 0,
          isTie: Boolean(task.consensusMeta?.isTie),
          needsReview: Boolean(task.consensusMeta?.needsReview),
          decidedAt: task.consensusMeta?.decidedAt || null,
        }
      : computeConsensus(task);

    res.json({
      taskId: task._id,
      status: task.status,
      consensus,
      reviewerVotes: {
        approveVotes,
        rejectVotes,
        pendingVotes,
        decidedVotes,
        totalVotes,
        progressLabel: `${decidedVotes}/${totalVotes}`,
      },
      finalDecision: {
        status: task.status,
        reviewedAt: task.reviewedAt || null,
        decidedBy: task.reviewerId || null,
      },
      timestamps: {
        submittedAt: task.submittedAt || null,
        updatedAt: task.updatedAt || null,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Assign tasks to annotators (Manager only)
router.post('/assign', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { projectId, datasetId, annotatorIds, reviewerIds } = req.body;

    // Validation
    if (!projectId || !datasetId || !annotatorIds) {
      return res.status(400).json({ message: 'Missing required fields: projectId, datasetId, annotatorIds' });
    }
    if (!Array.isArray(reviewerIds) || reviewerIds.length === 0) {
      return res.status(400).json({ message: 'Missing required reviewers: reviewerIds must be a non-empty array' });
    }

    if (!Array.isArray(annotatorIds) || annotatorIds.length === 0) {
      return res.status(400).json({ message: 'annotatorIds must be a non-empty array' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.managerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to assign tasks for this project' });
    }

    const dataset = await Dataset.findById(datasetId);
    if (!dataset) {
      return res.status(404).json({ message: 'Dataset not found' });
    }

    if (!dataset.files || dataset.files.length === 0) {
      return res.status(400).json({ message: 'Dataset has no files' });
    }

    // Normalize reviewer ids (mandatory) - MUST be done first
    const normalizedReviewerIds = Array.isArray(reviewerIds) ? reviewerIds.filter(Boolean) : [];
    if (normalizedReviewerIds.length === 0) {
      return res.status(400).json({ message: 'At least one reviewer is required' });
    }
    if (normalizedReviewerIds.length % 2 === 0) {
      return res.status(400).json({ message: 'Number of reviewers must be odd (1, 3, 5, ...)' });
    }

    // Check if annotators exist and are active
    const User = require('../models/User');
    const annotators = await User.find({ 
      _id: { $in: annotatorIds }, 
      role: 'annotator',
      isActive: true 
    });
    
    if (annotators.length !== annotatorIds.length) {
      return res.status(400).json({ message: 'Some annotators are invalid or inactive' });
    }

    // Check reviewers exist and active
    const reviewers = await User.find({
      _id: { $in: normalizedReviewerIds },
      role: 'reviewer',
      isActive: true
    });
    if (reviewers.length !== normalizedReviewerIds.length) {
      return res.status(400).json({ message: 'Some reviewers are invalid or inactive' });
    }

    // Incremental assignment: create only missing (file, annotator) tasks
    const existingTasks = await Task.find({
      projectId,
      datasetId,
      annotatorId: { $in: annotatorIds }
    }).select('annotatorId dataItem.filename dataItem.path');

    const existingKeys = new Set(
      existingTasks.map((t) => `${normalizeId(t.annotatorId)}::${t?.dataItem?.filename || ''}::${normalizePath(t?.dataItem?.path || '')}`)
    );

    const tasks = [];
    for (const file of dataset.files) {
      for (const annotatorId of annotatorIds) {
        const key = `${normalizeId(annotatorId)}::${file.filename}::${normalizePath(file.path)}`;
        if (existingKeys.has(key)) continue;

        const task = new Task({
          projectId,
          datasetId,
          annotatorId,
          dataItem: {
            filename: file.filename,
            originalName: file.originalName || file.filename,
            path: normalizePath(file.path),
            mimeType: file.mimeType || 'application/octet-stream'
          },
          status: 'assigned',
          reviewers: normalizedReviewerIds.map(rid => ({
            reviewerId: rid,
            status: 'pending'
          }))
        });
        tasks.push(task);
      }
    }

    if (tasks.length === 0) {
      return res.status(200).json({
        message: 'Không có task mới để thêm. Các annotator đã được gán đầy đủ cho dataset này.',
        tasksCreated: 0,
        skippedExisting: existingTasks.length,
      });
    }

    await Task.insertMany(tasks);
    
    // Log task assignment
    await createActivityLog(
      req.user._id,
      'task_assign',
      'task',
      null,
      `Assigned ${tasks.length} tasks to ${annotatorIds.length} annotator(s)`,
      { 
        tasksCount: tasks.length, 
        annotatorsCount: annotatorIds.length,
        projectId: project._id.toString(),
        datasetId: dataset._id.toString()
      },
      req
    );

    res.status(201).json({ 
      message: `Assigned ${tasks.length} tasks successfully`,
      tasksCreated: tasks.length,
      filesCount: dataset.files.length,
      annotatorsCount: annotatorIds.length,
      reviewersCount: normalizedReviewerIds.length
    });
  } catch (error) {
    console.error('Error assigning tasks:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', {
      projectId,
      datasetId,
      annotatorIds,
      reviewerIds
    });
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update task (Annotator - for labeling)
router.put('/:id/label', auth, authorize('annotator'), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('projectId', 'labelSet deadline');
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const annotatorId = normalizeId(task.annotatorId);
    const userId = normalizeId(req.user._id);
    
    if (annotatorId !== userId) {
      console.log('Authorization failed in PUT /:id/label:', {
        annotatorId,
        userId,
        match: annotatorId === userId,
        taskId: task._id.toString()
      });
      return res.status(403).json({ 
        message: 'Not authorized to edit this task',
        debug: { annotatorId, userId }
      });
    }

    // Validate task status for editing
    if (task.status === 'submitted') {
      return res.status(400).json({ message: 'Cannot edit task that has been submitted. Please wait for review.' });
    }
    
    if (task.status === 'approved') {
      return res.status(400).json({ message: 'Cannot edit approved task' });
    }

    // Allow editing if task is rejected (for revision)
    if (task.status === 'rejected') {
      // Check deadline if project has one
      if (task.projectId?.deadline) {
        const deadline = new Date(task.projectId.deadline);
        const now = new Date();
        if (now > deadline) {
          return res.status(400).json({ 
            message: `Không thể chỉnh sửa task. Deadline của project đã hết hạn (${deadline.toLocaleString('vi-VN')}). Vui lòng liên hệ Manager.` 
          });
        }
      }
      task.status = 'in_progress';
      // Clear review info when annotator starts editing rejected task
      task.reviewComments = undefined;
      task.errorCategory = undefined;
      task.reviewerId = undefined;
      task.reviewedAt = undefined;
    }

    // Validate labels if provided
    if (req.body.labels) {
      // If project has labelSet, validate that labels use valid label names
      if (task.projectId?.labelSet && Array.isArray(task.projectId.labelSet) && task.projectId.labelSet.length > 0) {
        const validLabels = task.projectId.labelSet.map(l => l.name || l);

        // Image object labels
        if (req.body.labels.objects && Array.isArray(req.body.labels.objects)) {
          for (const obj of req.body.labels.objects) {
            if (obj.label && !validLabels.includes(obj.label)) {
              return res.status(400).json({
                message: `Invalid label "${obj.label}". Valid labels are: ${validLabels.join(', ')}`
              });
            }
          }
        }

        // Text span labels
        if (req.body.labels.spans && Array.isArray(req.body.labels.spans)) {
          for (const span of req.body.labels.spans) {
            if (span.label && !validLabels.includes(span.label)) {
              return res.status(400).json({
                message: `Invalid label "${span.label}". Valid labels are: ${validLabels.join(', ')}`
              });
            }
          }
        }

        // Audio/simple classification label
        if (req.body.labels.label && typeof req.body.labels.label === 'string') {
          if (!validLabels.includes(req.body.labels.label)) {
            return res.status(400).json({
              message: `Invalid label "${req.body.labels.label}". Valid labels are: ${validLabels.join(', ')}`
            });
          }
        }
      }
      
      task.labels = req.body.labels;
    }

    // Update status
    if (req.body.status === 'in_progress' || !req.body.status) {
      task.status = 'in_progress';
    } else if (req.body.status === 'assigned') {
      task.status = 'assigned';
    }
    
    task.updatedAt = new Date();
    await task.save();

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Mark a single task as completed (Annotator)
router.post('/:id/complete', auth, authorize('annotator'), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('projectId', 'deadline');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const annotatorId = normalizeId(task.annotatorId);
    const userId = normalizeId(req.user._id);

    if (annotatorId !== userId) {
      return res.status(403).json({ message: 'Not authorized to complete this task' });
    }

    if (task.status === 'submitted' || task.status === 'approved') {
      return res.status(400).json({ message: 'Cannot complete a submitted/approved task' });
    }

    // If rejected, allow completing again but enforce deadline
    if (task.projectId?.deadline) {
      const deadline = new Date(task.projectId.deadline);
      const now = new Date();
      if (now > deadline) {
        return res.status(400).json({
          message: `Không thể hoàn thành task. Deadline của project đã hết hạn (${deadline.toLocaleString('vi-VN')}). Vui lòng liên hệ Manager.`
        });
      }
    }

    if (!task.labels || Object.keys(task.labels).length === 0) {
      return res.status(400).json({ message: 'Cannot complete task without labels. Please add labels first.' });
    }

    task.status = 'completed';
    task.updatedAt = new Date();
    await task.save();

    res.json(task);
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Submit batch (all tasks in a dataset) for review (Annotator)
router.post('/submit-batch', auth, authorize('annotator'), async (req, res) => {
  try {
    const { datasetId } = req.body;
    if (!datasetId) {
      return res.status(400).json({ message: 'datasetId is required' });
    }

    const tasks = await Task.find({ datasetId, annotatorId: req.user._id })
      .populate('projectId', 'questions deadline');

    if (!tasks || tasks.length === 0) {
      return res.status(404).json({ message: 'No tasks found for this batch' });
    }

    // Enforce deadline (use project's deadline; all tasks share same project)
    const projectDeadline = tasks[0]?.projectId?.deadline;
    if (projectDeadline) {
      const deadline = new Date(projectDeadline);
      const now = new Date();
      if (now > deadline) {
        return res.status(400).json({
          message: `Không thể nộp batch. Deadline của project đã hết hạn (${deadline.toLocaleString('vi-VN')}). Vui lòng liên hệ Manager.`
        });
      }
    }

    // Keep already approved tasks as-is; submit only tasks that need (re)review.
    const tasksToSubmit = tasks.filter((t) => t.status !== 'approved');

    // Validate tasks that are going to be submitted
    const invalidStatuses = ['assigned', 'submitted'];
    const notReady = tasksToSubmit.filter((t) => invalidStatuses.includes(t.status));
    if (notReady.length > 0) {
      return res.status(400).json({
        message: 'Please finish all editable tasks in this batch before submitting.',
        remaining: notReady.map(t => t._id.toString()),
      });
    }

    const missingLabels = tasksToSubmit.filter(t => !t.labels || Object.keys(t.labels).length === 0);
    if (missingLabels.length > 0) {
      return res.status(400).json({
        message: 'Some tasks are missing labels. Please label all required items before submitting.',
        missing: missingLabels.map(t => t._id.toString()),
      });
    }

    if (tasksToSubmit.length === 0) {
      return res.json({ message: 'No tasks need resubmission in this batch.', count: 0 });
    }

    // Set only pending/rework tasks to submitted
    const now = new Date();
    for (const task of tasksToSubmit) {
      const consensus = computeConsensus(task);
      // Ensure reviewer assignment exists
      if (!task.reviewers || task.reviewers.length === 0) {
        return res.status(400).json({ message: 'Task must have at least one reviewer assigned before submission' });
      }

      // Reset reviewer states to pending
      task.reviewers = task.reviewers.map(r => ({
        reviewerId: r.reviewerId?._id || r.reviewerId,
        status: 'pending',
        comment: undefined,
        reviewedAt: undefined,
      }));

      task.reviewNotes = [];
      task.consensusLabel = consensus.consensusLabel;
      task.consensusScore = consensus.consensusScore;
      task.consensusMeta = {
        ...consensus.consensusMeta,
        decidedAt: now,
      };
      task.status = 'submitted';
      task.submittedAt = now;
      task.updatedAt = now;
      await task.save();
    }

    res.json({ message: `Submitted batch successfully`, count: tasksToSubmit.length });
  } catch (error) {
    console.error('Error submitting batch:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Submit task for review (Annotator)
router.post('/:id/submit', auth, authorize('annotator'), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('projectId', 'questions deadline');
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const annotatorId = normalizeId(task.annotatorId);
    const userId = normalizeId(req.user._id);
    
    if (annotatorId !== userId) {
      console.log('Authorization failed in POST /:id/submit:', {
        annotatorId,
        userId,
        match: annotatorId === userId,
        taskId: task._id.toString()
      });
      return res.status(403).json({ 
        message: 'Not authorized to submit this task',
        debug: { annotatorId, userId }
      });
    }

    // Validate task status
    if (task.status === 'submitted') {
      return res.status(400).json({ message: 'Task has already been submitted' });
    }
    
    if (task.status === 'approved') {
      return res.status(400).json({ message: 'Task has already been approved' });
    }

    // Allow resubmission if task was rejected
    if (task.status === 'rejected') {
      // Check deadline if project has one
      if (task.projectId?.deadline) {
        const deadline = new Date(task.projectId.deadline);
        const now = new Date();
        if (now > deadline) {
          return res.status(400).json({ 
            message: `Không thể nộp lại task. Deadline của project đã hết hạn (${deadline.toLocaleString('vi-VN')}). Vui lòng liên hệ Manager.` 
          });
        }
      }
      // Clear previous review information when resubmitting
      task.reviewComments = undefined;
      task.errorCategory = undefined;
      task.reviewerId = undefined;
      task.reviewedAt = undefined;
    } else if (task.status !== 'in_progress' && task.status !== 'assigned') {
      return res.status(400).json({ message: 'Task can only be submitted from "in_progress" or "assigned" status' });
    }

    // Check deadline for all submissions
    if (task.projectId?.deadline) {
      const deadline = new Date(task.projectId.deadline);
      const now = new Date();
      if (now > deadline) {
        return res.status(400).json({ 
          message: `Không thể nộp task. Deadline của project đã hết hạn (${deadline.toLocaleString('vi-VN')}). Vui lòng liên hệ Manager.` 
        });
      }
    }

    // Ensure reviewer assignment exists
    if (!task.reviewers || task.reviewers.length === 0) {
      return res.status(400).json({ message: 'Task must have at least one reviewer assigned before submission' });
    }

    // Reset reviewer states to pending on (re)submit
    if (task.reviewers && task.reviewers.length > 0) {
      task.reviewers = task.reviewers.map(r => {
        const reviewerId = r.reviewerId?._id || r.reviewerId || r.reviewerId?.toString();
        return {
          reviewerId: reviewerId, // Ensure reviewerId is preserved
        status: 'pending',
        comment: undefined,
        reviewedAt: undefined
        };
      });
      console.log(`Reset reviewers for task ${task._id}:`, task.reviewers.map(r => ({
        reviewerId: r.reviewerId?.toString?.() || r.reviewerId,
        status: r.status
      })));
    }
    // Clear review notes on resubmit
    task.reviewNotes = [];

    // Validate that labels exist
    if (!task.labels || Object.keys(task.labels).length === 0) {
      return res.status(400).json({ message: 'Cannot submit task without labels. Please add labels first.' });
    }

    // Validate answers if project has questions
    if (task.projectId?.questions && Array.isArray(task.projectId.questions) && task.projectId.questions.length > 0) {
      if (task.labels.objects && Array.isArray(task.labels.objects)) {
        for (const obj of task.labels.objects) {
          // Check if answer is required and provided
          // Note: This is a basic check - you might want more sophisticated validation
          if (task.projectId.questions.some(q => q.required !== false) && (!obj.answer || Object.keys(obj.answer).length === 0)) {
            return res.status(400).json({ 
              message: 'All annotations must have answers to required questions. Please complete all questions.' 
            });
          }
        }
      }
    }

    const now = new Date();
    const consensus = computeConsensus(task);

    task.consensusLabel = consensus.consensusLabel;
    task.consensusScore = consensus.consensusScore;
    task.consensusMeta = {
      ...consensus.consensusMeta,
      decidedAt: now,
    };
    task.status = 'submitted';
    task.submittedAt = now;
    task.updatedAt = now;
    await task.save();
    
    // Log task submission with reviewers info for debugging
    console.log(`Task ${task._id} submitted with ${task.reviewers?.length || 0} reviewers:`, 
      task.reviewers?.map(r => ({
        reviewerId: r.reviewerId?.toString?.() || r.reviewerId?.toString() || r.reviewerId,
        status: r.status
      }))
    );

    // Log task submission
    await createActivityLog(
      req.user._id,
      'task_submit',
      'task',
      task._id,
      `Submitted task for review`,
      { taskId: task._id.toString() },
      req
    );

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;