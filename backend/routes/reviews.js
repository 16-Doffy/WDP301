const express = require('express');
const { body, validationResult } = require('express-validator');
const Task = require('../models/Task');
const { auth, authorize } = require('../middleware/auth');
const { createActivityLog } = require('./activityLogs');

const router = express.Router();

// Get tasks pending review
router.get('/pending', auth, authorize('reviewer', 'admin'), async (req, res) => {
  try {
    const reviewerId = req.user._id;
    const tasks = await Task.find({
      status: 'submitted',
      $or: [
        // Reviewer is in the reviewers array with status 'pending'
        { 
          reviewers: { 
            $elemMatch: { 
              reviewerId: reviewerId,
              status: 'pending' 
            } 
          } 
        },
        // Fallback: if reviewers array is empty or doesn't exist, show to all reviewers
        { reviewers: { $exists: true, $size: 0 } },
        { reviewers: { $exists: false } }
      ]
    })
      .populate('projectId', 'name labelSet guidelines questions')
      .populate('datasetId', 'name')
      .populate('annotatorId', 'username fullName')
      .populate('reviewers.reviewerId', 'username fullName')
      .sort({ submittedAt: 1 });

    console.log(`Found ${tasks.length} pending tasks for reviewer ${reviewerId.toString()}`);
    res.json(tasks);
  } catch (error) {
    console.error('Error in /api/reviews/pending:', error);
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
      .populate('projectId', 'name labelSet guidelines questions')
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
    const reviewerId = req.user._id;
    const reviewerIdString = reviewerId.toString();
    
    // Query for pending tasks: status = 'submitted' AND reviewer is assigned with status 'pending'
    const pendingTasks = await Task.find({
      status: 'submitted',
      $or: [
        // Reviewer is in the reviewers array with status 'pending'
        { 
          reviewers: { 
            $elemMatch: { 
              reviewerId: reviewerId,
              status: 'pending' 
            } 
          } 
        },
        // Fallback: if reviewers array is empty or doesn't exist, show to all reviewers
        { reviewers: { $exists: true, $size: 0 } },
        { reviewers: { $exists: false } }
      ]
    })
      .populate('projectId', 'name labelSet guidelines questions')
      .populate('datasetId', 'name')
      .populate('annotatorId', 'username fullName')
      .populate('reviewers.reviewerId', 'username fullName')
      .sort({ submittedAt: 1 });

    // Query for reviewed tasks: status = 'approved' or 'rejected' AND reviewer reviewed it
    const reviewedTasks = await Task.find({ 
      status: { $in: ['approved', 'rejected'] },
      $or: [
        // Reviewer is the primary reviewer
        { reviewerId: reviewerId },
        // Or reviewer is in the reviewers array with status 'approved' or 'rejected'
        { 
          reviewers: { 
            $elemMatch: { 
              reviewerId: reviewerId,
              status: { $in: ['approved', 'rejected'] } 
            } 
          } 
        }
      ]
    })
      .populate('projectId', 'name labelSet guidelines questions')
      .populate('datasetId', 'name')
      .populate('annotatorId', 'username fullName')
      .populate('reviewerId', 'username fullName')
      .populate('reviewers.reviewerId', 'username fullName')
      .sort({ reviewedAt: -1 });

    console.log(`Found ${pendingTasks.length} pending tasks and ${reviewedTasks.length} reviewed tasks for reviewer ${reviewerIdString}`);

    res.json({
      pending: pendingTasks,
      reviewed: reviewedTasks
    });
  } catch (error) {
    console.error('Error in /api/reviews/all:', error);
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

    // Check reviewer assignment if present
    if (task.reviewers && task.reviewers.length > 0) {
      const assigned = task.reviewers.find(r => r.reviewerId?.toString() === req.user._id.toString());
      if (!assigned) {
        return res.status(403).json({ message: 'You are not assigned to review this task' });
      }
      assigned.status = 'approved';
      assigned.reviewedAt = new Date();
      assigned.comment = req.body.reviewComments || assigned.comment;
    }

    // Optional: Add review comments even for approval
    if (req.body.reviewComments) {
      task.reviewComments = req.body.reviewComments;
    }
    if (Array.isArray(req.body.reviewNotes)) {
      task.reviewNotes = req.body.reviewNotes.map(n => ({
        ...n,
        createdBy: req.user._id,
        createdAt: new Date()
      }));
    }

    task.status = 'approved';
    task.reviewedAt = new Date();
    task.reviewerId = req.user._id;
    task.updatedAt = new Date();
    await task.save();

    // Populate before sending response
    await task.populate('annotatorId', 'username fullName');
    await task.populate('reviewerId', 'username fullName');

    // Log task approval
    await createActivityLog(
      req.user._id,
      'task_approve',
      'task',
      task._id,
      `Approved task submitted by ${task.annotatorId?.fullName || task.annotatorId?.username}`,
      { 
        taskId: task._id.toString(),
        annotatorId: task.annotatorId?._id?.toString() || task.annotatorId?.toString()
      },
      req
    );

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

    // Require review notes for rejection (feedback on image)
    if (!Array.isArray(req.body.reviewNotes) || req.body.reviewNotes.length === 0) {
      return res.status(400).json({ message: 'Please add at least one feedback note on the image before rejecting' });
    }

    // Validate error category if provided
    const validErrorCategories = ['incorrect_label', 'missing_label', 'poor_quality', 'does_not_follow_guidelines', 'other'];
    if (req.body.errorCategory && !validErrorCategories.includes(req.body.errorCategory)) {
      return res.status(400).json({ 
        message: `Invalid error category. Valid categories are: ${validErrorCategories.join(', ')}` 
      });
    }

    if (task.reviewers && task.reviewers.length > 0) {
      const assigned = task.reviewers.find(r => r.reviewerId?.toString() === req.user._id.toString());
      if (!assigned) {
        return res.status(403).json({ message: 'You are not assigned to review this task' });
      }
      assigned.status = 'rejected';
      assigned.reviewedAt = new Date();
      assigned.comment = req.body.reviewComments.trim();
    }

    task.reviewNotes = req.body.reviewNotes.map(n => ({
      ...n,
      createdBy: req.user._id,
      createdAt: new Date()
    }));

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

    // Log task rejection
    await createActivityLog(
      req.user._id,
      'task_reject',
      'task',
      task._id,
      `Rejected task submitted by ${task.annotatorId?.fullName || task.annotatorId?.username}. Reason: ${task.errorCategory}`,
      { 
        taskId: task._id.toString(),
        annotatorId: task.annotatorId?._id?.toString() || task.annotatorId?.toString(),
        errorCategory: task.errorCategory
      },
      req
    );

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
