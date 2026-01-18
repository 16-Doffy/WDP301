const express = require('express');
const Task = require('../models/Task');
const Dataset = require('../models/Dataset');
const Project = require('../models/Project');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Get tasks for current user
router.get('/my-tasks', auth, async (req, res) => {
  try {
    let query = {};
    
    if (req.user.role === 'annotator') {
      query.annotatorId = req.user._id;
    } else if (req.user.role === 'reviewer') {
      query.status = 'submitted';
    } else if (req.user.role === 'manager') {
      // Managers can see all tasks in their projects
      const projects = await Project.find({ managerId: req.user._id }).select('_id');
      query.projectId = { $in: projects.map(p => p._id) };
    }

    const tasks = await Task.find(query)
      .populate('projectId', 'name labelSet guidelines')
      .populate('datasetId', 'name')
      .populate('annotatorId', 'username fullName')
      .populate('reviewerId', 'username fullName')
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get task by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('projectId', 'name labelSet guidelines managerId')
      .populate('datasetId', 'name')
      .populate('annotatorId', 'username fullName')
      .populate('reviewerId', 'username fullName');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Authorization check
    if (req.user.role === 'annotator') {
      if (task.annotatorId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to view this task' });
      }
    } else if (req.user.role === 'manager') {
      const project = await Project.findById(task.projectId._id || task.projectId);
      if (project.managerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to view this task' });
      }
    } else if (req.user.role === 'reviewer') {
      // Reviewer can view submitted tasks or tasks they reviewed
      if (task.status !== 'submitted' && 
          (task.reviewerId && task.reviewerId.toString() !== req.user._id.toString())) {
        return res.status(403).json({ message: 'Not authorized to view this task' });
      }
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Assign tasks to annotators (Manager only)
router.post('/assign', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { projectId, datasetId, annotatorIds } = req.body;

    // Validation
    if (!projectId || !datasetId || !annotatorIds) {
      return res.status(400).json({ message: 'Missing required fields: projectId, datasetId, annotatorIds' });
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
          annotatorId,
          dataItem: {
            filename: file.filename,
            originalName: file.originalName || file.filename,
            path: file.path,
            mimeType: file.mimeType || 'application/octet-stream'
          },
          status: 'assigned'
        });
        tasks.push(task);
      }
    }

    if (tasks.length === 0) {
      return res.status(400).json({ message: 'No tasks to create' });
    }

    await Task.insertMany(tasks);
    res.status(201).json({ 
      message: `Assigned ${tasks.length} tasks successfully`,
      tasksCreated: tasks.length,
      filesCount: dataset.files.length,
      annotatorsCount: annotatorIds.length
    });
  } catch (error) {
    console.error('Error assigning tasks:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update task (Annotator - for labeling)
router.put('/:id/label', auth, authorize('annotator'), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (task.annotatorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Allow editing if task is rejected (for revision)
    if (task.status === 'rejected') {
      task.status = 'in_progress';
      // Clear review info when annotator starts editing rejected task
      task.reviewComments = undefined;
      task.errorCategory = undefined;
      task.reviewerId = undefined;
      task.reviewedAt = undefined;
    } else if (task.status === 'submitted' || task.status === 'approved') {
      return res.status(400).json({ message: 'Cannot edit task in current status' });
    }

    task.labels = req.body.labels;
    if (!req.body.status || req.body.status === 'in_progress') {
      task.status = 'in_progress';
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
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (task.annotatorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Allow resubmission if task was rejected
    if (task.status === 'rejected') {
      // Clear previous review information when resubmitting
      task.reviewComments = undefined;
      task.errorCategory = undefined;
      task.reviewerId = undefined;
      task.reviewedAt = undefined;
    } else if (task.status !== 'in_progress' && task.status !== 'assigned') {
      return res.status(400).json({ message: 'Task cannot be submitted in current status' });
    }

    task.status = 'submitted';
    task.submittedAt = new Date();
    task.updatedAt = new Date();
    await task.save();

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
