const { Telegraf } = require('telegraf');
const express = require('express');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// 1. Конфигурация (фиксированные значения)
const WEBHOOK_PATH = '/tg-webhook';
const DOMAIN = 'squezzy00.onrender.com';
const WEBHOOK_URL = `https://${DOMAIN}${WEBHOOK_PATH}`;

// 2. Минимальные команды
bot.command('start', (ctx) => ctx.reply('🟢 Бот работает! /ping'));
bot.command('ping', (ctx) => ctx.reply(`🏓 Pong: ${Date.now()}`));

// 3. Настройка вебхука
const setupWebhook = async () => {
  try {
    await bot.telegram.deleteWebhook();
    await bot.telegram.setWebhook(WEBHOOK_URL);
    console.log(`✅ Вебхук: ${WEBHOOK_URL}`);
  } catch (err) {
    console.error('❌ Ошибка вебхука:', err.message);
  }
};

// 4. Регистрация обработчика
app.use(express.json());
app.post(WEBHOOK_PATH, bot.webhookCallback());

// 5. Роут для проверки
app.get('/', (req, res) => {
  res.send(`
    <h1>@SigmaTG_bot</h1>
    <p>Status: <span style="color:green">ACTIVE</span></p>
    <p>Webhook: <code>${WEBHOOK_PATH}</code></p>
  `);
});

// 6. Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Server started on port ${PORT}`);
  await setupWebhook();
  
  // Проверка без отправки сообщений
  try {
    const me = await bot.telegram.getMe();
    console.log(`🤖 Bot ready: @${me.username}`);
  } catch (err) {
    console.error('Telegram connection error:', err.message);
  }
});
