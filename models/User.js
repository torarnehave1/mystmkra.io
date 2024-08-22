import { Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new Schema({
  fullName: { type: String, required: true },
  username: { 
    type: String, 
    required: true, 
    unique: true,
    validate: {
      validator: function(v) {
        // Regular expression for basic email validation
        return /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/.test(v);
      },
      message: props => `${props.value} is not a valid email address!`
    },
  },
  password: { type: String, required: true },
  emailVerificationToken: { type: String, required: true },
  emailVerificationTokenExpires: {
    type: Date,
    required: true,
    default: () => Date.now() + 3600000 // 1 hour from now
  },
  createdAt: { 
    type: Date, 
    required: true, 
    default: Date.now 
  },
  isVerified: {
    type: Boolean,
    required: true,
    default: false
  },
  webpage: { type: String, required: false },
});

userSchema.methods.comparePassword = function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default model('User', userSchema);
