const { Telegraf } = require('telegraf');
const express = require('express');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const userTimers = new Map(); // Храним таймеры по ID пользователя

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
    <p>Активных таймеров: ${Array.from(userTimers.values()).flat().length}</p>
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
  const timers = userTimers.get(userId) || [];
  
  if (timers.length === 0) {
    return ctx.reply('У вас нет активных напоминаний');
  }
  
  ctx.reply(`⏱ Ваши активные напоминания: ${timers.length}`);
});

// Обработчик таймеров
bot.hears(/^\/(\d+)([сmcчhдd])\s(.+)/i, (ctx) => {
  const userId = ctx.from.id;
  const [, amount, unit, text] = ctx.match;
  
  // Конвертация в миллисекунды
  let milliseconds;
  switch (unit.toLowerCase()) {
    case 'с': case 'c': milliseconds = amount * 1000; break;
    case 'м': case 'm': milliseconds = amount * 60000; break;
    case 'ч': case 'h': milliseconds = amount * 3600000; break;
    case 'д': case 'd': milliseconds = amount * 86400000; break;
    default: return ctx.reply('❌ Неверная единица времени');
  }

  // Инициализация массива таймеров для пользователя
  if (!userTimers.has(userId)) {
    userTimers.set(userId, []);
  }

  // Создаем новый таймер
  const timer = setTimeout(() => {
    ctx.reply(`🔔 Напоминание: ${text}`);
    
    // Удаляем таймер из хранилища
    const userTimersList = userTimers.get(userId);
    const index = userTimersList.indexOf(timer);
    if (index !== -1) {
      userTimersList.splice(index, 1);
    }
  }, milliseconds);

  // Сохраняем таймер
  userTimers.get(userId).push(timer);
  
  ctx.reply(`⏳ Установлено напоминание через ${amount}${unit}: "${text}"`);
});

// Вебхук
app.post(WEBHOOK_PATH, (req, res) => {
  if (!req.body) return res.status(400).end();
  
  bot.handleUpdate(req.body)
    .then(() => res.status(200).end())
    .catch(() => res.status(200).end());
});

// Запуск сервера
const PORT = 10000;
app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  await bot.telegram.deleteWebhook();
  await bot.telegram.setWebhook(WEBHOOK_URL);
  console.log(`✅ Вебхук: ${WEBHOOK_URL}`);
});
