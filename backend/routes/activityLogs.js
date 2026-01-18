const express = require('express');
const ActivityLog = require('../models/ActivityLog');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all activity logs (Admin only)
router.get('/', auth, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50, action, userId, resourceType, startDate, endDate } = req.query;
    
    const query = {};
    
    if (action) {
      query.action = action;
    }
    
    if (userId) {
      query.userId = userId;
    }
    
    if (resourceType) {
      query.resourceType = resourceType;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const logs = await ActivityLog.find(query)
      .populate('userId', 'username fullName email role')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ActivityLog.countDocuments(query);

    res.json({
      logs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get activity statistics (Admin only)
router.get('/stats', auth, authorize('admin'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    const actionStats = await ActivityLog.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const userStats = await ActivityLog.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const User = require('../models/User');
    const userIds = userStats.map(s => s._id);
    const users = await User.find({ _id: { $in: userIds } }).select('username fullName email role');
    const userMap = {};
    users.forEach(u => userMap[u._id.toString()] = u);

    const userStatsWithNames = userStats.map(stat => ({
      user: userMap[stat._id.toString()] || { username: 'Unknown' },
      count: stat.count
    }));

    const dailyStats = await ActivityLog.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      actionStats,
      userStats: userStatsWithNames,
      dailyStats
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Helper function to create activity log (can be used in other routes)
const createActivityLog = async (userId, action, resourceType, resourceId, description, metadata, req) => {
  try {
    const log = new ActivityLog({
      userId,
      action,
      resourceType,
      resourceId,
      description,
      metadata,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });
    await log.save();
  } catch (error) {
    console.error('Error creating activity log:', error);
    // Don't throw error, just log it
  }
};

module.exports = { router, createActivityLog };
