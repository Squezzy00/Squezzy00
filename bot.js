const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

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
})();

// Хранилище временных клавиатур
const tempKeyboards = new Map();

// Команда /set - создание постоянной клавиатуры
bot.command('set', async (ctx) => {
  const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',');
  
  if (buttons.length === 0 || buttons[0] === '') {
    return ctx.reply('Используйте: /set Кнопка1, Кнопка2, Кнопка3');
  }

  try {
    await pool.query(
      'INSERT INTO user_keyboards (user_id, buttons) VALUES ($1, $2) ' +
      'ON CONFLICT (user_id) DO UPDATE SET buttons = $2',
      [ctx.from.id, buttons]
    );
    
    ctx.reply(
      `✅ Ваша постоянная клавиатура сохранена!\n` +
      `Используйте /open для показа\n\n` +
      `Разработчик: @squezzy00`,
      Markup.keyboard(buttons).resize().persistent()
    );
  } catch (err) {
    console.error('Ошибка сохранения клавиатуры:', err);
    ctx.reply('Произошла ошибка при сохранении');
  }
});

// Команда /see - временная клавиатура
bot.command('see', (ctx) => {
  const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',');
  
  if (buttons.length === 0 || buttons[0] === '') {
    return ctx.reply('Используйте: /see Кнопка1, Кнопка2, Кнопка3');
  }

  tempKeyboards.set(ctx.from.id, buttons);
  
  ctx.reply(
    `⌛ Временная клавиатура активирована\n` +
    `Используйте /stop для удаления\n\n` +
    `Разработчик: @squezzy00`,
    Markup.keyboard(buttons).resize().persistent()
  );
});

// Команда /stop - удаление клавиатур
bot.command('stop', async (ctx) => {
  tempKeyboards.delete(ctx.from.id);
  
  ctx.reply(
    'Все клавиатуры удалены',
    Markup.removeKeyboard()
  );
});

// Команда /cfg - клавиатура чата (для админов)
bot.command('cfg', async (ctx) => {
  if (!ctx.chat || !await isChatAdmin(ctx)) {
    return ctx.reply('Эта команда только для администраторов чата');
  }

  const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',');
  
  if (buttons.length === 0 || buttons[0] === '') {
    return ctx.reply('Используйте: /cfg Кнопка1, Кнопка2, Кнопка3');
  }

  try {
    await pool.query(
      'INSERT INTO chat_keyboards (chat_id, buttons) VALUES ($1, $2) ' +
      'ON CONFLICT (chat_id) DO UPDATE SET buttons = $2',
      [ctx.chat.id, buttons]
    );
    
    ctx.reply(
      `✅ Клавиатура чата сохранена!\n` +
      `Участники смогут открыть её через /open\n\n` +
      `Разработчик: @squezzy00`
    );
  } catch (err) {
    console.error('Ошибка сохранения клавиатуры чата:', err);
    ctx.reply('Произошла ошибка при сохранении');
  }
});

// Команда /open - открытие клавиатуры
bot.command('open', async (ctx) => {
  try {
    // 1. Проверяем временные клавиатуры
    if (tempKeyboards.has(ctx.from.id)) {
      const buttons = tempKeyboards.get(ctx.from.id);
      return ctx.reply(
        `⌛ Открыта временная клавиатура\n\n` +
        `Разработчик: @squezzy00`,
        Markup.keyboard(buttons).resize().persistent()
      );
    }

    // 2. Проверяем постоянные клавиатуры пользователя
    const userKeyboard = await pool.query(
      'SELECT buttons FROM user_keyboards WHERE user_id = $1',
      [ctx.from.id]
    );

    if (userKeyboard.rows.length > 0) {
      return ctx.reply(
        `✅ Открыта ваша постоянная клавиатура\n\n` +
        `Разработчик: @squezzy00`,
        Markup.keyboard(userKeyboard.rows[0].buttons).resize().persistent()
      );
    }

    // 3. Проверяем клавиатуру чата (если команда в группе)
    if (ctx.chat && ctx.chat.type !== 'private') {
      const chatKeyboard = await pool.query(
        'SELECT buttons FROM chat_keyboards WHERE chat_id = $1',
        [ctx.chat.id]
      );

      if (chatKeyboard.rows.length > 0) {
        return ctx.reply(
          `👥 Открыта клавиатура чата\n\n` +
          `Разработчик: @squezzy00`,
          Markup.keyboard(chatKeyboard.rows[0].buttons).resize().persistent()
        );
      }
    }

    ctx.reply('У вас нет сохраненных клавиатур. Используйте /set или /see');
  } catch (err) {
    console.error('Ошибка открытия клавиатуры:', err);
    ctx.reply('Произошла ошибка при открытии клавиатуры');
  }
});

// Обработка нажатий кнопок
bot.on('text', async (ctx) => {
  if (ctx.message.reply_to_message && 
      ctx.message.reply_to_message.text.includes('Разработчик: @squezzy00')) {
    await ctx.reply(
      `Вы нажали: "${ctx.message.text}"`,
      { reply_to_message_id: ctx.message.reply_to_message.message_id }
    );
  }
});

// Проверка прав администратора
async function isChatAdmin(ctx) {
  if (ctx.chat.type === 'private') return false;
  
  try {
    const admins = await ctx.getChatAdministrators();
    return admins.some(a => a.user.id === ctx.from.id);
  } catch (err) {
    console.error('Ошибка проверки админа:', err);
    return false;
  }
}

// Вебхук и запуск сервера
app.post('/webhook', (req, res) => {
  bot.handleUpdate(req.body);
  res.status(200).end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  bot.telegram.setWebhook(`${process.env.WEBHOOK_URL}/webhook`);
});
