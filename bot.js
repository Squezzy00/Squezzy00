const { Telegraf } = require('telegraf');
const express = require('express');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const activeTimers = new Map();

// 1. Жёстко прописываем конфигурацию (убираем все переменные окружения)
const WEBHOOK_PATH = '/tg-webhook';
const DOMAIN = 'squezzy00.onrender.com'; // Ваш реальный домен
const WEBHOOK_URL = `https://${DOMAIN}${WEBHOOK_PATH}`;

// 2. Улучшенное логирование
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, req.body);
  next();
});

// 3. Роут для проверки с детальным статусом
app.get('/', (req, res) => {
  res.send(`
    <h1>Telegram Reminder Bot</h1>
    <p>Webhook URL: <code>${WEBHOOK_URL}</code></p>
    <p>Active timers: ${activeTimers.size}</p>
    <p>Last update: ${new Date().toLocaleString()}</p>
  `);
});

// 4. Команда /время с полным логгированием
bot.command('время', (ctx) => {
  try {
    console.log('Получена команда:', ctx.message.text);
    
    const [_, timeStr, ...messageParts] = ctx.message.text.split(' ');
    const message = messageParts.join(' ').trim();
    
    if (!message) throw new Error('Пустое напоминание');
    
    const timeMatch = timeStr.match(/^(\d+)([смчд])$/);
    if (!timeMatch) throw new Error('Неверный формат времени. Пример: /5с Напомнить');
    
    const [, amount, unit] = timeMatch;
    const units = { 'с': 1000, 'м': 60000, 'ч': 3600000, 'д': 86400000 };
    const ms = amount * (units[unit] || 1000);

    // Отмена предыдущего таймера
    if (activeTimers.has(ctx.from.id)) {
      clearTimeout(activeTimers.get(ctx.from.id));
      console.log(`Отменён предыдущий таймер для ${ctx.from.id}`);
    }

    // Устанавливаем новый таймер
    const timer = setTimeout(async () => {
      try {
        await ctx.reply(`@${ctx.from.username}, напоминание: ${message}`);
        activeTimers.delete(ctx.from.id);
      } catch (err) {
        console.error('Ошибка отправки напоминания:', err);
      }
    }, ms);

    activeTimers.set(ctx.from.id, timer);
    ctx.reply(`⏰ Установлено напоминание через ${timeStr}: "${message}"`);
    console.log(`Новый таймер для ${ctx.from.id} на ${timeStr}`);
    
  } catch (err) {
    console.error('Ошибка обработки команды:', err);
    ctx.reply(`❌ Ошибка: ${err.message}`);
  }
});

// 5. Обработчик вебхука с улучшенной диагностикой
app.post(WEBHOOK_PATH, async (req, res) => {
  try {
    console.log('Входящее обновление:', JSON.stringify(req.body, null, 2));
    await bot.handleUpdate(req.body);
    res.status(200).end();
  } catch (err) {
    console.error('Ошибка обработки вебхука:', err);
    res.status(200).end(); // Всегда возвращаем 200 для Telegram
  }
});

// 6. Запуск сервера с полной диагностикой
const PORT = 10000; // Жёстко указываем порт
app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  
  try {
    // Принудительный сброс вебхука
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.log('Старый вебхук удалён');
    
    await bot.telegram.setWebhook(WEBHOOK_URL, {
      allowed_updates: ['message'],
      drop_pending_updates: true
    });
    console.log(`✅ Вебхук установлен: ${WEBHOOK_URL}`);
    
    // Проверка связи с Telegram API
    const me = await bot.telegram.getMe();
    console.log(`🤖 Бот @${me.username} готов к работе`);
    console.log(`🔄 Проверка: https://${DOMAIN}`);
    
  } catch (err) {
    console.error('❌ Критическая ошибка инициализации:', err);
    process.exit(1);
  }
});
