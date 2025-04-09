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
  console.log('✅ Таблицы БД готовы');
})();

// Хранилище временных клавиатур
const tempKeyboards = new Map();

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
    ctx.replyWithMarkdown(
      `✅ *Постоянная клавиатура сохранена!*\nИспользуйте /open\n\n` +
      `Разработчик: @squezzy00`,
      Markup.keyboard(buttons).resize().persistent()
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

  tempKeyboards.set(ctx.from.id, buttons);
  ctx.replyWithMarkdown(
    `⌛ *Временная клавиатура активирована*\nИспользуйте /stop\n\n` +
    `Разработчик: @squezzy00`,
    Markup.keyboard(buttons).resize().persistent()
  );
});

// Команда /stop
bot.command('stop', (ctx) => {
  tempKeyboards.delete(ctx.from.id);
  ctx.reply('🗑 Все клавиатуры удалены', Markup.removeKeyboard());
});

// Команда /cfg (для админов)
bot.command('cfg', async (ctx) => {
  if (ctx.chat.type === 'private') return ctx.reply('Только для чатов!');
  
  try {
    const admins = await ctx.getChatAdministrators();
    const isAdmin = admins.some(a => a.user.id === ctx.from.id);
    if (!isAdmin) return ctx.reply('❌ Только для админов!');

    const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',').map(b => b.trim());
    if (buttons.length === 0) return ctx.reply('Используйте: /cfg Кнопка1, Кнопка2');

    await pool.query(
      `INSERT INTO chat_keyboards (chat_id, buttons) VALUES ($1, $2)
       ON CONFLICT (chat_id) DO UPDATE SET buttons = $2`,
      [ctx.chat.id, buttons]
    );
    ctx.reply('✅ Клавиатура чата сохранена!');
  } catch (err) {
    console.error('Ошибка /cfg:', err);
    ctx.reply('❌ Ошибка сохранения');
  }
});

// Команда /open
bot.command('open', async (ctx) => {
  try {
    // 1. Проверка временной клавиатуры
    if (tempKeyboards.has(ctx.from.id)) {
      const buttons = tempKeyboards.get(ctx.from.id);
      return ctx.replyWithMarkdown(
        `⌛ *Временная клавиатура*\n\nРазработчик: @squezzy00`,
        Markup.keyboard(buttons).resize().persistent()
      );
    }

    // 2. Проверка личной клавиатуры
    const userKb = await pool.query('SELECT buttons FROM user_keyboards WHERE user_id = $1', [ctx.from.id]);
    if (userKb.rows.length > 0) {
      return ctx.replyWithMarkdown(
        `✅ *Ваша клавиатура*\n\nРазработчик: @squezzy00`,
        Markup.keyboard(userKb.rows[0].buttons).resize().persistent()
      );
    }

    // 3. Проверка клавиатуры чата
    if (ctx.chat.type !== 'private') {
      const chatKb = await pool.query('SELECT buttons FROM chat_keyboards WHERE chat_id = $1', [ctx.chat.id]);
      if (chatKb.rows.length > 0) {
        return ctx.replyWithMarkdown(
          `👥 *Клавиатура чата*\n\nРазработчик: @squezzy00`,
          Markup.keyboard(chatKb.rows[0].buttons).resize().persistent()
        );
      }
    }

    ctx.reply('ℹ️ Нет сохраненных клавиатур');
  } catch (err) {
    console.error('Ошибка /open:', err);
    ctx.reply('❌ Ошибка загрузки');
  }
});

// Обработка нажатий кнопок
bot.on('text', async (ctx) => {
  if (ctx.message.reply_to_message?.text?.includes('Разработчик: @squezzy00')) {
    await ctx.reply(
      `Вы нажали: "${ctx.message.text}"`,
      { reply_to_message_id: ctx.message.reply_to_message.message_id }
    );
  }
});

// Вебхук
app.use(express.json());
app.post(WEBHOOK_PATH, (req, res) => {
  bot.handleUpdate(req.body, res).catch(err => {
    console.error('Webhook error:', err);
    res.status(200).end();
  });
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
