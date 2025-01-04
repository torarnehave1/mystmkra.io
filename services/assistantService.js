import Assistant from '../models/assitants.js'; // Import the Assistant model

// Function to fetch all assistants from the database
export async function fetchAllAssistants() {
  try {
    const assistants = await Assistant.find();
    return assistants;
  } catch (error) {
    console.error("Error fetching assistants from the database:", error);
    throw error;
  }
}

// Function to fetch an assistant by ID from the database
export async function fetchAssistantById(id) {
  try {
    const assistant = await Assistant.findOne({ id });
    return assistant;
  } catch (error) {
    console.error(`Error fetching assistant with ID ${id} from the database:`, error);
    throw error;
  }
}
