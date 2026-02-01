const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const Penalty = require('../models/Penalty');
const Warning = require('../models/Warning');
const UserScore = require('../models/UserScore');
const Task = require('../models/Task');
const User = require('../models/User');
const { createActivityLog } = require('./activityLogs');

// Get all penalties for a user (self or manager/admin)
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Users can only see their own penalties, unless they're manager/admin
    if (userId !== req.user._id.toString() && req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const penalties = await Penalty.find({ userId })
      .populate('createdBy', 'fullName username')
      .populate('relatedTaskId', 'dataItem')
      .populate('relatedProjectId', 'name')
      .sort({ createdAt: -1 });

    res.json(penalties);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get warnings for a user
router.get('/warnings/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (userId !== req.user._id.toString() && req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const warnings = await Warning.find({ userId, isRead: false })
      .populate('relatedTaskId', 'dataItem')
      .populate('relatedProjectId', 'name')
      .sort({ createdAt: -1 });

    res.json(warnings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create penalty (Manager/Admin only)
router.post('/', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const {
      userId,
      level,
      reason,
      errorType,
      relatedTaskId,
      relatedProjectId,
      action,
      metadata
    } = req.body;

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Calculate score deduction based on level
    const scoreDeductions = {
      warning: 2,
      light: 5,
      heavy: 10
    };
    const scoreDeduction = scoreDeductions[level] || 0;

    // Create penalty
    const penalty = new Penalty({
      userId,
      role: user.role,
      level,
      reason,
      errorType,
      relatedTaskId,
      relatedProjectId,
      scoreDeduction,
      action,
      createdBy: req.user._id,
      metadata: metadata || {}
    });

    await penalty.save();

    // Update user score
    await updateUserScore(userId, -scoreDeduction, level);

    // Apply penalty actions
    await applyPenaltyAction(userId, level, action, req.user._id);

    // Create warning if level is warning
    if (level === 'warning') {
      const warning = new Warning({
        userId,
        role: user.role,
        type: 'first_time',
        reason,
        relatedTaskId,
        relatedProjectId,
        createdBy: req.user._id
      });
      await warning.save();
    }

    // Log activity
    await createActivityLog(
      req.user._id,
      'penalty_create',
      'penalty',
      penalty._id,
      `Created ${level} penalty for ${user.fullName || user.username}: ${reason}`,
      { userId, level, reason },
      req
    );

    res.status(201).json(penalty);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Resolve penalty (Manager/Admin only)
router.put('/:id/resolve', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const penalty = await Penalty.findById(req.params.id);
    if (!penalty) {
      return res.status(404).json({ message: 'Penalty not found' });
    }

    penalty.status = 'resolved';
    penalty.resolvedAt = new Date();
    penalty.resolvedBy = req.user._id;

    await penalty.save();

    res.json(penalty);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Mark warning as read
router.put('/warnings/:id/read', auth, async (req, res) => {
  try {
    const warning = await Warning.findById(req.params.id);
    if (!warning) {
      return res.status(404).json({ message: 'Warning not found' });
    }

    // Check ownership
    if (warning.userId.toString() !== req.user._id.toString() && req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    warning.isRead = true;
    await warning.save();

    res.json(warning);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user score
router.get('/score/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (userId !== req.user._id.toString() && req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    let userScore = await UserScore.findOne({ userId });
    
    // Create if doesn't exist
    if (!userScore) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      userScore = new UserScore({
        userId,
        role: user.role
      });
      await userScore.save();
    }

    res.json(userScore);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Helper function to update user score
async function updateUserScore(userId, deduction, penaltyLevel) {
  let userScore = await UserScore.findOne({ userId });
  
  if (!userScore) {
    const user = await User.findById(userId);
    userScore = new UserScore({
      userId,
      role: user.role,
      qualityScore: 100
    });
  }

  // Deduct score
  userScore.qualityScore = Math.max(0, userScore.qualityScore + deduction);
  
  // Update penalty level
  if (penaltyLevel === 'warning') {
    userScore.currentPenaltyLevel = 'warning';
  } else if (penaltyLevel === 'light') {
    userScore.currentPenaltyLevel = 'light';
  } else if (penaltyLevel === 'heavy') {
    userScore.currentPenaltyLevel = 'heavy';
  }

  // Update error rate if we have task data
  const tasks = await Task.find({ 
    $or: [
      { annotatorId: userId },
      { reviewerId: userId }
    ]
  });

  if (tasks.length > 0) {
    const rejectedTasks = tasks.filter(t => t.status === 'rejected').length;
    userScore.errorRate = (rejectedTasks / tasks.length) * 100;
    userScore.rejectedTasks = rejectedTasks;
    userScore.completedTasks = tasks.filter(t => ['submitted', 'approved'].includes(t.status)).length;
    userScore.approvedTasks = tasks.filter(t => t.status === 'approved').length;
  }

  userScore.lastUpdated = new Date();
  await userScore.save();

  return userScore;
}

// Helper function to apply penalty actions
async function applyPenaltyAction(userId, level, action, createdBy) {
  const user = await User.findById(userId);
  if (!user) return;

  let userScore = await UserScore.findOne({ userId });
  if (!userScore) {
    userScore = new UserScore({ userId, role: user.role });
  }

  switch (action) {
    case 'reduce_tasks':
      // Reduce weekly task limit
      if (!userScore.weeklyTaskLimit || userScore.weeklyTaskLimit > 10) {
        userScore.weeklyTaskLimit = 10; // Limit to 10 tasks per week
      } else {
        userScore.weeklyTaskLimit = Math.max(5, userScore.weeklyTaskLimit - 5);
      }
      break;

    case 'temporary_ban':
      // Ban for 1-7 days based on level
      const banDays = level === 'light' ? 1 : level === 'heavy' ? 7 : 3;
      userScore.isRestricted = true;
      userScore.restrictionUntil = new Date();
      userScore.restrictionUntil.setDate(userScore.restrictionUntil.getDate() + banDays);
      break;

    case 'downgrade_level':
      // Could implement level system here
      // For now, just mark as restricted
      userScore.isRestricted = true;
      break;
  }

  await userScore.save();
}

// Auto-check and apply penalties based on error rate
router.post('/check-auto-penalty/:userId', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let userScore = await UserScore.findOne({ userId });
    if (!userScore) {
      userScore = await updateUserScore(userId, 0, 'none');
    }

    // Get recent tasks
    const recentTasks = await Task.find({
      $or: [
        { annotatorId: userId },
        { reviewerId: userId }
      ],
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    });

    if (recentTasks.length === 0) {
      return res.json({ message: 'No recent tasks to evaluate' });
    }

    const rejectedCount = recentTasks.filter(t => t.status === 'rejected').length;
    const errorRate = (rejectedCount / recentTasks.length) * 100;

    // Auto-apply penalties based on error rate
    if (errorRate > 30 && userScore.currentPenaltyLevel !== 'heavy') {
      // Heavy penalty
      const penalty = new Penalty({
        userId,
        role: user.role,
        level: 'heavy',
        reason: `Error rate quá cao: ${errorRate.toFixed(1)}% trong 7 ngày qua`,
        errorType: 'repeat_error',
        scoreDeduction: 10,
        action: 'temporary_ban',
        createdBy: req.user._id
      });
      await penalty.save();
      await updateUserScore(userId, -10, 'heavy');
      await applyPenaltyAction(userId, 'heavy', 'temporary_ban', req.user._id);
    } else if (errorRate > 15 && userScore.currentPenaltyLevel === 'none') {
      // Light penalty
      const penalty = new Penalty({
        userId,
        role: user.role,
        level: 'light',
        reason: `Error rate cao: ${errorRate.toFixed(1)}% trong 7 ngày qua`,
        errorType: 'repeat_error',
        scoreDeduction: 5,
        action: 'reduce_tasks',
        createdBy: req.user._id
      });
      await penalty.save();
      await updateUserScore(userId, -5, 'light');
      await applyPenaltyAction(userId, 'light', 'reduce_tasks', req.user._id);
    } else if (errorRate > 10 && userScore.currentPenaltyLevel === 'none') {
      // Warning
      const warning = new Warning({
        userId,
        role: user.role,
        type: 'first_time',
        reason: `Error rate: ${errorRate.toFixed(1)}% - Cần cải thiện chất lượng`,
        createdBy: req.user._id
      });
      await warning.save();
    }

    res.json({ 
      message: 'Auto-penalty check completed',
      errorRate,
      currentLevel: userScore.currentPenaltyLevel
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
