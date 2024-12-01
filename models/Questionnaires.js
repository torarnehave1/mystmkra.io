// models/questionnaires.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

// Define the schema for a single question
const questionSchema = new Schema({
    id: { type: String, required: true },
    text: { type: String, required: true },
    type: { type: String, required: true },
    options: [{ type: String }], // Optional field for multiple-choice questions
});

// Define the schema for a category that contains questions
const categorySchema = new Schema({
    title: { type: String, required: true }, // Title for the category (optional field if needed)
    questions: [questionSchema], // Array of questions for the category
});

// Define the schema for the questionnaire
const questionnaireSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String },
    categories: [categorySchema], // Array of categories with questions
});

const Questionnaire = mongoose.model('Questionnaire', questionnaireSchema);

export default Questionnaire;
