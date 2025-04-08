const { Telegraf } = require('telegraf');
const express = require('express');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// 1. Генерация безопасного URL вебхука
const getWebhookUrl = () => {
  const domain = (process.env.RENDER_EXTERNAL_URL || 'squezzy00.onrender.com')
    .replace(/^(https?:\/\/)?/, ''); // Удаляем протокол если есть
  const path = `/webhook-${Math.random().toString(36).slice(2)}`;
  return `https://${domain}${path}`;
};

const WEBHOOK_URL = getWebhookUrl();

// 2. Конфигурация
console.log('⚙️ Конфигурация:');
console.log('BOT_TOKEN:', process.env.BOT_TOKEN ? 'OK' : 'ОШИБКА: не задан');
console.log('WEBHOOK_URL:', WEBHOOK_URL);

// 3. Роут для проверки работы
app.get('/', (req, res) => {
  res.send(`
    <h1>Бот активен!</h1>
    <p>Вебхук: <code>${WEBHOOK_URL}</code></p>
    <p>Статус: ${bot.telegram ? 'Подключен к Telegram' : 'Ошибка подключения'}</p>
  `);
});

// 4. Команды бота
bot.command('start', (ctx) => {
  console.log(`Получен /start от ${ctx.from.id}`);
  ctx.reply('🟢 Бот работает! Команды:\n/ping\n/chatid');
});

bot.command('ping', (ctx) => {
  ctx.reply(`🏓 Pong! Сервер: ${new Date().toISOString()}`);
});

// 5. Настройка вебхука
const setupWebhook = async () => {
  try {
    console.log('\n🔧 Настройка вебхука:');
    console.log('1. Удаление старого вебхука...');
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    
    console.log('2. Установка нового вебхука...');
    await bot.telegram.setWebhook(WEBHOOK_URL, {
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true
    });
    
    console.log('✅ Вебхук установлен');
    return true;
  } catch (err) {
    console.error('❌ Ошибка:', err.description || err.message);
    console.log('Проверьте:');
    console.log(`1. URL: ${WEBHOOK_URL}`);
    console.log('2. Доступность домена');
    console.log('3. Корректность BOT_TOKEN');
    return false;
  }
};

// 6. Регистрация вебхука
app.use(express.json());
app.post(WEBHOOK_URL.split('/').slice(3).join('/'), bot.webhookCallback());

// 7. Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`\n🚀 Сервер запущен на порту ${PORT}`);
  console.log(`🔗 Проверка: https://${WEBHOOK_URL.split('/')[2]}`);
  
  await setupWebhook();
  
  // Проверка связи
  try {
    const me = await bot.telegram.getMe();
    console.log(`🤖 Бот @${me.username} готов к работе`);
    console.log('Отправьте /start в Telegram');
  } catch (err) {
    console.error('❌ Ошибка связи с Telegram:', err.message);
    console.log('Проверьте BOT_TOKEN и доступ к API Telegram');
  }
});

// 8. Обработка ошибок
process.on('unhandledRejection', (err) => {
  console.error('⚠️ Необработанная ошибка:', err.message);
});
