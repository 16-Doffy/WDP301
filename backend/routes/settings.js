const express = require('express');
const { body, validationResult } = require('express-validator');
const SystemSettings = require('../models/SystemSettings');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Get system settings (Admin only)
router.get('/', auth, authorize('admin'), async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update system settings (Admin only)
router.put('/', auth, authorize('admin'), [
  body('email.smtpPort').optional().isInt({ min: 1, max: 65535 }),
  body('storage.maxFileSize').optional().isInt({ min: 1024 }), // At least 1KB
  body('storage.maxFilesPerDataset').optional().isInt({ min: 1 }),
  body('tasks.maxTasksPerAnnotator').optional().isInt({ min: 1 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let settings = await SystemSettings.findOne();
    
    if (!settings) {
      settings = new SystemSettings();
    }

    // Update settings with provided data
    if (req.body.email !== undefined) {
      settings.email = { ...settings.email, ...req.body.email };
    }
    
    if (req.body.storage !== undefined) {
      settings.storage = { ...settings.storage, ...req.body.storage };
    }
    
    if (req.body.tasks !== undefined) {
      settings.tasks = { ...settings.tasks, ...req.body.tasks };
    }
    
    if (req.body.review !== undefined) {
      settings.review = { ...settings.review, ...req.body.review };
    }
    
    if (req.body.general !== undefined) {
      settings.general = { ...settings.general, ...req.body.general };
    }
    
    if (req.body.notifications !== undefined) {
      settings.notifications = { ...settings.notifications, ...req.body.notifications };
    }

    settings.updatedAt = new Date();
    settings.updatedBy = req.user._id;
    
    await settings.save();
    
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Reset settings to default (Admin only)
router.post('/reset', auth, authorize('admin'), async (req, res) => {
  try {
    await SystemSettings.deleteMany({});
    const settings = await SystemSettings.getSettings();
    settings.updatedBy = req.user._id;
    await settings.save();
    
    res.json({ message: 'Settings reset to default', settings });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
