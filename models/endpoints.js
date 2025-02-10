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

    parameters: {
        type: [String],
        required: false,
    },


    Typeof: {
        type: String,
        enum: ['Assistants', 'List', 'Bot', 'OpenAI', 'Codeword', 'Public API', 'Private API', 'Test','Other'],
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
