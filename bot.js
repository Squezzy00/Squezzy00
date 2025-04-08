const { Telegraf } = require('telegraf');
const express = require('express');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// Конфигурация вебхука (главный секрет!)
const WEBHOOK_PATH = '/secret-webhook-' + Math.random().toString(36).slice(2);
const WEBHOOK_URL = `https://${process.env.RENDER_EXTERNAL_URL || 'squezzy00.onrender.com'}${WEBHOOK_PATH}`;

// Проверка конфигурации
console.log('=== НАСТРОЙКИ ===');
console.log('WEBHOOK_URL:', WEBHOOK_URL);
console.log('BOT_TOKEN:', process.env.BOT_TOKEN ? 'OK' : 'ОШИБКА: не задан');

// Роут для проверки
app.get('/', (req, res) => {
  res.send('Бот активен! Вебхук: ' + WEBHOOK_PATH);
});

// Команды бота
bot.command('start', (ctx) => {
  console.log('Получена команда /start от', ctx.from.id);
  ctx.reply('🚀 Бот работает! Попробуйте /ping');
});

bot.command('ping', (ctx) => {
  ctx.reply('🏓 Pong! ' + new Date().toLocaleTimeString());
});

// Настройка вебхука (исправленная версия)
const setupWebhook = async () => {
  try {
    console.log('\n[1/3] Сбрасываю старый вебхук...');
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    
    console.log('[2/3] Устанавливаю новый вебхук...');
    await bot.telegram.setWebhook(WEBHOOK_URL, {
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true
    });
    
    console.log('[3/3] Вебхук установлен на:', WEBHOOK_URL);
    return true;
  } catch (err) {
    console.error('❌ Ошибка вебхука:', err.description || err.message);
    return false;
  }
};

// Регистрация обработчика
app.use(bot.webhookCallback(WEBHOOK_PATH));

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`\n🌐 Сервер запущен на порту ${PORT}`);
  
  // Проверка связи с Telegram
  try {
    const me = await bot.telegram.getMe();
    console.log(`🤖 Бот @${me.username} готов к работе!`);
    
    // Установка вебхука
    await setupWebhook();
  } catch (err) {
    console.error('❌ Фатальная ошибка:', err.message);
    process.exit(1);
  }
});

// Логирование всех ошибок
process.on('unhandledRejection', (err) => {
  console.error('⚠️ Необработанная ошибка:', err.message);
});
