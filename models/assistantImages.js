import mongoose from 'mongoose';

const assistantImageSchema = new mongoose.Schema({
    assistant_id: {
        type: String,
        required: true,
        unique: true
    },
    image_url: {
        type: String,
        required: true
    }
});

const AssistantImage = mongoose.model('AssistantImage', assistantImageSchema);

export default AssistantImage;
