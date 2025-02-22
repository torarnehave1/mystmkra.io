import mongoose from 'mongoose';
import Process from '../models/process.js';
import config from '../config/config.js'; // Adjust the path as needed
import dotenv from 'dotenv';

dotenv.config();


// Connect to the MongoDB database
import { connect } from 'mongoose';
connect(process.env.MONGO_DB_URL)
  .then(() => console.log('Connected to MongoDB with Mongoose'))
  .catch(err => console.error('Could not connect to MongoDB', err));

const updateStepSequenceNumbers = async () => {
  try {
    const processes = await Process.find();

    for (const doc of processes) {
      doc.steps.forEach((step, index) => {
        step.stepSequenceNumber = index + 1; // Start numbering at 1
      });

      await doc.save();
      console.log(`Updated stepSequenceNumber for process ${doc._id}`);
    }

    console.log('All processes updated successfully');
  } catch (error) {
    console.error('Error updating stepSequenceNumber:', error);
  } finally {
    mongoose.connection.close();
  }
};

updateStepSequenceNumbers();
