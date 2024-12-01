import TelegramBot from 'node-telegram-bot-api';
import OpenAI from 'openai';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import config from '../config/config.js';
import express from 'express';
import translationsData from '../translations/translations.json' assert { type: 'json' };


// Load environment variables
dotenv.config();

// Initialize Telegram Bot and OpenAI API
const bot2Router = express.Router();



// Access the translations object
const translations = translationsData[0].translations;

const getTranslation = (language, key, placeholders = {}) => {
    const translation = translations[language][key] || key;
    return translation.replace(/\{(\w+)\}/g, (_, placeholder) => placeholders[placeholder] || `{${placeholder}}`);
  };
  


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// MongoDB model
const Questionnaire = mongoose.model(
    'Questionnaire',
    new mongoose.Schema({
        title: String,
        description: String,
        language: { type: String, enum: ['EN', 'NO'], default: 'EN' },
        categories: [
            {
                name: String,
                questions: [{ text: String, type: String, options: [String] }],
            },
        ],
    })
);

// User state management
const userState = {};

// Inline keyboards
const systemLanguageKeyboard = {
    inline_keyboard: [
        [{ text: 'English', callback_data: 'lang_EN' }],
        [{ text: 'Norwegian', callback_data: 'lang_NO' }],
    ],
};

const questionnaireLanguageKeyboard = {
    inline_keyboard: [
        [{ text: 'English', callback_data: 'qLang_EN' }],
        [{ text: 'Norwegian', callback_data: 'qLang_NO' }],
    ],
};

const questionTypeKeyboard = {
    inline_keyboard: [
        [{ text: 'TEXT', callback_data: 'type_TEXT' }],
        [{ text: 'YES/NO', callback_data: 'type_YESNO' }],
    ],
};

const navigationKeyboard = {
    inline_keyboard: [
        [{ text: 'Next Category', callback_data: 'next_category' }],
        [{ text: 'Generate Questions', callback_data: 'generate_questions' }],
        [{ text: 'Done', callback_data: 'done' }],
    ],
};

// OpenAI question generation
const generateQuestions = async (topic, category, language, numQuestions = 3) => {
    console.log(`[DEBUG] generateQuestions called with language: ${language}`);
    const promptTemplate = getTranslation(language, 'generatePrompt', {
      numQuestions,
      topic,
      category,
    });
  
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: promptTemplate }],
      });
  
      return completion.choices[0].message.content
        .split('\n')
        .filter((line) => line.trim() && !isNaN(line.trim()[0]))
        .map((line) => line.replace(/^\d+\.\s*/, '').trim());
    } catch (error) {
      console.error('Error generating questions:', error.message);
      return [];
    }
  };
  

const TELEGRAM_BOT2_TOKEN = config.NODE_ENV === 'production'
    ? process.env.TELEGRAM_BOT2_TOKEN_PROD
    : process.env.TELEGRAM_BOT2_TOKEN_DEV;

if (!TELEGRAM_BOT2_TOKEN) {
    console.error('Error: Telegram Bot 2 token is not set.');
    process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_BOT2_TOKEN, { polling: true });

// Start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    userState[chatId] = { systemLanguage: 'EN', step: 'selectSystemLanguage' };
    await bot.sendMessage(chatId, 'Please select your preferred language:', { reply_markup: systemLanguageKeyboard });
});

// Handle callback queries
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    userState[chatId] = { systemLanguage: 'EN', step: 'selectSystemLanguage' };
    await bot.sendMessage(
        chatId,
        getTranslation('EN', 'Please select your preferred language:'),
        { reply_markup: systemLanguageKeyboard }
    );
});

bot.on('callback_query', async (callbackQuery) => {
    const { data, message } = callbackQuery;
    const chatId = message.chat.id;
    const state = userState[chatId];

    if (!state) {
        await bot.sendMessage(chatId, getTranslation('EN', 'errorOccurred'));
        return;
    }

    const userLang = state.systemLanguage;

    switch (data) {
        case 'lang_EN':
        case 'lang_NO': {
            const selectedLanguage = data.split('_')[1];
            state.systemLanguage = selectedLanguage;

            console.log(`[DEBUG] Updated systemLanguage for chat ${chatId}: ${state.systemLanguage}`);

            await bot.sendMessage(
                chatId,
                getTranslation(selectedLanguage, 'systemLanguageSet', { language: selectedLanguage === 'EN' ? 'English' : 'Norwegian' })
            );

            state.step = 'title';
            await bot.sendMessage(chatId, getTranslation(selectedLanguage, 'questionnaireTitle'));
            break;
        }

        case 'qLang_EN':
        case 'qLang_NO': {
            const selectedQuestionnaireLanguage = data.split('_')[1];
            state.questionnaireLanguage = selectedQuestionnaireLanguage;
            state.step = 'categories';

            await bot.sendMessage(
                chatId,
                getTranslation(userLang, 'selectQuestionnaireLanguage')
            );
            await bot.sendMessage(chatId, getTranslation(userLang, 'numberOfCategories'));
            break;
        }

        case 'type_TEXT':
        case 'type_YESNO': {
            const type = data.split('_')[1];
            const currentCategory = state.questionnaire.categories[state.currentCategoryIndex];
            const currentQuestion = state.currentQuestion;
            currentQuestion.type = type;
            currentCategory.questions.push(currentQuestion);
            state.currentQuestion = null;

            await bot.sendMessage(chatId, getTranslation(userLang, 'questionAdded'), {
                reply_markup: navigationKeyboard,
            });
            break;
        }

        case 'generate_questions': {
            const category = state.questionnaire.categories[state.currentCategoryIndex];
          
            // Generate questions
            const generatedQuestions = await generateQuestions(
              state.questionnaire.title,
              category.name,
              state.systemLanguage,
              3 // Number of questions
            );
          
            // Store generated questions in state
            state.generatedQuestions = generatedQuestions.map((question, index) => ({
              text: question,
              index,
              confirmed: false,
            }));
          
            // Send the first question to the user for review
            const firstQuestion = state.generatedQuestions[0];
            await bot.sendMessage(chatId, `Suggested question:\n\n${firstQuestion.text}`, {
              reply_markup: {
                inline_keyboard: [
                  [{ text: 'Edit', callback_data: `edit_question_${firstQuestion.index}` }],
                  [{ text: 'Confirm', callback_data: `confirm_question_${firstQuestion.index}` }],
                ],
              },
            });
            break;
          }
          
          case data.startsWith('edit_question_') && data: {
            const questionIndex = parseInt(data.split('_')[2], 10);
            const questionToEdit = state.generatedQuestions[questionIndex];
          
            // Save the current editing state
            state.currentEditingQuestion = questionIndex;
          
            await bot.sendMessage(chatId, `Edit the question:\n\n${questionToEdit.text}`);
            break;
          }
          
          case data.startsWith('confirm_question_') && data: {
            const questionIndex = parseInt(data.split('_')[2], 10);
            state.generatedQuestions[questionIndex].confirmed = true;
          
            // Check if there are more questions to review
            const nextQuestion = state.generatedQuestions.find((q) => !q.confirmed);
            if (nextQuestion) {
              await bot.sendMessage(chatId, `Suggested question:\n\n${nextQuestion.text}`, {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: 'Edit', callback_data: `edit_question_${nextQuestion.index}` }],
                    [{ text: 'Confirm', callback_data: `confirm_question_${nextQuestion.index}` }],
                  ],
                },
              });
            } else {
              // All questions reviewed
              category.questions.push(...state.generatedQuestions.map((q) => ({ text: q.text, type: 'TEXT' })));
              delete state.generatedQuestions;
          
              await bot.sendMessage(chatId, 'All questions have been reviewed and added to the questionnaire.', {
                reply_markup: generateKeyboard(state.systemLanguage, 'navigation'),
              });
            }
            break;
          }
          
          case 'editing_question': {
            const questionIndex = state.currentEditingQuestion;
          
            // Update the question text
            state.generatedQuestions[questionIndex].text = msg.text;
          
            // Clear the current editing state
            delete state.currentEditingQuestion;
          
            await bot.sendMessage(chatId, 'The question has been updated.', {
              reply_markup: {
                inline_keyboard: [
                  [{ text: 'Edit', callback_data: `edit_question_${questionIndex}` }],
                  [{ text: 'Confirm', callback_data: `confirm_question_${questionIndex}` }],
                ],
              },
            });
            break;
          }
          

        case 'next_category': {
            const nextCategoryIndex = state.currentCategoryIndex + 1;
            if (nextCategoryIndex < state.questionnaire.categories.length) {
                state.currentCategoryIndex = nextCategoryIndex;

                await bot.sendMessage(
                    chatId,
                    getTranslation(userLang, 'categoryNamePrompt', { index: nextCategoryIndex + 1 })
                );
                await bot.sendMessage(
                    chatId,
                    getTranslation(userLang, 'enterFirstQuestion', { categoryName: state.questionnaire.categories[nextCategoryIndex].name })
                );
            } else {
                await bot.sendMessage(chatId, getTranslation(userLang, 'completedAllCategories'));
            }
            break;
        }

        case 'done':
            await Questionnaire.create(state.questionnaire);
            delete userState[chatId];
            await bot.sendMessage(chatId, getTranslation(userLang, 'questionnaireSaved'));
            break;

        default:
            await bot.sendMessage(chatId, getTranslation(userLang, 'invalidAction'));
    }

    await bot.answerCallbackQuery(callbackQuery.id);
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const state = userState[chatId];

    if (!state) return;

    const userLang = state.systemLanguage;

    try {
        switch (state.step) {
            case 'title':
                state.questionnaire = { title: msg.text, description: '', categories: [] };
                state.step = 'description';
                await bot.sendMessage(chatId, getTranslation(userLang, 'questionnaireDescription'));
                break;

            case 'description':
                state.questionnaire.description = msg.text;
                state.step = 'questionnaireLanguage';
                await bot.sendMessage(chatId, getTranslation(userLang, 'selectQuestionnaireLanguage'), {
                    reply_markup: questionnaireLanguageKeyboard,
                });
                break;

            case 'categories':
                const numCategories = parseInt(msg.text, 10);
                if (isNaN(numCategories) || numCategories <= 0) {
                    await bot.sendMessage(chatId, getTranslation(userLang, 'invalidAction'));
                    return;
                }
                state.numCategories = numCategories;
                state.currentCategoryIndex = 0;
                state.step = 'categoryName';
                await bot.sendMessage(chatId, getTranslation(userLang, 'categoryNamePrompt', { index: 1 }));
                break;

            case 'categoryName':
                state.questionnaire.categories.push({ name: msg.text, questions: [] });
                if (state.questionnaire.categories.length < state.numCategories) {
                    await bot.sendMessage(chatId, getTranslation(userLang, 'categoryNamePrompt', { index: state.questionnaire.categories.length + 1 }));
                } else {
                    state.step = 'questions';
                    await bot.sendMessage(chatId, getTranslation(userLang, 'enterFirstQuestion', { categoryName: state.questionnaire.categories[0].name }));
                }
                break;

            case 'questions':
                state.currentQuestion = { text: msg.text, type: '' };
                await bot.sendMessage(chatId, getTranslation(userLang, 'questionTypePrompt'), { reply_markup: questionTypeKeyboard });
                break;

            default:
                await bot.sendMessage(chatId, getTranslation(userLang, 'errorOccurred'));
        }
    } catch (error) {
        console.error('Error processing message:', error.message);
        await bot.sendMessage(chatId, getTranslation(userLang, 'errorOccurred'));
    }
});

export default bot2Router;
