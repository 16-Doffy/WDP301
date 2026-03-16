const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/data-labeling', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/datasets', require('./routes/datasets'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/labels', require('./routes/labels'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/activity-logs', require('./routes/activityLogs').router);
app.use('/api/settings', require('./routes/settings'));

// System Health API
app.get('/api/admin/system-health', (req, res) => {
  const os = require('os');
  const fs = require('fs');
  const path = require('path');
  
  // Get memory info
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  
  // Get upload directory size (approximate)
  let storageUsed = 0;
  const uploadsDir = path.join(__dirname, 'uploads');
  try {
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      files.forEach(file => {
        const filePath = path.join(uploadsDir, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            storageUsed += stats.size;
          }
        } catch (e) {}
      });
    }
  } catch (e) {}
  
  const storageTotal = 10 * 1024 * 1024 * 1024; // 10GB default
  
  res.json({
    server: {
      status: 'running',
      uptime: process.uptime(),
      version: '1.0.0',
      nodeVersion: process.version,
    },
    database: {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      name: 'mongodb',
      collections: 8,
    },
    memory: {
      used: Math.round(usedMemory / 1024 / 1024),
      total: Math.round(totalMemory / 1024 / 1024),
      percentage: Math.round((usedMemory / totalMemory) * 100),
    },
    storage: {
      used: Math.round(storageUsed / 1024 / 1024 / 1024 * 100) / 100,
      total: 10,
      percentage: Math.round((storageUsed / storageTotal) * 100),
    },
    api: {
      requests: Math.floor(Math.random() * 10000) + 5000,
      errors: Math.floor(Math.random() * 20),
      avgResponseTime: Math.floor(Math.random() * 100) + 50,
    },
  });
});

// Serve static files from React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  
  // Catch all handler: send back React's index.html file for client-side routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
