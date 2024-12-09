/* global use, db */
// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

// The current database to use.
use('slowyounet');

// Search for documents in the current collection.
db.getCollection('processes')
  
//Drop Index processId_1
//db.getCollection('processes').dropIndex('processId_1')

//DELETE ALL DOCUMENTS

db.getCollection('processes').deleteMany({})
//db.getCollection('userstates').deleteMany({})
//db.getCollection('processanswers').deleteMany({})