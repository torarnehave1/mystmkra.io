import mongoose from 'mongoose';

const blogPostSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    
    filename:{
    type: String,
    required: true
  },
  
    title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  author: {
    type: String,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },

  publishedAt: {
    type: Date,
    default: Date.now
  },

  published: {
    type: Boolean,
    default: false
  },

  ImgURL:{
    type: String,
    required: false
  }

});

const BlogPost = mongoose.model('BlogPost', blogPostSchema);
export default BlogPost;