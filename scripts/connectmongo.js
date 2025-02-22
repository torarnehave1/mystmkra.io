import dotenv from 'dotenv';
import { connect } from 'mongoose';
import Process from '../models/process.js';

// Load environment variables from a .env file
dotenv.config();

const mongoUrl = process.env.MONGO_DB_URL;

if (!mongoUrl) {
  console.error('MONGO_DB_URL not defined in environment variables.');
  process.exit(1);
}


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

async function connectmongo() {
  try {
    await connect(mongoUrl);
    console.log('Connected to MongoDB with Mongoose');
    await updateStepSequenceNumbers();
    // Additional code after a successful connection can go here.
  } catch (err) {
    console.error('Could not connect to MongoDB', err);
    process.exit(1);
  }
}

connectmongo();
