const { Telegraf } = require('telegraf');
const express = require('express');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// 1. Фиксированные настройки
const WEBHOOK_PATH = '/tg-webhook';
const DOMAIN = 'squezzy00.onrender.com';
const WEBHOOK_URL = `https://${DOMAIN}${WEBHOOK_PATH}`;

// 2. Middleware для парсинга JSON
app.use(express.json()); // Это критически важно!

// 3. Роут для проверки
app.get('/', (req, res) => {
  res.send(`
    <h1>Бот активен</h1>
    <p>Вебхук: <code>${WEBHOOK_PATH}</code></p>
    <p>Отправьте /start в Telegram</p>
  `);
});

// 4. Команды бота
bot.command('start', (ctx) => {
  console.log('Получена команда /start');
  ctx.reply('✅ Бот работает! Попробуйте /5с Тест');
});

bot.command('время', (ctx) => {
  const [_, timeStr, ...messageParts] = ctx.message.text.split(' ');
  const message = messageParts.join(' ');
  
  // Ваша логика таймера...
  ctx.reply(`⏰ Напоминание через ${timeStr}: "${message}"`);
});

// 5. Обработчик вебхука (исправленный)
app.post(WEBHOOK_PATH, (req, res) => {
  if (!req.body) {
    console.error('Пустое тело запроса');
    return res.status(400).end();
  }

  console.log('Входящее обновление:', JSON.stringify(req.body));
  
  bot.handleUpdate(req.body)
    .then(() => res.status(200).end())
    .catch(err => {
      console.error('Ошибка обработки:', err);
      res.status(200).end(); // Всегда возвращаем 200 Telegram
    });
});

// 6. Запуск сервера
const PORT = 10000;
app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  
  try {
    await bot.telegram.deleteWebhook();
    await bot.telegram.setWebhook(WEBHOOK_URL);
    console.log(`✅ Вебхук установлен: ${WEBHOOK_URL}`);
  } catch (err) {
    console.error('❌ Ошибка вебхука:', err);
  }
});
