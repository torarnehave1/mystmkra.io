import mongoose from 'mongoose';

const endpointSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true,
        unique: false, // Ensures URLs are unique
    },
    trigger: {
        type: String,
        required: true,
        unique: true,
    },
    Typeof: {
        type: String,
        enum: ['List', 'Test', 'Bot', 'OpenAI', 'Codeword', 'Public API', 'Private API', 'Other'],
        required: true,
    },
    description: {
        type: String,
        required: false,
    },
}, {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
});

const Endpoint = mongoose.model('Endpoint', endpointSchema);
export default Endpoint;
