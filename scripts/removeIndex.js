
import mongoose from 'mongoose';
import config from '../config/config.js';

const removeIndex = async () => {
  try {
    await mongoose.connect(config.dbUri, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = mongoose.connection.db;
    await db.collection('processes').dropIndex('processId_1');
    console.log('Index processId_1 dropped successfully');
    mongoose.disconnect();
  } catch (error) {
    console.error(`Failed to drop index: ${error.message}`);
  }
};

removeIndex();