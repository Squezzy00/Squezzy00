const { Telegraf } = require('telegraf');
const express = require('express');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// Проверка переменных окружения
console.log('Проверка конфигурации:');
console.log('BOT_TOKEN:', process.env.BOT_TOKEN ? 'установлен' : 'ОШИБКА: не задан');
console.log('PORT:', process.env.PORT || 3000);

// Обработчик для корневого URL (чтобы Render не показывал ошибку)
app.get('/', (req, res) => {
  res.status(200).send('Телеграм-бот активен. Используйте Telegram для взаимодействия.');
});

// Простые команды для теста
bot.command('start', (ctx) => ctx.reply('🚀 Бот работает корректно!'));
bot.command('ping', (ctx) => ctx.reply('🏓 Pong!'));
bot.command('info', (ctx) => ctx.reply(`Сервер: ${process.env.RENDER_EXTERNAL_URL || 'локальный'}`));

// Настройка вебхука
const initWebhook = async () => {
  try {
    const webhookUrl = `https://${process.env.RENDER_EXTERNAL_URL || 'squezzy00.onrender.com'}/telegram-webhook`;
    await bot.telegram.deleteWebhook(); // Сначала сбрасываем старый вебхук
    await bot.telegram.setWebhook(webhookUrl);
    console.log(`✅ Вебхук установлен: ${webhookUrl}`);
  } catch (err) {
    console.error('❌ Ошибка вебхука:', err.message);
  }
};

// Регистрация вебхука
app.use(bot.webhookCallback('/telegram-webhook'));

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🌐 Сервер запущен на порту ${PORT}`);
  await initWebhook(); // Инициализация вебхука после старта сервера
});

// Обработка ошибок
process.on('unhandledRejection', (err) => {
  console.error('⚠ Необработанная ошибка:', err);
});
