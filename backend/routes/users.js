const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');
const { createActivityLog } = require('./activityLogs');

const router = express.Router();

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

// Get current user profile
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Change password (own profile only)
router.put('/me/password', auth, [
  body('currentPassword').trim().notEmpty().withMessage('Mat khau hien tai khong duoc de trong'),
  body('newPassword').trim().isLength({ min: 6 }).withMessage('Mat khau moi phai it nhat 6 ky tu'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mat khau hien tai khong dung' });
    }

    user.password = newPassword;
    await user.save();

    await createActivityLog(
      req.user._id,
      'password_change',
      'user',
      user._id,
      `Changed own password`,
      { targetUserId: user._id.toString() },
      req
    );

    res.json({ message: 'Doi mat khau thanh cong' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update current user profile (own profile only)
router.put('/me', auth, [
  body('fullName').optional().trim().notEmpty().withMessage('Ho ten khong duoc de trong'),
  body('specialty').optional().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { fullName, specialty } = req.body;
    const updateFields = {};
    if (fullName !== undefined) updateFields.fullName = fullName;
    if (specialty !== undefined) updateFields.specialty = specialty;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateFields,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await createActivityLog(
      req.user._id,
      'profile_update',
      'user',
      user._id,
      `Updated own profile`,
      { targetUserId: user._id.toString() },
      req
    );

    res.json(user);
  } catch (error) {
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
