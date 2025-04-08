const { Telegraf } = require('telegraf');
const express = require('express');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// Фикс для Render (убираем дублирование https://)
const getWebhookUrl = () => {
  const domain = process.env.RENDER_EXTERNAL_URL || 'squezzy00.onrender.com';
  const cleanDomain = domain.replace(/^https?:\/\//, ''); // Удаляем протокол если есть
  return `https://${cleanDomain}/webhook-${Math.random().toString(36).slice(2)}`;
};

const WEBHOOK_URL = getWebhookUrl();

console.log('=== НАСТРОЙКИ ===');
console.log('BOT_TOKEN:', process.env.BOT_TOKEN ? 'OK' : 'MISSING');
console.log('WEBHOOK_URL:', WEBHOOK_URL);

// Тестовый роут
app.get('/', (req, res) => res.send('Бот активен! Проверьте Telegram.'));

// Команды
bot.command('start', (ctx) => ctx.reply('✅ Бот работает! /ping'));
bot.command('ping', (ctx) => ctx.reply(`🏓 Pong! ${new Date().toLocaleTimeString()}`));

// Вебхук
const setupWebhook = async () => {
  try {
    console.log('[1/3] Удаление старого вебхука...');
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    
    console.log('[2/3] Установка нового:', WEBHOOK_URL);
    await bot.telegram.setWebhook(WEBHOOK_URL);
    
    console.log('[3/3] Вебхук установлен!');
    return true;
  } catch (err) {
    console.error('❌ Ошибка:', err.description || err.message);
    return false;
  }
};

app.use(bot.webhookCallback(WEBHOOK_URL.split('/').pop()));

// Запуск
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`\n🚀 Сервер запущен на порту ${PORT}`);
  await setupWebhook();
  
  // Проверка связи
  try {
    const me = await bot.telegram.getMe();
    console.log(`🤖 Бот @${me.username} готов`);
  } catch (err) {
    console.error('❌ Ошибка Telegram API:', err.message);
  }
});

// Логирование ошибок
process.on('unhandledRejection', (err) => {
  console.error('⚠️ Необработанная ошибка:', err.message);
});
