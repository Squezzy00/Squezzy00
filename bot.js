const { Telegraf } = require('telegraf');
const express = require('express');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// 1. Фиксированные настройки (не меняйте!)
const WEBHOOK_PATH = '/tg-webhook';
const DOMAIN = 'squezzy00.onrender.com'; // Прямо указываем ваш домен
const WEBHOOK_URL = `https://${DOMAIN}${WEBHOOK_PATH}`;

// 2. Минимальный функционал бота
bot.command('start', (ctx) => ctx.reply('✅ Бот жив! /ping'));
bot.command('ping', (ctx) => ctx.reply(`🏓 Pong: ${new Date().toLocaleString()}`));

// 3. Настройка вебхука (упрощенная версия)
const setupWebhook = async () => {
  try {
    await bot.telegram.deleteWebhook();
    await bot.telegram.setWebhook(WEBHOOK_URL);
    console.log(`✅ Вебхук установлен на: ${WEBHOOK_URL}`);
  } catch (err) {
    console.error('❌ Ошибка вебхука:', err.message);
  }
};

// 4. Регистрация вебхука (исправлено!)
app.use(express.json());
app.post(WEBHOOK_PATH, bot.webhookCallback());

// 5. Роут для проверки
app.get('/', (req, res) => {
  res.send(`
    <h1>SigmaBot (@SigmaTG_bot)</h1>
    <p>Статус: <b>активен</b></p>
    <p>Вебхук: <code>${WEBHOOK_PATH}</code></p>
  `);
});

// 6. Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  await setupWebhook();
  
  // Тест связи с Telegram
  try {
    const me = await bot.telegram.getMe();
    console.log(`🤖 Бот @${me.username} готов к работе!`);
    await bot.telegram.sendMessage(me.id, "🔄 Бот перезапущен");
  } catch (err) {
    console.error('❌ Ошибка связи с Telegram:', err.message);
  }
});
