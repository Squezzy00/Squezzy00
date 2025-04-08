const { Telegraf } = require('telegraf');
const express = require('express');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// Хранилище активных таймеров
const reminders = new Map();

// Обработчик команды /время
bot.command('время', (ctx) => {
  const [_, timeStr, ...messageParts] = ctx.message.text.split(' ');
  const message = messageParts.join(' ');

  // Парсим время
  const timeMatch = timeStr.match(/^(\d+)([смчд])$/);
  if (!timeMatch) {
    return ctx.reply('❌ Формат: /<время><единица> <напоминание>\nПример: /5с Позвонить маме');
  }

  const [, amount, unit] = timeMatch;
  let milliseconds;

  switch(unit) {
    case 'с': milliseconds = amount * 1000; break;
    case 'м': milliseconds = amount * 1000 * 60; break;
    case 'ч': milliseconds = amount * 1000 * 60 * 60; break;
    case 'д': milliseconds = amount * 1000 * 60 * 60 * 24; break;
    default: return ctx.reply('❌ Неверная единица времени (используйте с, м, ч или д)');
  }

  // Создаем таймер
  const timerId = setTimeout(() => {
    ctx.reply(`@${ctx.from.username}, напоминание: ${message}`);
    reminders.delete(ctx.from.id);
  }, milliseconds);

  // Сохраняем таймер
  reminders.set(ctx.from.id, timerId);
  ctx.reply(`⏰ Напоминание установлено на ${timeStr}!`);
});

// Отмена всех напоминаний
bot.command('отмена', (ctx) => {
  if (reminders.has(ctx.from.id)) {
    clearTimeout(reminders.get(ctx.from.id));
    reminders.delete(ctx.from.id);
    ctx.reply('❌ Все напоминания отменены');
  } else {
    ctx.reply('⚠️ У вас нет активных напоминаний');
  }
});

// Вебхук и запуск сервера (остальной код без изменений)
const WEBHOOK_PATH = '/tg-webhook';
app.use(express.json());
app.post(WEBHOOK_PATH, bot.webhookCallback());
app.get('/', (req, res) => res.send('Бот с напоминаниями активен!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  bot.telegram.setWebhook(`https://${process.env.RENDER_EXTERNAL_URL || 'squezzy00.onrender.com'}${WEBHOOK_PATH}`)
    .then(() => console.log('✅ Вебхук установлен'))
    .catch(console.error);
});
