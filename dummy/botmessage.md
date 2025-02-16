if (stepIndex === 0) {
    message += `<b>${process.title}</b>\n\n`;
    message += `${process.description}\n`;
    message += `<b>Step Description:</b> ${currentStep.description}\n`;

    // Fetch category details
    if (process.processCategory) {
      const category = await ProcessCategories.findById(process.processCategory);
      if (category) {
        message += `${category.name}\n`;
        message += `${category.description || 'No description available'}\n`;
      } else {
        message += `Category: None\n`;
      }
    } else {
      message += `Category: None\n`;
    }
  } else {
    message += `<b>Step Description:</b> ${currentStep.description}\n`;
  }

  // Truncate the message if it is too long
  const maxLength = 1024; // Telegram's maximum caption length
  if (message.length > maxLength) {
    message = message.substring(0, maxLength - 3) + '...';
  }

  if (process.imageUrl) {
    await bot.sendPhoto(chatId, process.imageUrl, { caption: message, parse_mode: "HTML" });
  } else {
    await bot.sendMessage(chatId, message, { parse_mode: "HTML" });
  }