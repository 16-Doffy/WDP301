const express = require('express');
const { body, validationResult } = require('express-validator');
const Task = require('../models/Task');
const { auth, authorize } = require('../middleware/auth');
const { createActivityLog } = require('./activityLogs');
const Penalty = require('../models/Penalty');
const Warning = require('../models/Warning');
const UserScore = require('../models/UserScore');

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

    // Update annotator score positively (approval = good work)
    await updateAnnotatorScoreOnApproval(task.annotatorId._id || task.annotatorId);

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

    // Review notes are optional for rejection (can reject with just comments)
    // if (!Array.isArray(req.body.reviewNotes) || req.body.reviewNotes.length === 0) {
    //   return res.status(400).json({ message: 'Please add at least one feedback note on the image before rejecting' });
    // }

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

    // Handle review notes (optional for rejection)
    if (Array.isArray(req.body.reviewNotes) && req.body.reviewNotes.length > 0) {
      task.reviewNotes = req.body.reviewNotes.map(n => ({
        ...n,
        createdBy: req.user._id,
        createdAt: new Date()
      }));
    } else {
      task.reviewNotes = [];
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

    // Check for repeat errors and apply penalties
    await checkAndApplyPenaltyOnRejection(
      task.annotatorId._id || task.annotatorId,
      task._id,
      task.projectId._id || task.projectId,
      req.body.errorCategory,
      req.body.reviewComments,
      req.user._id
    );

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

// Helper function to update annotator score on approval
async function updateAnnotatorScoreOnApproval(annotatorId) {
  let userScore = await UserScore.findOne({ userId: annotatorId });
  
  if (!userScore) {
    const User = require('../models/User');
    const user = await User.findById(annotatorId);
    userScore = new UserScore({
      userId: annotatorId,
      role: user.role,
      qualityScore: 100
    });
  }

  // Small positive boost for approval (max 100)
  userScore.qualityScore = Math.min(100, userScore.qualityScore + 0.5);
  userScore.approvedTasks = (userScore.approvedTasks || 0) + 1;
  userScore.completedTasks = (userScore.completedTasks || 0) + 1;
  userScore.lastUpdated = new Date();
  
  await userScore.save();
}

// Helper function to check and apply penalty on rejection
async function checkAndApplyPenaltyOnRejection(annotatorId, taskId, projectId, errorCategory, reviewComments, reviewerId) {
  // Get recent rejections for this annotator
  const recentRejections = await Task.find({
    annotatorId,
    status: 'rejected',
    reviewedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
  }).sort({ reviewedAt: -1 });

  const rejectionCount = recentRejections.length;
  
  // Get existing penalties
  const recentPenalties = await Penalty.find({
    userId: annotatorId,
    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  }).sort({ createdAt: -1 });

  // Map error category to error type
  const errorTypeMap = {
    'incorrect_label': 'wrong_label',
    'missing_label': 'missed_guideline',
    'poor_quality': 'sloppy_work',
    'does_not_follow_guidelines': 'missed_guideline',
    'other': 'repeat_error'
  };
  const errorType = errorTypeMap[errorCategory] || 'repeat_error';

  // Determine penalty level based on rejection history
  let penaltyLevel = 'warning';
  let action = 'notification';
  let scoreDeduction = 2;

  if (rejectionCount >= 5 || recentPenalties.filter(p => p.level === 'heavy').length > 0) {
    // Heavy penalty - too many rejections
    penaltyLevel = 'heavy';
    action = 'temporary_ban';
    scoreDeduction = 10;
  } else if (rejectionCount >= 3 || recentPenalties.filter(p => p.level === 'light').length > 0) {
    // Light penalty - multiple rejections
    penaltyLevel = 'light';
    action = 'reduce_tasks';
    scoreDeduction = 5;
  } else if (rejectionCount >= 2) {
    // Warning - second rejection
    penaltyLevel = 'warning';
    action = 'read_guideline';
    scoreDeduction = 2;
  } else {
    // First time - just warning, no penalty yet
    const warning = new Warning({
      userId: annotatorId,
      role: 'annotator',
      type: 'first_time',
      reason: `Task bị reject: ${reviewComments || errorCategory}`,
      relatedTaskId: taskId,
      relatedProjectId: projectId,
      createdBy: reviewerId
    });
    await warning.save();
    return; // No penalty for first rejection
  }

  // Create penalty
  const penalty = new Penalty({
    userId: annotatorId,
    role: 'annotator',
    level: penaltyLevel,
    reason: `Task bị reject (lần ${rejectionCount}): ${reviewComments || errorCategory}`,
    errorType,
    relatedTaskId: taskId,
    relatedProjectId: projectId,
    scoreDeduction,
    action,
    createdBy: reviewerId,
    metadata: {
      rejectionCount,
      errorCategory
    }
  });
  await penalty.save();

  // Update user score
  let userScore = await UserScore.findOne({ userId: annotatorId });
  if (!userScore) {
    const User = require('../models/User');
    const user = await User.findById(annotatorId);
    userScore = new UserScore({
      userId: annotatorId,
      role: user.role,
      qualityScore: 100
    });
  }

  userScore.qualityScore = Math.max(0, userScore.qualityScore - scoreDeduction);
  userScore.rejectedTasks = (userScore.rejectedTasks || 0) + 1;
  userScore.currentPenaltyLevel = penaltyLevel;
  userScore.lastUpdated = new Date();
  await userScore.save();

  // Apply penalty actions
  if (action === 'reduce_tasks') {
    if (!userScore.weeklyTaskLimit || userScore.weeklyTaskLimit > 10) {
      userScore.weeklyTaskLimit = 10;
    } else {
      userScore.weeklyTaskLimit = Math.max(5, userScore.weeklyTaskLimit - 5);
    }
    await userScore.save();
  } else if (action === 'temporary_ban') {
    userScore.isRestricted = true;
    const banDays = penaltyLevel === 'heavy' ? 7 : 3;
    userScore.restrictionUntil = new Date();
    userScore.restrictionUntil.setDate(userScore.restrictionUntil.getDate() + banDays);
    await userScore.save();
  }
}

module.exports = router;
