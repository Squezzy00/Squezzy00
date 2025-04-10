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
  try {
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
  } catch (err) {
    console.error('❌ Ошибка создания таблиц:', err);
    process.exit(1);
  }
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
/timer - показать активные напоминания

Разработчик: @squezzy00
  `);
});

// Команда /set
bot.command('set', async (ctx) => {
  const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',').map(b => b.trim());
  
  if (buttons.length === 0 || buttons[0] === '') {
    return ctx.reply('Используйте: /set Кнопка1, Кнопка2');
  }

  try {
    await pool.query(
      `INSERT INTO user_keyboards (user_id, buttons) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET buttons = $2`,
      [ctx.from.id, buttons]
    );
    
    // Отправляем клавиатуру только вызывающему пользователю
    await ctx.replyWithMarkdown(
      `✅ *Постоянная клавиатура сохранена!*\nИспользуйте /open\n\n` +
      `Разработчик: @squezzy00`,
      Markup.keyboard(buttons)
        .resize()
        .persistent() // Клавиатура остается до явного закрытия
        .selective() // Только для этого пользователя
    );
  } catch (err) {
    console.error('Ошибка /set:', err);
    ctx.reply('❌ Ошибка сохранения');
  }
});

// Команда /see
bot.command('see', (ctx) => {
  const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',').map(b => b.trim());
  
  if (buttons.length === 0 || buttons[0] === '') {
    return ctx.reply('Используйте: /see Кнопка1, Кнопка2');
  }

  activeKeyboards.set(ctx.from.id, buttons);
  
  // Отправляем клавиатуру только вызывающему пользователю
  ctx.replyWithMarkdown(
    `⌛ *Временная клавиатура активирована*\nИспользуйте /stop для удаления\n\n` +
    `Разработчик: @squezzy00`,
    Markup.keyboard(buttons)
      .resize()
      .persistent() // Клавиатура остается до явного закрытия
      .selective() // Только для этого пользователя
  );
});

// Команда /open
bot.command('open', async (ctx) => {
  try {
    // 1. Проверка временной клавиатуры
    if (activeKeyboards.has(ctx.from.id)) {
      const buttons = activeKeyboards.get(ctx.from.id);
      return ctx.replyWithMarkdown(
        `⌛ *Временная клавиатура*\n\nРазработчик: @squezzy00`,
        Markup.keyboard(buttons)
          .resize()
          .persistent() // Клавиатура остается до явного закрытия
          .selective() // Только для этого пользователя
      );
    }

    // 2. Проверка личной клавиатуры
    const userKb = await pool.query('SELECT buttons FROM user_keyboards WHERE user_id = $1', [ctx.from.id]);
    if (userKb.rows.length > 0) {
      return ctx.replyWithMarkdown(
        `✅ *Ваша клавиатура*\n\nРазработчик: @squezzy00`,
        Markup.keyboard(userKb.rows[0].buttons)
          .resize()
          .persistent() // Клавиатура остается до явного закрытия
          .selective() // Только для этого пользователя
      );
    }

    // 3. Проверка клавиатуры чата
    if (ctx.chat.type !== 'private') {
      const chatKb = await pool.query('SELECT buttons FROM chat_keyboards WHERE chat_id = $1', [ctx.chat.id]);
      if (chatKb.rows.length > 0) {
        return ctx.replyWithMarkdown(
          `👥 *Клавиатура чата*\n\nРазработчик: @squezzy00`,
          Markup.keyboard(chatKb.rows[0].buttons)
            .resize()
            .persistent() // Клавиатура остается до явного закрытия
            .selective() // Только для этого пользователя
        );
      }
    }

    ctx.reply('ℹ️ Нет сохраненных клавиатур');
  } catch (err) {
    console.error('Ошибка /open:', err);
    ctx.reply('❌ Ошибка загрузки');
  }
});

// Команда /stop
bot.command('stop', (ctx) => {
  activeKeyboards.delete(ctx.from.id);
  ctx.reply('🗑 Клавиатура удалена', Markup.removeKeyboard().selective());
});

// Остальные команды (timer, del, cfg и обработчики напоминаний) остаются без изменений...

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
