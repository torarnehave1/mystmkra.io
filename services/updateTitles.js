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

// Function to extract the first heading
const extractTitle = (content) => {
    if (!content) return null;

    // Match the first Markdown heading (e.g., # Title)
    const match = content.match(/^#\s+(.*)$/m);
    return match ? match[1].trim() : null; // Return the extracted title or null
};

// Function to update documents
const updateTitles = async () => {
    try {
        const documents = await Mdfiles.find({ title: { $exists: false } });
        console.log(`Found ${documents.length} documents to update.`);

        for (const doc of documents) {
            const extractedTitle = extractTitle(doc.content);

            if (extractedTitle) {
                // Use updateOne to avoid triggering validation
                await Mdfiles.updateOne(
                    { _id: doc._id },
                    { $set: { title: extractedTitle } }
                );
                console.log(`Updated document ${doc._id} with title: "${extractedTitle}"`);
            } else {
                console.log(`No valid title found for document ${doc._id}`);
            }
        }

        console.log('Title update completed.');
    } catch (err) {
        console.error('Error updating titles:', err);
    } finally {
        mongoose.connection.close();
    }
};


// Run the update function
(async () => {
    await connectDB(); // Connect to the database
    await updateTitles(); // Perform the title updates
})();
