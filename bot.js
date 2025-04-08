const { Telegraf } = require('telegraf');
const express = require('express');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const reminders = new Map();

// 1. Фиксированные настройки
const DOMAIN = 'squezzy00.onrender.com'; // Жёстко прописываем домен
const WEBHOOK_PATH = '/tg-webhook';
const WEBHOOK_URL = `https://${DOMAIN}${WEBHOOK_PATH}`;

// 2. Логирование всех входящих запросов
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// 3. Роут для проверки
app.get('/', (req, res) => {
  res.send(`
    <h1>Telegram Reminder Bot</h1>
    <p>Status: <span style="color: green;">Active</span></p>
    <p>Webhook: <code>${WEBHOOK_PATH}</code></p>
    <p>Последняя ошибка: <span id="error"></span></p>
    <script>
      fetch('/status').then(r => r.json()).then(data => {
        document.getElementById('error').textContent = data.lastError || 'нет';
      });
    </script>
  `);
});

// 4. Статус сервера
app.get('/status', (req, res) => {
  res.json({
    lastError: process.env.LAST_ERROR,
    webhookUrl: WEBHOOK_URL
  });
});

// 5. Команда /время (с улучшенной валидацией)
bot.command('время', (ctx) => {
  try {
    const [_, timeStr, ...messageParts] = ctx.message.text.split(' ');
    const message = messageParts.join(' ').trim();
    
    if (!message) throw new Error('Текст напоминания не указан');
    
    const timeMatch = timeStr.match(/^(\d+)([смчд])$/);
    if (!timeMatch) throw new Error('Неверный формат времени');
    
    const [, amount, unit] = timeMatch;
    const units = { 'с': 1000, 'м': 60000, 'ч': 3600000, 'д': 86400000 };
    const ms = amount * (units[unit] || 1000);

    // Отмена предыдущего напоминания
    if (reminders.has(ctx.from.id)) {
      clearTimeout(reminders.get(ctx.from.id));
    }

    // Новое напоминание
    const timer = setTimeout(() => {
      ctx.reply(`@${ctx.from.username}, напоминание: ${message}`)
        .catch(err => console.error('Ошибка отправки:', err));
      reminders.delete(ctx.from.id);
    }, ms);

    reminders.set(ctx.from.id, timer);
    ctx.reply(`⏰ Напоминание через ${timeStr}: "${message}"`);
  } catch (err) {
    ctx.reply(`❌ Ошибка: ${err.message}\nПример: /5с Позвонить маме`);
  }
});

// 6. Вебхук (исправленная версия)
app.post(WEBHOOK_PATH, (req, res) => {
  bot.webhookCallback(WEBHOOK_PATH)(req, res)
    .then(() => res.status(200).end())
    .catch(err => {
      console.error('Webhook error:', err);
      process.env.LAST_ERROR = err.message;
      res.status(200).end(); // Всегда возвращаем 200 для Telegram
    });
});

// 7. Запуск сервера
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
    
    // Проверка связи
    const me = await bot.telegram.getMe();
    console.log(`🤖 Бот @${me.username} готов к работе`);
  } catch (err) {
    console.error('❌ Фатальная ошибка:', err.message);
    process.env.LAST_ERROR = err.message;
  }
});
