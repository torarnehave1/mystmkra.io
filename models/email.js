import { Schema, model } from 'mongoose';


const emailSchema = new Schema({
  sender_name: String,
  sender_email: String,
  recipient_name: String,
  recipient_email: String,
  subject: String,
  body: String,
  attachment_url: String,
  send_date: Date,
  is_read: Boolean,
  is_spam: Boolean,
  recipient_cc_email: String,
  recipient_bc_email: String
});

const Email = model('Email', emailSchema,'email' );

export default Email;