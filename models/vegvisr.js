import { Schema, model } from 'mongoose';

// Define the schema
const vegvisrSchema = new Schema({
  _id: Schema.Types.ObjectId,
  Date: {
    type: String,
    required: true
  },
  Name: {
    type: String,
    required: true
  },
  Year: {
    type: Number,
    required: true
  }
}, { collection: 'vegvisr' });

// Create the model
const Vegvisr = model('Vegvisr', vegvisrSchema);

export default Vegvisr;
