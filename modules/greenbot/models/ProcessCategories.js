import mongoose from 'mongoose';

const ProcessCategoriesSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const ProcessCategories = mongoose.model('ProcessCategories', ProcessCategoriesSchema);

export default ProcessCategories;
