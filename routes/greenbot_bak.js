import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import dotenv from 'dotenv';
import logMessage from '../services/logMessage.js';
import config from '../config/config.js';
import Questionnaire from '../models/Questionnaires.js';

dotenv.config();

// Function to start a questionnaire by sending the first question
const startQuestionnaire = async (chatId, questionnaireId) => {
  const questionnaire = await Questionnaire.findById(questionnaireId);

  if (!questionnaire) {
    await sendMessageWithKeyboard(chatId, 'The requested questionnaire could not be found.');
    return;
  }

  // Initialize user state for the questionnaire
  userState[chatId] = {
    questionnaireId: questionnaire._id,
    currentQuestionIndex: 0,
    responses: [],
  };

  // Send the first question
  const firstQuestion = questionnaire.questions[0];
  await sendMessageWithKeyboard(chatId, `Question 1: ${firstQuestion.text}`, 
    firstQuestion.type === 'multiple_choice'
      ? {
          inline_keyboard: firstQuestion.options.map((option) => [
            { text: option, callback_data: `answer_${option}` },
          ]),
        }
      : null
  );
};

// Telegram bot2 token
const TELEGRAM_BOT2_TOKEN = config.NODE_ENV === 'production'
  ? process.env.TELEGRAM_BOT2_TOKEN_PROD
  : process.env.TELEGRAM_BOT2_TOKEN_DEV;

if (!TELEGRAM_BOT2_TOKEN) {
  console.error('Error: Telegram Bot 2 token is not set.');
  process.exit(1);
}

// Create a Telegram bot2 instance
const bot2 = new TelegramBot(TELEGRAM_BOT2_TOKEN, { polling: true });

// User state object to track user interactions
const userState = {};

// Function to reset user state
const resetUserState = (chatId) => {
  delete userState[chatId];
};

// Function to send a message with optional inline keyboard
const sendMessageWithKeyboard = async (chatId, text, options = null) => {
  await bot2.sendMessage(chatId, text, options ? { reply_markup: options } : {});
};

// Function to save questionnaire responses
const saveResponsesToDatabase = async (chatId, responses) => {
  // Implement database logic here
  console.log(`Saving responses for chatId ${chatId}:`, responses);
};

// Function to process and move to the next question
const processNextQuestion = async (chatId) => {
  const state = userState[chatId];
  const questionnaire = await Questionnaire.findById(state.questionnaireId);

  if (!questionnaire) {
    await sendMessageWithKeyboard(chatId, 'The questionnaire is no longer available.');
    resetUserState(chatId);
    return;
  }

  const currentQuestionIndex = state.currentQuestionIndex;
  const nextQuestionIndex = currentQuestionIndex + 1;

  if (nextQuestionIndex < questionnaire.questions.length) {
    state.currentQuestionIndex = nextQuestionIndex;
    const nextQuestion = questionnaire.questions[nextQuestionIndex];

    await sendMessageWithKeyboard(chatId, `Question ${nextQuestionIndex + 1}: ${nextQuestion.text}`, 
      nextQuestion.type === 'multiple_choice'
        ? {
            inline_keyboard: nextQuestion.options.map((option) => [
              { text: option, callback_data: `answer_${option}` },
            ]),
          }
        : null
    );
  } else {
    await sendMessageWithKeyboard(chatId, 'Thank you for completing the questionnaire!');
    console.log('User Responses:', state.responses);

    await saveResponsesToDatabase(chatId, state.responses);
    resetUserState(chatId);
  }
};

// Handle the /manage command
bot2.onText(/\/manage/, async (msg) => {
  const chatId = msg.chat.id;

  resetUserState(chatId);

  await sendMessageWithKeyboard(chatId, 'What would you like to do?', {
    inline_keyboard: [
      [{ text: 'Create', callback_data: 'create_questionnaire' }],
      [{ text: 'Update', callback_data: 'update_questionnaire' }],
      [{ text: 'Delete', callback_data: 'delete_questionnaire' }],
      [{ text: 'View All', callback_data: 'view_questionnaires' }],
    ],
  });
});

// Handle inline button callbacks
bot2.on('callback_query', async (callbackQuery) => {
  const { data, message } = callbackQuery;
  const chatId = message.chat.id;

  if (data === 'create_questionnaire') {
    userState[chatId] = { action: 'creating', step: 'title' };
    await sendMessageWithKeyboard(chatId, 'Enter the title of the questionnaire:');
  } else if (data.startsWith('answer_')) {
    const state = userState[chatId];
    if (!state) {
      await sendMessageWithKeyboard(chatId, 'Please start a questionnaire first.');
      return;
    }

    const answer = data.split('_')[1];
    const currentQuestionIndex = state.currentQuestionIndex;
    const questionnaire = await Questionnaire.findById(state.questionnaireId);

    if (!questionnaire) {
      await sendMessageWithKeyboard(chatId, 'The questionnaire is no longer available.');
      resetUserState(chatId);
      return;
    }

    const currentQuestion = questionnaire.questions[currentQuestionIndex];
    state.responses.push({ question: currentQuestion.text, answer });

    await processNextQuestion(chatId);
  } else {
    await sendMessageWithKeyboard(chatId, 'This action is not implemented yet.');
  }

  await bot2.answerCallbackQuery(callbackQuery.id);
});

// Handle user messages for questionnaire creation or responses
bot2.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const state = userState[chatId];
  if (!state) return;

  try {
    if (state.action === 'creating') {
      if (state.step === 'title') {
        state.title = msg.text;
        state.step = 'description';
        await sendMessageWithKeyboard(chatId, 'Enter the description of the questionnaire:');
      } else if (state.step === 'description') {
        state.description = msg.text;
        state.step = 'questions';
        state.questions = [];
        await sendMessageWithKeyboard(chatId, 'Enter the first question (type "done" when finished):');
      } else if (state.step === 'questions') {
        if (msg.text.toLowerCase() === 'done') {
          const questionnaire = {
            title: state.title,
            description: state.description,
            questions: state.questions,
          };

          await Questionnaire.create(questionnaire);
          resetUserState(chatId);
          await sendMessageWithKeyboard(chatId, 'Questionnaire created successfully!');
        } else {
          state.questions.push({ id: state.questions.length + 1, text: msg.text, type: 'text' });
          await sendMessageWithKeyboard(chatId, 'Enter the next question (type "done" when finished):');
        }
      }
    } else if (state.action === 'responding') {
      const currentQuestionIndex = state.currentQuestionIndex;
      const questionnaire = await Questionnaire.findById(state.questionnaireId);

      if (!questionnaire) {
        await sendMessageWithKeyboard(chatId, 'The questionnaire is no longer available.');
        resetUserState(chatId);
        return;
      }

      const currentQuestion = questionnaire.questions[currentQuestionIndex];
      state.responses.push({ question: currentQuestion.text, answer: msg.text });

      await processNextQuestion(chatId);
    }
  } catch (error) {
    console.error('Error processing user state:', error.message);
    await sendMessageWithKeyboard(chatId, 'An error occurred. Please try again.');
  }
});

// Handle /start_questionnaire command
bot2.onText(/\/startq (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const questionnaireId = match[1]; // Extract questionnaire ID from the command

  try {
    await startQuestionnaire(chatId, questionnaireId);
  } catch (error) {
    console.error('Error starting questionnaire:', error.message);
    await sendMessageWithKeyboard(chatId, 'An error occurred while starting the questionnaire.');
  }
});



// Express router for Bot 2
const bot2Router = express.Router();

bot2Router.get('/status', (req, res) => {
  res.json({ status: 'Bot 2 is running', uptime: process.uptime() });
});

export default bot2Router;
