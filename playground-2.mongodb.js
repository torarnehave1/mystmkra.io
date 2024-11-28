/* global use, db */
// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

// Switch to the database
use('slowyounet');

//find all documents in the collection mdfiles that does not have the title field show the id and fir 100 char of the content field

db.getCollection('mdfiles').find({ title: { $exists: false } }, { _id: 1, content: { $substr: ["$content", 0, 100] } });

/*

// Declare the variable for the ObjectId
const id = ObjectId("66d5db9f1fda9e66378415e6");

// Query to find the document
db.getCollection('mdfiles').find({ _id: id }, { title: 1, content: 1 });

// Update the title of the document
db.getCollection('mdfiles').updateOne(
    { _id: id }, // Match the document by ID
    { $set: { title: "Utforskningen av Utbrenthet og Selvforståelse" } } // Set the title field
);

// Query to find the updated document
db.getCollection('mdfiles').find({ _id: id }, { title: 1, content: 1 });
/*
// Delete the document with the given _id
db.getCollection('mdfiles').deleteOne(
    { _id: ObjectId("66ddf5ffd12c60345d5cd525") }
);

// Update another document's title to a specific string
db.getCollection('mdfiles').updateOne(
    { _id: ObjectId("66bca02aea4ed0d012754319") }, // Match the document by ID
    { $set: { title: "Integrating AlivenessLAB: A Holistic Approach to ADHD Management" } } // Set the title field
);

// Add a field to the document named `title` with the value of the first line of the `content` field
db.getCollection('mdfiles').updateOne(
    { _id: ObjectId("66bca02aea4ed0d012754319") },
    { 
        $set: { 
            title: {
                $arrayElemAt: [
                    { $split: ["$content", "\n"] }, // Split content by newline
                    0 // Get the first line
                ] 
            } 
        } 
    }
);
*/