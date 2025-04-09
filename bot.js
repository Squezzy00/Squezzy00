const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// Конфигурация вебхука
const WEBHOOK_PATH = '/tg-webhook';
const DOMAIN = process.env.RENDER_EXTERNAL_URL || 'your-render-service.onrender.com';
const WEBHOOK_URL = `https://${DOMAIN.replace(/^https?:\/\//, '')}${WEBHOOK_PATH}`;

// Подключение к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Создание таблиц
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_keyboards (
      user_id BIGINT PRIMARY KEY,
      buttons TEXT[] NOT NULL DEFAULT '{}'
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_keyboards (
      chat_id BIGINT PRIMARY KEY,
      buttons TEXT[] NOT NULL DEFAULT '{}'
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reminders (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      username TEXT,
      text TEXT NOT NULL,
      end_time BIGINT NOT NULL,
      unit TEXT NOT NULL
    )
  `);
  console.log('✅ Таблицы БД готовы');
})();

// Хранилище временных клавиатур
const activeKeyboards = new Map();

// Команда /start
bot.command('start', (ctx) => {
  ctx.replyWithHTML(`
👋 <b>Привет, ${ctx.from.first_name}!</b>

Этот бот позволяет:
- Создавать персональные клавиатуры (/set)
- Устанавливать напоминания (/5с, /10м и т.д.)
- Настраивать клавиатуры для чатов (для админов)

📌 Используйте <code>/help</code> для списка команд

Разработчик: @squezzy00
  `);
});

// Команда /help
bot.command('help', (ctx) => {
  ctx.replyWithHTML(`
<b>📋 Список команд:</b>

<b>Клавиатуры:</b>
/set кнопка1,кнопка2 - установить свою клавиатуру
/see кнопка1,кнопка2 - временная клавиатура
/open - показать свою клавиатуру
/stop - убрать клавиатуру
/del all - удалить ВСЕ свои кнопки
/del Кнопка - удалить конкретную кнопку
/cfg кнопка1,кнопка2 - установить клавиатуру чата (для админов)

<b>Напоминания:</b>
/5с Текст - напомнить через 5 секунд
/10м Текст - через 10 минут
/1ч Текст - через 1 час
/2д Текст - через 2 дня
/таймеры - показать активные напоминания

Разработчик: @squezzy00
  `);
});

// Команда /del
bot.command('del', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length === 0) {
    return ctx.reply('Используйте: /del all или /del Кнопка');
  }

  const userId = ctx.from.id;
  const toDelete = args.join(' ').trim();

  try {
    const result = await pool.query('SELECT buttons FROM user_keyboards WHERE user_id = $1', [userId]);
    
    if (result.rows.length === 0 || result.rows[0].buttons.length === 0) {
      return ctx.reply('У вас нет сохраненных кнопок');
    }

    let buttons = result.rows[0].buttons;
    
    if (toDelete.toLowerCase() === 'all') {
      buttons = [];
    } else {
      buttons = buttons.filter(btn => btn !== toDelete);
      
      if (buttons.length === result.rows[0].buttons.length) {
        return ctx.reply('Кнопка не найдена');
      }
    }

    await pool.query(
      'UPDATE user_keyboards SET buttons = $1 WHERE user_id = $2',
      [buttons, userId]
    );

    ctx.reply(toDelete === 'all' ? '✅ Все кнопки удалены' : `✅ Кнопка "${toDelete}" удалена`);
  } catch (err) {
    console.error('Ошибка /del:', err);
    ctx.reply('❌ Ошибка удаления');
  }
});

// Остальные команды (таймеры, клавиатуры) остаются без изменений, 
// но УБИРАЕМ обработчик нажатий кнопок (bot.on('text')) полностью

// Вебхук
app.use(express.json());
app.post(WEBHOOK_PATH, (req, res) => {
  bot.handleUpdate(req.body, res).catch(err => {
    console.error('Webhook error:', err);
    res.status(200).end();
  });
});

// Обработчик главной страницы
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Telegram Bot Status</title>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        h1 { color: #0088cc; }
        .status { font-size: 1.2em; margin: 20px 0; }
      </style>
    </head>
    <body>
      <h1>🤖 Telegram Bot</h1>
      <div class="status">Бот работает и готов к работе!</div>
      <div>Webhook: <code>${WEBHOOK_URL}</code></div>
    </body>
    </html>
  `);
});

// Запуск сервера
const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  try {
    await bot.telegram.deleteWebhook();
    await bot.telegram.setWebhook(WEBHOOK_URL);
    console.log(`✅ Вебхук установлен: ${WEBHOOK_URL}`);
  } catch (err) {
    console.error('❌ Ошибка вебхука:', err);
    process.exit(1);
  }
});
