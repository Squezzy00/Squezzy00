const { Telegraf } = require('telegraf');
const express = require('express');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const userTimers = new Map(); // { userId: { timerId: { text, timeout } } }

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
    <p>Активных таймеров: ${Array.from(userTimers.values()).reduce((acc, timers) => acc + Object.keys(timers).length, 0)}</p>
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

// Команда /таймеры
bot.command('таймеры', (ctx) => {
  const userId = ctx.from.id;
  const timers = userTimers.get(userId) || {};

  if (Object.keys(timers).length === 0) {
    return ctx.reply('У вас нет активных напоминаний');
  }

  const timerList = Object.values(timers).map(t => `⏱ ${t.text}`).join('\n');
  ctx.reply(`📋 Ваши напоминания:\n${timerList}`);
});

// Обработчик таймеров
bot.hears(/^\/(\d+)([сmcчhдd])\s(.+)/i, (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username;
  const [, amount, unit, text] = ctx.match;

  // Конвертация в миллисекунды
  const units = {
    'с': 1000, 'c': 1000,
    'м': 60000, 'm': 60000,
    'ч': 3600000, 'h': 3600000,
    'д': 86400000, 'd': 86400000
  };

  if (!units[unit.toLowerCase()]) {
    return ctx.reply('❌ Неверная единица времени (используйте: с, м, ч, д)');
  }

  const ms = amount * units[unit.toLowerCase()];
  const timerId = Date.now(); // Уникальный ID для таймера

  // Инициализация хранилища для пользователя
  if (!userTimers.has(userId)) {
    userTimers.set(userId, {});
  }

  // Создаем таймер
  const timeout = setTimeout(async () => {
    try {
      await ctx.reply(`@${username}, напоминание: ${text}`);
    } catch (err) {
      console.error('Ошибка отправки:', err);
    } finally {
      delete userTimers.get(userId)[timerId];
    }
  }, ms);

  // Сохраняем таймер
  userTimers.get(userId)[timerId] = { text: `${amount}${unit}: ${text}`, timeout };
  ctx.reply(`⏳ Напоминание установлено: "${text}" через ${amount}${unit}`);
});

// Вебхук
app.post(WEBHOOK_PATH, (req, res) => {
  if (!req.body) return res.status(400).end();
  
  bot.handleUpdate(req.body)
    .then(() => res.status(200).end())
    .catch(err => {
      console.error('Ошибка обработки:', err);
      res.status(200).end();
    });
});

// Запуск сервера
const PORT = 10000;
app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  await bot.telegram.deleteWebhook();
  await bot.telegram.setWebhook(WEBHOOK_URL);
  console.log(`✅ Вебхук: ${WEBHOOK_URL}`);
});
