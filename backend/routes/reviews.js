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
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (task.status !== 'submitted') {
      return res.status(400).json({ message: 'Task is not in submitted status' });
    }

    task.status = 'approved';
    task.reviewedAt = new Date();
    task.reviewerId = req.user._id;
    task.updatedAt = new Date();
    await task.save();

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Reject task
router.post('/:id/reject', auth, authorize('reviewer', 'admin'), [
  body('reviewComments').trim().notEmpty(),
  body('errorCategory').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (task.status !== 'submitted') {
      return res.status(400).json({ message: 'Task is not in submitted status' });
    }

    task.status = 'rejected';
    task.reviewedAt = new Date();
    task.reviewerId = req.user._id;
    task.reviewComments = req.body.reviewComments;
    task.errorCategory = req.body.errorCategory;
    task.updatedAt = new Date();
    await task.save();

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
