const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');
const { createActivityLog } = require('./activityLogs');

const router = express.Router();

// Get current user profile (all authenticated roles)
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update current user profile (all authenticated roles)
router.put('/me', auth, [
  body('fullName').optional().trim().isLength({ min: 1 }).withMessage('fullName is required'),
  body('email').optional().isEmail().withMessage('Invalid email').normalizeEmail(),
  body('specialty').optional().trim(),
  body('currentPassword').optional().isString(),
  body('newPassword').optional().isLength({ min: 6 }).withMessage('newPassword must be at least 6 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const allowedFields = ['fullName', 'email', 'specialty'];
    allowedFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        const val = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
        user[field] = val;
      }
    });

    // Password change (optional)
    if (req.body.newPassword) {
      if (!req.body.currentPassword) {
        return res.status(400).json({ message: 'currentPassword is required to change password' });
      }
      const ok = await user.comparePassword(req.body.currentPassword);
      if (!ok) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      user.password = req.body.newPassword;
    }

    await user.save();

    // Log profile update (avoid logging raw values)
    await createActivityLog(
      req.user._id,
      'profile_update',
      'user',
      user._id,
      `Updated own profile`,
      { updatedFields: Object.keys(req.body).filter((k) => k !== 'currentPassword' && k !== 'newPassword') },
      req
    );

    const sanitized = await User.findById(user._id).select('-password');
    res.json({ user: sanitized });
  } catch (error) {
    // Duplicate email/username errors
    if (error?.code === 11000) {
      const key = Object.keys(error.keyPattern || {})[0] || 'field';
      return res.status(400).json({ message: `${key} already exists` });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all users (Admin only) or get annotators/reviewers (Manager can also access)
router.get('/', auth, async (req, res) => {
  try {
    console.log('GET /api/users - User role:', req.user.role);
    
    // If manager, return both annotators and reviewers
    if (req.user.role === 'manager') {
      const [annotators, reviewers] = await Promise.all([
        User.find({ role: 'annotator', isActive: true })
          .select('-password')
          .sort({ createdAt: -1 }),
        User.find({ role: 'reviewer', isActive: true })
          .select('-password')
          .sort({ createdAt: -1 })
      ]);
      console.log('Found annotators:', annotators.length, 'reviewers:', reviewers.length);
      // Return both as a single array
      return res.json([...annotators, ...reviewers]);
    }
    
    // Admin can see all users
    if (req.user.role === 'admin') {
      const users = await User.find().select('-password').sort({ createdAt: -1 });
      return res.json(users);
    }
    
    // Other roles cannot access
    console.log('Access denied for role:', req.user.role);
    res.status(403).json({ message: 'Forbidden - Only admin and manager can access this endpoint' });
  } catch (error) {
    console.error('Error in GET /api/users:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user (Admin only)
router.put('/:id', auth, authorize('admin'), [
  body('role').optional().isIn(['admin', 'manager', 'annotator', 'reviewer']),
  body('isActive').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Log user update
    const action = req.body.isActive === false ? 'user_deactivate' : 
                   req.body.isActive === true ? 'user_activate' : 'user_update';
    await createActivityLog(
      req.user._id,
      action,
      'user',
      user._id,
      `${action === 'user_deactivate' ? 'Deactivated' : action === 'user_activate' ? 'Activated' : 'Updated'} user: ${user.username}`,
      { 
        targetUserId: user._id.toString(),
        targetUsername: user.username,
        changes: req.body
      },
      req
    );

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete user (Admin only)
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Log user deletion
    await createActivityLog(
      req.user._id,
      'user_delete',
      'user',
      req.params.id,
      `Deleted user: ${user.username}`,
      { 
        deletedUsername: user.username,
        deletedUserRole: user.role
      },
      req
    );

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
