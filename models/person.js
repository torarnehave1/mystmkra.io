// models/person.js
import { Schema, model } from 'mongoose';

const personSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  givenname: {
    type: String,
    required: true
  },
  familyname: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  organization: {
    type: String,
    required: true
  }
});

const Person = model('Person', personSchema, 'personer');

export default Person;