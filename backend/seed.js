const mongoose = require('mongoose');
const User = require('./models/User');
const Project = require('./models/Project');
const Dataset = require('./models/Dataset');
const Task = require('./models/Task');
const dotenv = require('dotenv');

dotenv.config();

// Tài khoản mẫu cho mỗi role
const sampleUsers = [
  {
    username: 'admin',
    email: 'admin@example.com',
    password: 'admin123',
    fullName: 'Administrator',
    role: 'admin',
    isActive: true
  },
  {
    username: 'manager1',
    email: 'manager@example.com',
    password: 'manager123',
    fullName: 'Manager User',
    role: 'manager',
    isActive: true
  },
  {
    username: 'annotator1',
    email: 'annotator1@example.com',
    password: 'annotator123',
    fullName: 'Annotator One',
    role: 'annotator',
    isActive: true
  },
  {
    username: 'annotator2',
    email: 'annotator2@example.com',
    password: 'annotator123',
    fullName: 'Annotator Two',
    role: 'annotator',
    isActive: true
  },
  {
    username: 'reviewer1',
    email: 'reviewer@example.com',
    password: 'reviewer123',
    fullName: 'Reviewer User',
    role: 'reviewer',
    isActive: true
  }
];

async function seed() {
  try {
    // Kết nối MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/data-labeling', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Xóa dữ liệu cũ (tùy chọn)
    await User.deleteMany({});
    await Project.deleteMany({});
    await Dataset.deleteMany({});
    await Task.deleteMany({});
    console.log('Cleared existing data');

    // Tạo users
    const createdUsers = {};
    for (const userData of sampleUsers) {
      const user = new User(userData);
      await user.save();
      createdUsers[userData.role] = createdUsers[userData.role] || [];
      createdUsers[userData.role].push(user);
      console.log(`Created user: ${userData.username} (${userData.role})`);
    }

    // Tạo project mẫu nếu có manager
    if (createdUsers.manager && createdUsers.manager.length > 0) {
      const manager = createdUsers.manager[0];
      
      const project = new Project({
        name: 'Sample Image Labeling Project',
        description: 'Dự án mẫu để gán nhãn ảnh - đánh dấu đối tượng trong ảnh',
        managerId: manager._id,
        labelSet: [
          {
            name: 'Person',
            color: '#FF0000',
            description: 'Người'
          },
          {
            name: 'Car',
            color: '#00FF00',
            description: 'Xe ô tô'
          },
          {
            name: 'Bicycle',
            color: '#0000FF',
            description: 'Xe đạp'
          },
          {
            name: 'Dog',
            color: '#FFFF00',
            description: 'Chó'
          }
        ],
        guidelines: `Hướng dẫn gán nhãn:
1. Xem xét kỹ ảnh trước khi gán nhãn
2. Đánh dấu tất cả các đối tượng có trong ảnh
3. Sử dụng đúng nhãn từ bộ nhãn đã định nghĩa
4. Đảm bảo độ chính xác và nhất quán
5. Nếu không chắc chắn, hãy hỏi manager`,
        status: 'active'
      });
      await project.save();
      console.log(`Created project: ${project.name}`);

      // Tạo dataset mẫu (không có file thực tế, chỉ là ví dụ)
      const dataset = new Dataset({
        projectId: project._id,
        name: 'Sample Dataset 1',
        description: 'Dataset mẫu với 5 ảnh',
        files: [
          {
            filename: 'sample1.jpg',
            originalName: 'sample1.jpg',
            path: 'uploads/datasets/sample1.jpg',
            mimeType: 'image/jpeg',
            size: 102400
          },
          {
            filename: 'sample2.jpg',
            originalName: 'sample2.jpg',
            path: 'uploads/datasets/sample2.jpg',
            mimeType: 'image/jpeg',
            size: 153600
          },
          {
            filename: 'sample3.jpg',
            originalName: 'sample3.jpg',
            path: 'uploads/datasets/sample3.jpg',
            mimeType: 'image/jpeg',
            size: 204800
          }
        ],
        totalItems: 3
      });
      await dataset.save();
      console.log(`Created dataset: ${dataset.name}`);

      // Tạo tasks mẫu nếu có annotator
      if (createdUsers.annotator && createdUsers.annotator.length > 0) {
        const annotator = createdUsers.annotator[0];
        
        const task = new Task({
          projectId: project._id,
          datasetId: dataset._id,
          annotatorId: annotator._id,
          dataItem: dataset.files[0],
          status: 'assigned',
          labels: {}
        });
        await task.save();
        console.log(`Created sample task for annotator`);
      }
    }

    console.log('\n=== SEED COMPLETED ===');
    console.log('\nTài khoản đã được tạo:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    sampleUsers.forEach(user => {
      console.log(`\nRole: ${user.role.toUpperCase()}`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Password: ${user.password}`);
      console.log(`  Full Name: ${user.fullName}`);
    });
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nBạn có thể sử dụng các tài khoản trên để đăng nhập!');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seed();
