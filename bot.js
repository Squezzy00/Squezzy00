const { Telegraf } = require('telegraf');
const express = require('express');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const reminders = new Map();

// 1. Настройка вебхука (исправленная версия)
const cleanDomain = (process.env.RENDER_EXTERNAL_URL || 'squezzy00.onrender.com').replace(/^https?:\/\//, '');
const WEBHOOK_PATH = '/tg-webhook';
const WEBHOOK_URL = `https://${cleanDomain}${WEBHOOK_PATH}`;

// 2. Обработчик главной страницы (добавлено)
app.get('/', (req, res) => {
  res.send(`
    <h1>Telegram Reminder Bot</h1>
    <p>Status: <span style="color: green;">Active</span></p>
    <p>Webhook: <code>${WEBHOOK_PATH}</code></p>
    <p>Пример команды: <code>/5с Напомнить позвонить</code></p>
  `);
});

// 3. Команда /время (без изменений)
bot.command('время', (ctx) => {
  const [_, timeStr, ...messageParts] = ctx.message.text.split(' ');
  const message = messageParts.join(' ');

  const timeMatch = timeStr.match(/^(\d+)([смчд])$/);
  if (!timeMatch) return ctx.reply('❌ Формат: /<число><с|м|ч|д> <текст>\nПример: /5с Позвонить маме');

  const [, amount, unit] = timeMatch;
  const units = { 'с': 1000, 'м': 60000, 'ч': 3600000, 'д': 86400000 };
  const ms = amount * (units[unit] || 1000);

  if (reminders.has(ctx.from.id)) {
    clearTimeout(reminders.get(ctx.from.id));
  }

  const timer = setTimeout(() => {
    ctx.reply(`@${ctx.from.username}, напоминание: ${message}`);
    reminders.delete(ctx.from.id);
  }, ms);

  reminders.set(ctx.from.id, timer);
  ctx.reply(`⏰ Напоминание через ${timeStr}: "${message}"`);
});

// 4. Настройка вебхука
app.use(express.json());
app.post(WEBHOOK_PATH, (req, res) => {
  bot.webhookCallback(WEBHOOK_PATH)(req, res)
    .then(() => res.status(200).end())
    .catch(err => {
      console.error('Webhook error:', err);
      res.status(200).end();
    });
});

// 5. Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  
  try {
    await bot.telegram.deleteWebhook();
    await bot.telegram.setWebhook(WEBHOOK_URL);
    console.log(`✅ Вебхук установлен: ${WEBHOOK_URL}`);
  } catch (err) {
    console.error('❌ Ошибка вебхука:', err.message);
  }
});
