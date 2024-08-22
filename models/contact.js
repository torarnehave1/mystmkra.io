import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  FullName: {
    type: String,
    required: true
  },
  FirstName: {
    type: String,
    required: true
  },
  LastName: String,
  Notes: String,
  Photo: String,
  Label: String,
  Email: {
    type: String,
    required: true,
    default: ""
  },
  Phone: {
    type: String,
    required: true
  }
  ,
  Status: {
    type: String,
    enum: ["Active", "Ended", "Pause"],
    default: "Active"
  },
  StartDate:{
    type: Date,
  },

  EndDate:{
    type: Date,
  }
});

const Contact = mongoose.model('Contact', contactSchema);
export default Contact;