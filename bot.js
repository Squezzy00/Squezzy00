const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const express = require('express');

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const pool = new Pool();
const activeKeyboards = new Map();

// Константы
const OWNER_ID = 5005387093;

// Инициализация БД
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id BIGINT PRIMARY KEY,
      username TEXT,
      nickname TEXT,
      universal_id SERIAL,
      is_premium BOOLEAN DEFAULT FALSE,
      is_banned BOOLEAN DEFAULT FALSE,
      is_admin BOOLEAN DEFAULT FALSE,
      banner_file_id TEXT
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_keyboards (
      user_id BIGINT PRIMARY KEY,
      buttons TEXT[] NOT NULL DEFAULT '{}'
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reminders (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      text TEXT NOT NULL,
      end_time BIGINT NOT NULL
    )
  `);
}

// Команда /set (клавиатура)
bot.command('set', async (ctx) => {
  const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',').map(b => b.trim());
  if (!buttons.length) return ctx.reply('Используйте: /set кнопка1,кнопка2');

  try {
    await pool.query(`
      INSERT INTO user_keyboards (user_id, buttons) VALUES ($1, $2)
      ON CONFLICT (user_id) DO UPDATE SET buttons = $2`,
      [ctx.from.id, buttons]
    );
    ctx.reply('✅ Клавиатура сохранена!', Markup.keyboard(buttons).resize());
  } catch (err) {
    console.error('Ошибка /set:', err);
    ctx.reply('❌ Ошибка сохранения');
  }
});

// Команда /see (временная клавиатура)
bot.command('see', async (ctx) => {
  const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',').map(b => b.trim());
  if (!buttons.length) return ctx.reply('Используйте: /see кнопка1,кнопка2');

  activeKeyboards.set(ctx.from.id, buttons);
  ctx.reply('⌛ Временная клавиатура:', Markup.keyboard(buttons).oneTime());
});

// Команда /open (показать клавиатуру)
bot.command('open', async (ctx) => {
  try {
    if (activeKeyboards.has(ctx.from.id)) {
      const buttons = activeKeyboards.get(ctx.from.id);
      return ctx.reply('Ваша клавиатура:', Markup.keyboard(buttons).resize());
    }

    const userKb = await pool.query('SELECT buttons FROM user_keyboards WHERE user_id = $1', [ctx.from.id]);
    if (userKb.rows.length) {
      return ctx.reply('Ваша клавиатура:', Markup.keyboard(userKb.rows[0].buttons).resize());
    }

    ctx.reply('ℹ️ Нет сохранённых клавиатур');
  } catch (err) {
    console.error('Ошибка /open:', err);
    ctx.reply('❌ Ошибка загрузки');
  }
});

// Команда /stop (убрать клавиатуру)
bot.command('stop', (ctx) => {
  activeKeyboards.delete(ctx.from.id);
  ctx.reply('🗑 Клавиатура удалена', Markup.removeKeyboard());
});

// Команда /timer (напоминания)
bot.command('timer', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 3) return ctx.reply('Используйте: /timer время(мин) текст');

  const minutes = parseInt(args[0]);
  if (isNaN(minutes)) return ctx.reply('❌ Укажите число минут');

  const text = args.slice(1).join(' ');
  const endTime = Date.now() + minutes * 60000;

  try {
    await pool.query(`
      INSERT INTO reminders (user_id, text, end_time)
      VALUES ($1, $2, $3)`,
      [ctx.from.id, text, Math.floor(endTime / 1000)]
    );
    ctx.reply(`⏰ Напоминание установлено на ${new Date(endTime).toLocaleTimeString()}`);
  } catch (err) {
    console.error('Ошибка /timer:', err);
    ctx.reply('❌ Ошибка установки таймера');
  }
});

// Проверка напоминаний
setInterval(async () => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const reminders = await pool.query('SELECT * FROM reminders WHERE end_time <= $1', [now]);
    
    for (const rem of reminders.rows) {
      await bot.telegram.sendMessage(rem.user_id, `🔔 Напоминание: ${rem.text}`);
      await pool.query('DELETE FROM reminders WHERE id = $1', [rem.id]);
    }
  } catch (err) {
    console.error('Ошибка проверки таймеров:', err);
  }
}, 60000);

// Команда /setbanner
bot.command('setbanner', async (ctx) => {
  ctx.reply('Отправьте фото в ответ на это сообщение для установки баннера');
});

// Обработчик баннера
bot.on('photo', async (ctx) => {
  if (ctx.message.reply_to_message?.text === '/setbanner') {
    try {
      const fileId = ctx.message.photo[0].file_id;
      await pool.query('UPDATE users SET banner_file_id = $1 WHERE user_id = $2', [fileId, ctx.from.id]);
      ctx.reply('✅ Баннер установлен!');
    } catch (err) {
      console.error('Ошибка установки баннера:', err);
      ctx.reply('❌ Ошибка сохранения');
    }
  }
});

// Команда /tagall (исправленная)
bot.command('tagall', async (ctx) => {
  const user = await pool.query('SELECT is_premium, is_admin FROM users WHERE user_id = $1', [ctx.from.id]);
  const isPrivileged = user.rows[0]?.is_premium || user.rows[0]?.is_admin || ctx.from.id === OWNER_ID;
  if (!isPrivileged) return ctx.reply('🚫 Требуется премиум или админ');

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) return ctx.reply('Используйте: /tagall N сообщение');

  const count = Math.min(100, Math.max(1, parseInt(args[0]) || 5));
  const message = args.slice(1).join(' ');

  const users = await pool.query(`
    SELECT username FROM users 
    WHERE username IS NOT NULL 
    AND user_id != ${ctx.from.id}
    AND is_banned = FALSE
    ORDER BY RANDOM() LIMIT $1`,
    [count]
  );

  if (!users.rows.length) return ctx.reply('❌ Нет пользователей для тега');

  const mentions = users.rows.map(u => `@${u.username} ${message}`).join('\n');
  ctx.reply(mentions);
});

// Запуск
(async () => {
  await initDB();
  
  if (process.env.WEBHOOK_URL) {
    app.use(bot.webhookCallback('/webhook'));
    bot.telegram.setWebhook(process.env.WEBHOOK_URL);
    app.listen(process.env.PORT || 3000, () => console.log('🚀 Вебхук запущен'));
  } else {
    bot.launch().then(() => console.log('🤖 Polling запущен'));
  }
})();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
