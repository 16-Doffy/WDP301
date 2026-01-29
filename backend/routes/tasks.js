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
      query.status = 'submitted';
      query.$or = [
        { reviewers: { $exists: true, $size: 0 } },
        { reviewers: { $exists: false } },
        { reviewers: { $elemMatch: { reviewerId: req.user._id, status: 'pending' } } }
      ];
    } else if (req.user.role === 'manager') {
      // Managers can see all tasks in their projects
      const projects = await Project.find({ managerId: req.user._id }).select('_id');
      query.projectId = { $in: projects.map(p => p._id) };
    }

    const tasks = await Task.find(query)
      .populate('projectId', 'name labelSet guidelines questions')
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

    // Check for existing tasks to avoid duplicates
    const existingTasks = await Task.find({
      projectId,
      datasetId,
      annotatorId: { $in: annotatorIds }
    });

    if (existingTasks.length > 0) {
      return res.status(400).json({ 
        message: `Tasks already exist for this dataset and selected annotators. Found ${existingTasks.length} existing tasks.` 
      });
    }

    const tasks = [];
    for (const file of dataset.files) {
      for (const annotatorId of annotatorIds) {
        const task = new Task({
          projectId,
          datasetId,
          annotatorId, // This should be ObjectId
          dataItem: {
            filename: file.filename,
            originalName: file.originalName || file.filename,
            path: file.path,
            mimeType: file.mimeType || 'application/octet-stream'
          },
          status: 'assigned',
          reviewers: normalizedReviewerIds.map(rid => ({
            reviewerId: rid,
            status: 'pending'
          }))
        });
        tasks.push(task);
        console.log(`Creating task for annotator: ${annotatorId}, file: ${file.filename}`);
      }
    }
    
    console.log(`Total tasks to create: ${tasks.length} for ${annotatorIds.length} annotators`);

    if (tasks.length === 0) {
      return res.status(400).json({ message: 'No tasks to create' });
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
        if (req.body.labels.objects && Array.isArray(req.body.labels.objects)) {
          const validLabels = task.projectId.labelSet.map(l => l.name || l);
          for (const obj of req.body.labels.objects) {
            if (obj.label && !validLabels.includes(obj.label)) {
              return res.status(400).json({ 
                message: `Invalid label "${obj.label}". Valid labels are: ${validLabels.join(', ')}` 
              });
            }
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

    task.status = 'submitted';
    task.submittedAt = new Date();
    task.updatedAt = new Date();
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
