const express = require('express');
const { body, validationResult } = require('express-validator');
const Task = require('../models/Task');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Get tasks pending review
router.get('/pending', auth, authorize('reviewer', 'admin'), async (req, res) => {
  try {
    const tasks = await Task.find({ status: 'submitted' })
      .populate('projectId', 'name labelSet guidelines')
      .populate('datasetId', 'name')
      .populate('annotatorId', 'username fullName')
      .sort({ submittedAt: 1 });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all reviewed tasks (approved/rejected)
router.get('/reviewed', auth, authorize('reviewer', 'admin'), async (req, res) => {
  try {
    const tasks = await Task.find({ 
      status: { $in: ['approved', 'rejected'] },
      reviewerId: req.user._id 
    })
      .populate('projectId', 'name labelSet guidelines')
      .populate('datasetId', 'name')
      .populate('annotatorId', 'username fullName')
      .populate('reviewerId', 'username fullName')
      .sort({ reviewedAt: -1 });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all tasks for reviewer (pending + reviewed)
router.get('/all', auth, authorize('reviewer', 'admin'), async (req, res) => {
  try {
    const pendingTasks = await Task.find({ status: 'submitted' })
      .populate('projectId', 'name labelSet guidelines')
      .populate('datasetId', 'name')
      .populate('annotatorId', 'username fullName')
      .sort({ submittedAt: 1 });

    const reviewedTasks = await Task.find({ 
      status: { $in: ['approved', 'rejected'] },
      reviewerId: req.user._id 
    })
      .populate('projectId', 'name labelSet guidelines')
      .populate('datasetId', 'name')
      .populate('annotatorId', 'username fullName')
      .populate('reviewerId', 'username fullName')
      .sort({ reviewedAt: -1 });

    res.json({
      pending: pendingTasks,
      reviewed: reviewedTasks
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Approve task
router.post('/:id/approve', auth, authorize('reviewer', 'admin'), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('projectId', 'name guidelines');
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Validate task status
    if (task.status !== 'submitted') {
      return res.status(400).json({ 
        message: `Task cannot be approved. Current status: ${task.status}. Only submitted tasks can be approved.` 
      });
    }

    // Validate that task has labels
    if (!task.labels || Object.keys(task.labels).length === 0) {
      return res.status(400).json({ message: 'Cannot approve task without labels' });
    }

    // Optional: Add review comments even for approval
    if (req.body.reviewComments) {
      task.reviewComments = req.body.reviewComments;
    }

    task.status = 'approved';
    task.reviewedAt = new Date();
    task.reviewerId = req.user._id;
    task.updatedAt = new Date();
    await task.save();

    // Populate before sending response
    await task.populate('annotatorId', 'username fullName');
    await task.populate('reviewerId', 'username fullName');

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Reject task
router.post('/:id/reject', auth, authorize('reviewer', 'admin'), [
  body('reviewComments').trim().notEmpty().withMessage('Review comments are required when rejecting a task'),
  body('errorCategory').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const task = await Task.findById(req.params.id)
      .populate('projectId', 'name guidelines');
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Validate task status
    if (task.status !== 'submitted') {
      return res.status(400).json({ 
        message: `Task cannot be rejected. Current status: ${task.status}. Only submitted tasks can be rejected.` 
      });
    }

    // Validate review comments
    if (!req.body.reviewComments || req.body.reviewComments.trim() === '') {
      return res.status(400).json({ message: 'Review comments are required when rejecting a task' });
    }

    // Validate error category if provided
    const validErrorCategories = ['incorrect_label', 'missing_label', 'poor_quality', 'does_not_follow_guidelines', 'other'];
    if (req.body.errorCategory && !validErrorCategories.includes(req.body.errorCategory)) {
      return res.status(400).json({ 
        message: `Invalid error category. Valid categories are: ${validErrorCategories.join(', ')}` 
      });
    }

    task.status = 'rejected';
    task.reviewedAt = new Date();
    task.reviewerId = req.user._id;
    task.reviewComments = req.body.reviewComments.trim();
    task.errorCategory = req.body.errorCategory || 'other';
    task.updatedAt = new Date();
    await task.save();

    // Populate before sending response
    await task.populate('annotatorId', 'username fullName');
    await task.populate('reviewerId', 'username fullName');

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get review statistics
router.get('/stats', auth, authorize('reviewer', 'manager', 'admin'), async (req, res) => {
  try {
    const stats = await Task.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const errorStats = await Task.aggregate([
      {
        $match: { errorCategory: { $exists: true, $ne: null } }
      },
      {
        $group: {
          _id: '$errorCategory',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({ statusStats: stats, errorStats });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
