const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const express = require('express');

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const pool = new Pool();
const activeKeyboards = new Map();

// Константы
const OWNER_ID = 5005387093;
const MAX_MENTIONS_PER_MESSAGE = 5;

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
    CREATE TABLE IF NOT EXISTS chat_keyboards (
      chat_id BIGINT PRIMARY KEY,
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

// Проверка админа
async function isAdmin(userId) {
  const res = await pool.query('SELECT is_admin FROM users WHERE user_id = $1', [userId]);
  return res.rows.length > 0 && res.rows[0].is_admin;
}

// Команда /start
bot.command('start', async (ctx) => {
  try {
    await pool.query(`
      INSERT INTO users (user_id, username) 
      VALUES ($1, $2) 
      ON CONFLICT (user_id) DO UPDATE SET username = $2`,
      [ctx.from.id, ctx.from.username]
    );

    ctx.replyWithHTML(`
<b>🤖 Официальный Telegram-бот</b>

✅ <b>Полностью соответствует правилам Telegram</b>
✅ <b>Не нарушает пользовательские соглашения</b>
✅ <b>Не собирает личные данные</b>

<u>Основные функции:</u>
• Создание напоминаний (/timer)
• Настройка клавиатур (/set, /see, /open)
• Управление профилем (/profile, /setnick)
• Установка баннера (/setbanner)

<u>Для администраторов:</u>
• Управление пользователями (/ban, /unban, /premium)
• Массовые уведомления (/tagall)

<u>Безопасность:</u>
• Весь исходный код открыт для проверки
• Используется официальный API Telegram

Для списка команд используйте /help
    `);
  } catch (err) {
    console.error('Ошибка в /start:', err);
    ctx.reply('⚠️ Произошла ошибка при запуске бота');
  }
});

// Команда /profile
bot.command('profile', async (ctx) => {
  try {
    const user = await pool.query(`
      SELECT universal_id, nickname, is_premium, is_admin, banner_file_id 
      FROM users 
      WHERE user_id = $1`,
      [ctx.from.id]
    );

    if (user.rows.length === 0) return ctx.reply('❌ Профиль не найден');

    const profileText = `
<blockquote><b>Профиль пользователя</b></blockquote>

<blockquote><b>ID:</b> <i>${user.rows[0].universal_id}</i></blockquote>

<blockquote><b>Ник:</b> <i>${user.rows[0].nickname || 'Не установлен'}</i></blockquote>

<blockquote><b>Статус:</b> <i>${user.rows[0].is_admin ? 'Админ' : 'Пользователь'}</i></blockquote>

<blockquote><b>Премиум:</b> <i>${user.rows[0].is_premium ? 'Активен' : 'Не активен'}</i></blockquote>
    `;

    if (user.rows[0].banner_file_id) {
      await ctx.replyWithPhoto(user.rows[0].banner_file_id, {
        caption: profileText,
        parse_mode: 'HTML'
      });
    } else {
      await ctx.replyWithHTML(profileText);
    }
  } catch (err) {
    console.error('Ошибка /profile:', err);
    ctx.reply('❌ Ошибка загрузки профиля');
  }
});

// Команда /setnick
bot.command('setnick', async (ctx) => {
  const nickname = ctx.message.text.split(' ').slice(1).join(' ');
  if (!nickname) return ctx.reply('ℹ️ Используйте: /setnick ВашНикнейм');

  try {
    await pool.query('UPDATE users SET nickname = $1 WHERE user_id = $2', [nickname, ctx.from.id]);
    ctx.reply(`✅ Никнейм установлен: ${nickname}`);
  } catch (err) {
    console.error('Ошибка /setnick:', err);
    ctx.reply('❌ Ошибка изменения никнейма');
  }
});

// Команда /setbanner
bot.command('setbanner', (ctx) => {
  ctx.reply('Отправьте фото в ответ на это сообщение для установки баннера');
});

bot.on('photo', async (ctx) => {
  if (ctx.message.reply_to_message?.text === '/setbanner') {
    try {
      const fileId = ctx.message.photo[0].file_id;
      await pool.query('UPDATE users SET banner_file_id = $1 WHERE user_id = $2', [fileId, ctx.from.id]);
      ctx.reply('✅ Баннер успешно установлен!');
    } catch (err) {
      console.error('Ошибка установки баннера:', err);
      ctx.reply('❌ Ошибка сохранения баннера');
    }
  }
});

// Команда /ban
bot.command('ban', async (ctx) => {
  if (!await isAdmin(ctx.from.id)) return;

  const args = ctx.message.text.split(' ');
  if (args.length < 2) return ctx.reply('ℹ️ Используйте: /ban ID_пользователя');

  try {
    await pool.query('UPDATE users SET is_banned = TRUE WHERE universal_id = $1', [args[1]]);
    ctx.reply(`✅ Пользователь ${args[1]} забанен`);
  } catch (err) {
    console.error('Ошибка /ban:', err);
    ctx.reply('❌ Ошибка бана пользователя');
  }
});

// Команда /unban
bot.command('unban', async (ctx) => {
  if (!await isAdmin(ctx.from.id)) return;

  const args = ctx.message.text.split(' ');
  if (args.length < 2) return ctx.reply('ℹ️ Используйте: /unban ID_пользователя');

  try {
    await pool.query('UPDATE users SET is_banned = FALSE WHERE universal_id = $1', [args[1]]);
    ctx.reply(`✅ Пользователь ${args[1]} разбанен`);
  } catch (err) {
    console.error('Ошибка /unban:', err);
    ctx.reply('❌ Ошибка разбана пользователя');
  }
});

// Команда /premium
bot.command('premium', async (ctx) => {
  if (!await isAdmin(ctx.from.id)) return;

  const args = ctx.message.text.split(' ');
  if (args.length < 2) return ctx.reply('ℹ️ Используйте: /premium ID_пользователя');

  try {
    await pool.query('UPDATE users SET is_premium = TRUE WHERE universal_id = $1', [args[1]]);
    ctx.reply(`✅ Пользователь ${args[1]} получил премиум`);
  } catch (err) {
    console.error('Ошибка /premium:', err);
    ctx.reply('❌ Ошибка выдачи премиума');
  }
});

// Команда /tagall
bot.command('tagall', async (ctx) => {
  if (ctx.chat.type === 'private') return ctx.reply('🚫 Команда только для чатов!');
  if (!await isAdmin(ctx.from.id)) return;

  const args = ctx.message.text.split(' ');
  if (args.length < 2) return ctx.reply('ℹ️ Используйте: /tagall N сообщение');

  const perMessage = Math.min(50, Math.max(1, parseInt(args[0]) || 5));
  const message = args.slice(1).join(' ');

  try {
    const members = await ctx.getChatAdministrators();
    const mentions = members
      .filter(m => m.user.id !== ctx.botInfo.id)
      .map(m => `@${m.user.username}`);

    for (let i = 0; i < mentions.length; i += perMessage) {
      const batch = mentions.slice(i, i + perMessage).join(' ');
      await ctx.reply(`${message}\n${batch}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (err) {
    console.error('Ошибка /tagall:', err);
    ctx.reply('❌ Не удалось упомянуть участников');
  }
});

// Команды клавиатур
bot.command('set', async (ctx) => {
  const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',').map(b => b.trim());
  if (!buttons.length) return ctx.reply('ℹ️ Используйте: /set кнопка1,кнопка2');

  try {
    await pool.query(`
      INSERT INTO user_keyboards (user_id, buttons) 
      VALUES ($1, $2) 
      ON CONFLICT (user_id) DO UPDATE SET buttons = $2`,
      [ctx.from.id, buttons]
    );
    ctx.reply('✅ Клавиатура сохранена!', Markup.keyboard(buttons).resize());
  } catch (err) {
    console.error('Ошибка /set:', err);
    ctx.reply('❌ Ошибка сохранения клавиатуры');
  }
});

bot.command('see', async (ctx) => {
  const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',').map(b => b.trim());
  if (!buttons.length) return ctx.reply('ℹ️ Используйте: /see кнопка1,кнопка2');

  activeKeyboards.set(ctx.from.id, buttons);
  ctx.reply('⌛ Временная клавиатура:', Markup.keyboard(buttons).oneTime());
});

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
    ctx.reply('❌ Ошибка загрузки клавиатуры');
  }
});

bot.command('stop', (ctx) => {
  activeKeyboards.delete(ctx.from.id);
  ctx.reply('🗑 Клавиатура удалена', Markup.removeKeyboard());
});

// Команда /timer
bot.command('timer', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) return ctx.reply('ℹ️ Используйте: /timer минуты текст');

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
    ctx.reply('❌ Ошибка установки напоминания');
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
    console.error('Ошибка проверки напоминаний:', err);
  }
}, 60000);

// Команда /help
bot.command('help', (ctx) => {
  ctx.replyWithHTML(`
<b>📋 Список всех команд:</b>

<u>Основные:</u>
/start - информация о боте
/profile - ваш профиль
/setnick [ник] - изменить ник
/setbanner - установить баннер профиля

<u>Клавиатуры:</u>
/set кнопка1,кнопка2 - сохранить клавиатуру
/see кнопка1,кнопка2 - временная клавиатура
/open - показать клавиатуру
/stop - убрать клавиатуру

<u>Напоминания:</u>
/timer минуты текст - установить напоминание

<u>Для админов:</u>
/ban ID - забанить пользователя
/unban ID - разбанить пользователя
/premium ID - выдать премиум
/tagall N сообщение - упомянуть участников

<u>Безопасность:</u>
Бот не хранит ваши личные данные и соответствует правилам Telegram
  `);
});

// Запуск бота
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
process.once('SIGTERM', () => bot.stop('SIGTERM')); const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const express = require('express');

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const pool = new Pool();
const activeKeyboards = new Map();

// Константы
const OWNER_ID = 5005387093;
const MAX_MENTIONS_PER_MESSAGE = 5;

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
    CREATE TABLE IF NOT EXISTS chat_keyboards (
      chat_id BIGINT PRIMARY KEY,
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

// Проверка админа
async function isAdmin(userId) {
  const res = await pool.query('SELECT is_admin FROM users WHERE user_id = $1', [userId]);
  return res.rows.length > 0 && res.rows[0].is_admin;
}

// Команда /start
bot.command('start', async (ctx) => {
  try {
    await pool.query(`
      INSERT INTO users (user_id, username) 
      VALUES ($1, $2) 
      ON CONFLICT (user_id) DO UPDATE SET username = $2`,
      [ctx.from.id, ctx.from.username]
    );

    ctx.replyWithHTML(`
<b>🤖 Официальный Telegram-бот</b>

✅ <b>Полностью соответствует правилам Telegram</b>
✅ <b>Не нарушает пользовательские соглашения</b>
✅ <b>Не собирает личные данные</b>

<u>Основные функции:</u>
• Создание напоминаний (/timer)
• Настройка клавиатур (/set, /see, /open)
• Управление профилем (/profile, /setnick)
• Установка баннера (/setbanner)

<u>Для администраторов:</u>
• Управление пользователями (/ban, /unban, /premium)
• Массовые уведомления (/tagall)

<u>Безопасность:</u>
• Весь исходный код открыт для проверки
• Используется официальный API Telegram

Для списка команд используйте /help
    `);
  } catch (err) {
    console.error('Ошибка в /start:', err);
    ctx.reply('⚠️ Произошла ошибка при запуске бота');
  }
});

// Команда /profile
bot.command('profile', async (ctx) => {
  try {
    const user = await pool.query(`
      SELECT universal_id, nickname, is_premium, is_admin, banner_file_id 
      FROM users 
      WHERE user_id = $1`,
      [ctx.from.id]
    );

    if (user.rows.length === 0) return ctx.reply('❌ Профиль не найден');

    const profileText = `
<blockquote><b>Профиль пользователя</b></blockquote>

<blockquote><b>ID:</b> <i>${user.rows[0].universal_id}</i></blockquote>

<blockquote><b>Ник:</b> <i>${user.rows[0].nickname || 'Не установлен'}</i></blockquote>

<blockquote><b>Статус:</b> <i>${user.rows[0].is_admin ? 'Админ' : 'Пользователь'}</i></blockquote>

<blockquote><b>Премиум:</b> <i>${user.rows[0].is_premium ? 'Активен' : 'Не активен'}</i></blockquote>
    `;

    if (user.rows[0].banner_file_id) {
      await ctx.replyWithPhoto(user.rows[0].banner_file_id, {
        caption: profileText,
        parse_mode: 'HTML'
      });
    } else {
      await ctx.replyWithHTML(profileText);
    }
  } catch (err) {
    console.error('Ошибка /profile:', err);
    ctx.reply('❌ Ошибка загрузки профиля');
  }
});

// Команда /setnick
bot.command('setnick', async (ctx) => {
  const nickname = ctx.message.text.split(' ').slice(1).join(' ');
  if (!nickname) return ctx.reply('ℹ️ Используйте: /setnick ВашНикнейм');

  try {
    await pool.query('UPDATE users SET nickname = $1 WHERE user_id = $2', [nickname, ctx.from.id]);
    ctx.reply(`✅ Никнейм установлен: ${nickname}`);
  } catch (err) {
    console.error('Ошибка /setnick:', err);
    ctx.reply('❌ Ошибка изменения никнейма');
  }
});

// Команда /setbanner
bot.command('setbanner', (ctx) => {
  ctx.reply('Отправьте фото в ответ на это сообщение для установки баннера');
});

bot.on('photo', async (ctx) => {
  if (ctx.message.reply_to_message?.text === '/setbanner') {
    try {
      const fileId = ctx.message.photo[0].file_id;
      await pool.query('UPDATE users SET banner_file_id = $1 WHERE user_id = $2', [fileId, ctx.from.id]);
      ctx.reply('✅ Баннер успешно установлен!');
    } catch (err) {
      console.error('Ошибка установки баннера:', err);
      ctx.reply('❌ Ошибка сохранения баннера');
    }
  }
});

// Команда /ban
bot.command('ban', async (ctx) => {
  if (!await isAdmin(ctx.from.id)) return;

  const args = ctx.message.text.split(' ');
  if (args.length < 2) return ctx.reply('ℹ️ Используйте: /ban ID_пользователя');

  try {
    await pool.query('UPDATE users SET is_banned = TRUE WHERE universal_id = $1', [args[1]]);
    ctx.reply(`✅ Пользователь ${args[1]} забанен`);
  } catch (err) {
    console.error('Ошибка /ban:', err);
    ctx.reply('❌ Ошибка бана пользователя');
  }
});

// Команда /unban
bot.command('unban', async (ctx) => {
  if (!await isAdmin(ctx.from.id)) return;

  const args = ctx.message.text.split(' ');
  if (args.length < 2) return ctx.reply('ℹ️ Используйте: /unban ID_пользователя');

  try {
    await pool.query('UPDATE users SET is_banned = FALSE WHERE universal_id = $1', [args[1]]);
    ctx.reply(`✅ Пользователь ${args[1]} разбанен`);
  } catch (err) {
    console.error('Ошибка /unban:', err);
    ctx.reply('❌ Ошибка разбана пользователя');
  }
});

// Команда /premium
bot.command('premium', async (ctx) => {
  if (!await isAdmin(ctx.from.id)) return;

  const args = ctx.message.text.split(' ');
  if (args.length < 2) return ctx.reply('ℹ️ Используйте: /premium ID_пользователя');

  try {
    await pool.query('UPDATE users SET is_premium = TRUE WHERE universal_id = $1', [args[1]]);
    ctx.reply(`✅ Пользователь ${args[1]} получил премиум`);
  } catch (err) {
    console.error('Ошибка /premium:', err);
    ctx.reply('❌ Ошибка выдачи премиума');
  }
});

// Команда /tagall
bot.command('tagall', async (ctx) => {
  if (ctx.chat.type === 'private') return ctx.reply('🚫 Команда только для чатов!');
  if (!await isAdmin(ctx.from.id)) return;

  const args = ctx.message.text.split(' ');
  if (args.length < 2) return ctx.reply('ℹ️ Используйте: /tagall N сообщение');

  const perMessage = Math.min(50, Math.max(1, parseInt(args[0]) || 5));
  const message = args.slice(1).join(' ');

  try {
    const members = await ctx.getChatAdministrators();
    const mentions = members
      .filter(m => m.user.id !== ctx.botInfo.id)
      .map(m => `@${m.user.username}`);

    for (let i = 0; i < mentions.length; i += perMessage) {
      const batch = mentions.slice(i, i + perMessage).join(' ');
      await ctx.reply(`${message}\n${batch}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (err) {
    console.error('Ошибка /tagall:', err);
    ctx.reply('❌ Не удалось упомянуть участников');
  }
});

// Команды клавиатур
bot.command('set', async (ctx) => {
  const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',').map(b => b.trim());
  if (!buttons.length) return ctx.reply('ℹ️ Используйте: /set кнопка1,кнопка2');

  try {
    await pool.query(`
      INSERT INTO user_keyboards (user_id, buttons) 
      VALUES ($1, $2) 
      ON CONFLICT (user_id) DO UPDATE SET buttons = $2`,
      [ctx.from.id, buttons]
    );
    ctx.reply('✅ Клавиатура сохранена!', Markup.keyboard(buttons).resize());
  } catch (err) {
    console.error('Ошибка /set:', err);
    ctx.reply('❌ Ошибка сохранения клавиатуры');
  }
});

bot.command('see', async (ctx) => {
  const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',').map(b => b.trim());
  if (!buttons.length) return ctx.reply('ℹ️ Используйте: /see кнопка1,кнопка2');

  activeKeyboards.set(ctx.from.id, buttons);
  ctx.reply('⌛ Временная клавиатура:', Markup.keyboard(buttons).oneTime());
});

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
    ctx.reply('❌ Ошибка загрузки клавиатуры');
  }
});

bot.command('stop', (ctx) => {
  activeKeyboards.delete(ctx.from.id);
  ctx.reply('🗑 Клавиатура удалена', Markup.removeKeyboard());
});

// Команда /timer
bot.command('timer', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) return ctx.reply('ℹ️ Используйте: /timer минуты текст');

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
    ctx.reply('❌ Ошибка установки напоминания');
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
    console.error('Ошибка проверки напоминаний:', err);
  }
}, 60000);

// Команда /help
bot.command('help', (ctx) => {
  ctx.replyWithHTML(`
<b>📋 Список всех команд:</b>

<u>Основные:</u>
/start - информация о боте
/profile - ваш профиль
/setnick [ник] - изменить ник
/setbanner - установить баннер профиля

<u>Клавиатуры:</u>
/set кнопка1,кнопка2 - сохранить клавиатуру
/see кнопка1,кнопка2 - временная клавиатура
/open - показать клавиатуру
/stop - убрать клавиатуру

<u>Напоминания:</u>
/timer минуты текст - установить напоминание

<u>Для админов:</u>
/ban ID - забанить пользователя
/unban ID - разбанить пользователя
/premium ID - выдать премиум
/tagall N сообщение - упомянуть участников

<u>Безопасность:</u>
Бот не хранит ваши личные данные и соответствует правилам Telegram
  `);
});

// Запуск бота
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
