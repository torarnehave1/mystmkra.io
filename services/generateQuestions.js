import OpenAI from 'openai';
import config from '../config/config.js';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

const checkForDuplicates = (newQuestions, existingQuestions) => {
    const existingSet = new Set(existingQuestions.map((q) => q.text.toLowerCase()));
    return newQuestions.filter((q) => !existingSet.has(q.toLowerCase()));
  };

const generateQuestionsFromOpenAI = async (userState, prompt, numQuestions = 3) => {
  try {
    const messages = [
      { role: 'system', content: 'You are a helpful assistant that generates meaningful questions for users.' },
      ...userState.conversationHistory,
      { role: 'user', content: prompt },
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: messages,
    });

    const generatedQuestions = response.choices[0].message.content
      .split('\n')
      .filter((line) => line.trim() && !isNaN(line.trim()[0]))
      .slice(0, numQuestions)
      .map((line) => line.replace(/^\d+\.\s*/, '').trim());

    // Update conversation history
    userState.conversationHistory.push(
      { role: 'user', content: prompt },
      { role: 'assistant', content: response.choices[0].message.content }
    );
    await userState.save();

    return generatedQuestions;
  } catch (error) {
    console.error('Error generating questions:', error.message);
    return [];
  }
};
export { generateQuestionsFromOpenAI, checkForDuplicates };
