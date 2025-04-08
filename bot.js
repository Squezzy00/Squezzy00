const { Telegraf } = require('telegraf');
const express = require('express');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const activeTimers = new Map();

// 1. Конфигурация
const WEBHOOK_PATH = '/tg-webhook';
const DOMAIN = 'squezzy00.onrender.com';
const WEBHOOK_URL = `https://${DOMAIN}${WEBHOOK_PATH}`;

// 2. Middleware
app.use(express.json());

// 3. Роут для проверки
app.get('/', (req, res) => {
  res.send(`
    <h1>Бот с напоминаниями</h1>
    <p>Активных таймеров: ${activeTimers.size}</p>
    <p>Используйте: /5с Напомнить</p>
  `);
});

// 4. Команда /время (исправленная)
bot.command('время', (ctx) => {
  try {
    const text = ctx.message.text;
    console.log('Обработка команды:', text);
    
    // Разбираем команду (учитываем русскую и английскую "с")
    const match = text.match(/^\/время\s+(\d+)([сcмчд])\s+(.+)/) || 
                 text.match(/^\/(\d+)([сcмчд])\s+(.+)/);
    
    if (!match) throw new Error('Неверный формат. Пример: /5с Позвонить маме');

    const [, amount, unit, message] = match;
    const userKey = ctx.from.id;

    // Конвертируем время в миллисекунды
    const units = { 
      'с': 1000, 'c': 1000, 
      'м': 60000, 
      'ч': 3600000, 
      'д': 86400000 
    };
    const delay = amount * (units[unit] || 1000);

    // Отменяем предыдущий таймер
    if (activeTimers.has(userKey)) {
      clearTimeout(activeTimers.get(userKey));
    }

    // Устанавливаем новый таймер
    const timer = setTimeout(async () => {
      try {
        await ctx.reply(`@${ctx.from.username}, напоминание: ${message}`);
      } catch (err) {
        console.error('Ошибка отправки:', err);
      } finally {
        activeTimers.delete(userKey);
      }
    }, delay);

    activeTimers.set(userKey, timer);
    ctx.reply(`⏰ Напоминание через ${amount}${unit}: "${message}"`);

  } catch (err) {
    console.error('Ошибка:', err.message);
    ctx.reply(`❌ ${err.message}\nПример: /5с Позвонить маме`);
  }
});

// 5. Команда /start
bot.command('start', (ctx) => {
  ctx.reply(`✅ Бот работает!\nПример команды: /5с Напомнить позвонить`);
});

// 6. Обработчик вебхука
app.post(WEBHOOK_PATH, (req, res) => {
  if (!req.body) {
    console.error('Пустое тело запроса');
    return res.status(400).end();
  }

  bot.handleUpdate(req.body)
    .then(() => res.status(200).end())
    .catch(err => {
      console.error('Ошибка:', err);
      res.status(200).end();
    });
});

// 7. Запуск сервера
const PORT = 10000;
app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  
  try {
    await bot.telegram.deleteWebhook();
    await bot.telegram.setWebhook(WEBHOOK_URL);
    console.log(`✅ Вебхук установлен: ${WEBHOOK_URL}`);
  } catch (err) {
    console.error('❌ Ошибка:', err);
  }
});
