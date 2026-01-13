const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

async function testUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/data-labeling', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    const annotators = await User.find({ role: 'annotator' });
    console.log('\n=== ANNOTATORS IN DATABASE ===');
    console.log(`Total annotators: ${annotators.length}`);
    
    annotators.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.fullName} (${user.username})`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Active: ${user.isActive}`);
      console.log(`   Role: ${user.role}`);
    });

    const activeAnnotators = await User.find({ role: 'annotator', isActive: true });
    console.log(`\nActive annotators: ${activeAnnotators.length}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testUsers();
