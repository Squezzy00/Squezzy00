const { Telegraf } = require('telegraf');
const express = require('express');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const timers = {};

// Конфигурация
const WEBHOOK_PATH = '/tg-webhook';
const DOMAIN = 'squezzy00.onrender.com';
const WEBHOOK_URL = `https://${DOMAIN}${WEBHOOK_PATH}`;

// Middleware
app.use(express.json());

// Роут для проверки
app.get('/', (req, res) => {
  res.send(`
    <h1>Бот с напоминаниями</h1>
    <p>Активных таймеров: ${Object.keys(timers).length}</p>
    <p>Пример: /5 Привет</p>
  `);
});

// Простейшая команда с таймером
bot.command('start', (ctx) => {
  ctx.reply(`⏰ Просто отправьте:\n/5 Напомнить позвонить\nГде 5 - секунды`);
});

bot.command(/(\d+)\s(.+)/, (ctx) => {
  const userId = ctx.from.id;
  const [_, seconds, message] = ctx.match;
  
  // Отменяем предыдущий таймер
  if (timers[userId]) {
    clearTimeout(timers[userId]);
    delete timers[userId];
  }
  
  // Устанавливаем новый (в секундах!)
  timers[userId] = setTimeout(() => {
    ctx.reply(`🔔 Напоминание: ${message}`);
    delete timers[userId];
  }, seconds * 1000);
  
  ctx.reply(`⏳ Напоминание через ${seconds} сек: "${message}"`);
});

// Вебхук
app.post(WEBHOOK_PATH, (req, res) => {
  bot.handleUpdate(req.body)
    .then(() => res.status(200).end())
    .catch(() => res.status(200).end());
});

// Запуск
const PORT = 10000;
app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  await bot.telegram.deleteWebhook();
  await bot.telegram.setWebhook(WEBHOOK_URL);
  console.log(`✅ Вебхук: ${WEBHOOK_URL}`);
});
