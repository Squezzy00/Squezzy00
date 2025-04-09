const { Telegraf } = require('telegraf');
const express = require('express');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const userTimers = new Map(); // { userId: { timerId: { text, timeout, unit } } }

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

// Команда /таймеры
bot.command('таймеры', (ctx) => {
  const userId = ctx.from.id;
  const timers = userTimers.get(userId) || {};

  if (Object.keys(timers).length === 0) {
    return ctx.reply('У вас нет активных напоминаний');
  }

  const timerList = Object.values(timers).map(t => 
    `⏱ ${t.text} (через ${t.timeLeft}${t.unit})`
  ).join('\n');
  
  ctx.reply(`📋 Ваши напоминания:\n${timerList}`);
});

// Обработчик таймеров
bot.hears(/^\/(\d+)([сcмmчhдd])\s(.+)$/i, (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || 'пользователь';
  const [, amount, unit, text] = ctx.match;
  
  // Определяем единицы времени
  const unitMap = {
    'с': 'с', 'c': 'с',
    'м': 'м', 'm': 'м',
    'ч': 'ч', 'h': 'ч',
    'д': 'д', 'd': 'д'
  };
  
  const cleanUnit = unitMap[unit.toLowerCase()];
  if (!cleanUnit) {
    return ctx.reply('❌ Неверная единица времени (используйте: с, м, ч, д)');
  }

  // Конвертация в миллисекунды
  const timeInMs = {
    'с': amount * 1000,
    'м': amount * 60 * 1000,
    'ч': amount * 60 * 60 * 1000,
    'д': amount * 24 * 60 * 60 * 1000
  }[cleanUnit];

  const timerId = Date.now(); // Уникальный ID таймера

  // Инициализация хранилища
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
  }, timeInMs);

  // Сохраняем таймер
  userTimers.get(userId)[timerId] = {
    text,
    timeout,
    unit: cleanUnit,
    timeLeft: amount,
    startTime: Date.now()
  };

  ctx.reply(`⏳ Напоминание установлено через ${amount}${cleanUnit}: "${text}"`);
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
