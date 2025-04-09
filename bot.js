const { Telegraf } = require('telegraf');
const express = require('express');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const userTimers = {}; // { userId: { timerId: { text, timeout } } }

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
    <p>Используйте: /5с Текст, /10м Текст, /1ч Текст, /2д Текст</p>
  `);
});

// Команда /start
bot.command('start', (ctx) => {
  ctx.reply(`
⏰ <b>Доступные команды:</b>
/5с Текст - напомнить через 5 секунд
/10м Текст - через 10 минут
/1ч Текст - через 1 час
/2д Текст - через 2 дня
/таймеры - показать активные напоминания
  `, { parse_mode: 'HTML' });
});

// Команда /таймеры (ИСПРАВЛЕННАЯ ВЕРСИЯ)
bot.command('таймеры', (ctx) => {
  const userId = ctx.from.id;
  
  if (!userTimers[userId] || Object.keys(userTimers[userId]).length === 0) {
    return ctx.reply('У вас нет активных напоминаний');
  }

  const timerList = Object.entries(userTimers[userId]).map(([id, timer]) => {
    const timeLeft = Math.ceil((timer.endTime - Date.now()) / 1000);
    const units = { 'с': 'сек', 'м': 'мин', 'ч': 'час', 'д': 'дн' };
    return `⏱ ${timer.text} (осталось: ${timeLeft}${units[timer.unit]})`;
  }).join('\n');

  ctx.reply(`📋 Ваши напоминания:\n${timerList}`);
});

// Обработчик таймеров
bot.hears(/^\/(\d+)([сcмmчhдd])\s(.+)$/i, (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || 'пользователь';
  const [, amount, unit, text] = ctx.match;
  
  // Нормализация единиц времени
  const unitMap = { 'с': 'с', 'c': 'с', 'м': 'м', 'm': 'м', 'ч': 'ч', 'h': 'ч', 'д': 'д', 'd': 'д' };
  const cleanUnit = unitMap[unit.toLowerCase()];

  // Конвертация в миллисекунды
  const ms = {
    'с': amount * 1000,
    'м': amount * 60 * 1000,
    'ч': amount * 60 * 60 * 1000,
    'д': amount * 24 * 60 * 60 * 1000
  }[cleanUnit];

  const timerId = Date.now();
  const endTime = Date.now() + ms;

  // Сохраняем таймер
  if (!userTimers[userId]) userTimers[userId] = {};
  userTimers[userId][timerId] = {
    text,
    timeout: setTimeout(() => {
      ctx.reply(`@${username}, напоминание: ${text}`)
        .catch(console.error);
      delete userTimers[userId][timerId];
    }, ms),
    unit: cleanUnit,
    endTime
  };

  ctx.reply(`⏳ Напоминание установлено через ${amount}${cleanUnit}: "${text}"`);
});

// Вебхук
app.post(WEBHOOK_PATH, (req, res) => {
  if (!req.body) return res.status(400).end();
  bot.handleUpdate(req.body).then(() => res.status(200).end()).catch(() => res.status(200).end());
});

// Запуск сервера
const PORT = 10000;
app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  await bot.telegram.deleteWebhook();
  await bot.telegram.setWebhook(WEBHOOK_URL);
  console.log(`✅ Вебхук: ${WEBHOOK_URL}`);
});
