const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();

// Хранилище клавиатур для пользователей
const userKeyboards = new Map();
const bot = new Telegraf(process.env.BOT_TOKEN);

// Команда /test
bot.command('test', (ctx) => {
  ctx.reply('Тестовая команда работает! ✅');
});

// Команда /see - создает клавиатуру
bot.command('see', (ctx) => {
  const buttonsText = ctx.message.text.split(' ').slice(1).join(' ').split(',');
  
  if (buttonsText.length === 0 || buttonsText[0].trim() === '') {
    return ctx.reply('Используйте: /see Кнопка1, Кнопка2, Кнопка3');
  }

  // Сохраняем клавиатуру для пользователя
  const trimmedButtons = buttonsText.map(btn => btn.trim());
  userKeyboards.set(ctx.from.id, trimmedButtons);

  const keyboard = Markup.keyboard(
    trimmedButtons.map(btn => btn)
  )
  .resize()
  .persistent(); // Клавиатура не скрывается после нажатия

  ctx.reply('Клавиатура активирована. Используйте /stop чтобы убрать.', keyboard);
});

// Команда /stop - удаляет клавиатуру
bot.command('stop', (ctx) => {
  userKeyboards.delete(ctx.from.id);
  ctx.reply(
    'Клавиатура удалена',
    Markup.removeKeyboard()
  );
});

// Обработка нажатий кнопок
bot.on('text', (ctx) => {
  if (ctx.message.text.startsWith('/')) return;

  const userButtons = userKeyboards.get(ctx.from.id);
  if (userButtons && userButtons.includes(ctx.message.text)) {
    ctx.reply(`Вы нажали: "${ctx.message.text}"`);
  }
});

// Вебхук для Render
const express = require('express');
const app = express();
app.use(express.json());
app.use(bot.webhookCallback('/'));
bot.telegram.setWebhook(process.env.RENDER_EXTERNAL_URL ? 
  `https://${process.env.RENDER_EXTERNAL_URL}/` : 
  'https://your-render-url.onrender.com/'
);

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Бот запущен на порту ${PORT}`);
});

// Обработка ошибок
process.on('uncaughtException', (err) => {
  console.error('Необработанная ошибка:', err);
});
