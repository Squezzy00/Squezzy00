const { Telegraf } = require('telegraf');
const express = require('express');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// 1. Фиксированные настройки вебхука
const WEBHOOK_PATH = '/tg-webhook';
const DOMAIN = 'squezzy00.onrender.com'; // Ваш реальный домен
const WEBHOOK_URL = `https://${DOMAIN}${WEBHOOK_PATH}`;

// 2. Минимальный функционал бота
bot.command('start', (ctx) => {
  console.log(`[CMD] /start от ${ctx.from.id}`);
  ctx.reply('✅ Бот работает!');
});

// 3. Правильная регистрация вебхука
app.use(express.json());
app.post(WEBHOOK_PATH, (req, res) => {
  console.log('[WEBHOOK] Получен запрос');
  bot.webhookCallback(WEBHOOK_PATH)(req, res)
    .then(() => res.status(200).end())
    .catch(err => {
      console.error('Ошибка обработки:', err);
      res.status(200).end(); // Всегда возвращаем 200 Telegram
    });
});

// 4. Роут для проверки
app.get('/', (req, res) => {
  res.send(`
    <h1>Бот активен</h1>
    <p>Вебхук: <code>${WEBHOOK_PATH}</code></p>
    <p>Ошибок: ${process.env.LAST_ERROR || 'нет'}</p>
  `);
});

// 5. Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  
  try {
    // Принудительный сброс вебхука
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await bot.telegram.setWebhook(WEBHOOK_URL, {
      allowed_updates: ['message'],
      drop_pending_updates: true
    });
    
    console.log(`✅ Вебхук установлен: ${WEBHOOK_URL}`);
    const me = await bot.telegram.getMe();
    console.log(`🤖 Бот @${me.username} готов`);
  } catch (err) {
    console.error('❌ Ошибка инициализации:', err.message);
    process.env.LAST_ERROR = err.message;
  }
});
