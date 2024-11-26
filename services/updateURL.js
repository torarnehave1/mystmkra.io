import mongoose from 'mongoose';
import Mdfiles from '../models/Mdfiles.js'; // Adjust the path based on your project structure
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('MongoDB URL:', process.env.MONGO_DB_URL);

// Connect to your MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect('', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB with Mongoose');
    } catch (err) {
        console.error('Could not connect to MongoDB', err);
        process.exit(1); // Exit the script if connection fails
    }
};

// Function to update the URL field
const updateURLs = async () => {
    try {
        const documents = await Mdfiles.find({ URL: { $exists: false } }); // Only update documents without a URL
        console.log(`Found ${documents.length} documents to update.`);

        for (const doc of documents) {
            const userId = doc.User_id; // Replace with the actual field name in your schema
            const resultId = doc._id; // Assuming `_id` is the unique identifier
            if (!userId) {
                console.log(`Skipping document ${resultId} as User_id is missing.`);
                continue;
            }

            const fileUrl = `https://mystmkra.io/dropbox/blog/${userId}/${resultId}.md`;

            // Use updateOne to avoid triggering validation
            await Mdfiles.updateOne(
                { _id: doc._id },
                { $set: { URL: fileUrl } }
            );
            console.log(`Updated document ${doc._id} with URL: "${fileUrl}"`);
        }

        console.log('URL update completed.');
    } catch (err) {
        console.error('Error updating URLs:', err);
    } finally {
        mongoose.connection.close();
    }
};

// Run the update function
(async () => {
    await connectDB(); // Connect to the database
    await updateURLs(); // Perform the URL updates
})();
