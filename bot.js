const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const express = require('express');

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const pool = new Pool();

// Константы
const OWNER_ID = 5005387093; // Ваш ID владельца

// Проверка подключения к БД
async function checkDB() {
  try {
    await pool.query('SELECT 1');
    console.log('✅ Подключение к БД успешно');
  } catch (err) {
    console.error('❌ Ошибка подключения к БД:', err);
    process.exit(1);
  }
}

// Middleware для проверки бана
bot.use(async (ctx, next) => {
  if (ctx.from) {
    const user = await pool.query('SELECT is_banned FROM users WHERE user_id = $1', [ctx.from.id]);
    if (user.rows.length > 0 && user.rows[0].is_banned) {
      return ctx.reply('🚫 Вы заблокированы в этом боте');
    }
  }
  return next();
});

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
<b>👋 Привет, ${ctx.from.first_name}!</b>

Я вспомогательный бот с возможностью установки таймеров и созданием кнопок.

Используй /help для списка команд
    `);
  } catch (err) {
    console.error('Ошибка /start:', err);
    ctx.reply('❌ Произошла ошибка');
  }
});

// Команда /profile
bot.command('profile', async (ctx) => {
  try {
    const user = await pool.query(`
      SELECT universal_id, nickname, is_premium, is_admin 
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

<blockquote><b>Премиум:</b> <i>${user.rows[0].is_premium ? 'Да' : 'Нет'}</i></blockquote>
    `;

    ctx.replyWithHTML(profileText);
  } catch (err) {
    console.error('Ошибка /profile:', err);
    ctx.reply('❌ Ошибка загрузки профиля');
  }
});

// Команда /ban
bot.command('ban', async (ctx) => {
  if (!await isAdmin(ctx)) return;
  
  const args = ctx.message.text.split(' ');
  if (args.length < 2) return ctx.reply('Используйте: /ban ID_пользователя');
  
  const targetId = await getUserIdByUniversalId(parseInt(args[1]));
  if (!targetId) return ctx.reply('❌ Пользователь не найден');
  
  try {
    await pool.query('UPDATE users SET is_banned = TRUE WHERE user_id = $1', [targetId]);
    ctx.reply(`✅ Пользователь ${targetId} забанен`);
  } catch (err) {
    console.error('Ошибка /ban:', err);
    ctx.reply('❌ Ошибка бана');
  }
});

// Команда /unban
bot.command('unban', async (ctx) => {
  if (!await isAdmin(ctx)) return;
  
  const args = ctx.message.text.split(' ');
  if (args.length < 2) return ctx.reply('Используйте: /unban ID_пользователя');
  
  const targetId = await getUserIdByUniversalId(parseInt(args[1]));
  if (!targetId) return ctx.reply('❌ Пользователь не найден');
  
  try {
    await pool.query('UPDATE users SET is_banned = FALSE WHERE user_id = $1', [targetId]);
    ctx.reply(`✅ Пользователь ${targetId} разбанен`);
  } catch (err) {
    console.error('Ошибка /unban:', err);
    ctx.reply('❌ Ошибка разбана');
  }
});

// Команда /tagall (исправленная)
bot.command('tagall', async (ctx) => {
  const user = await pool.query('SELECT is_premium, is_admin FROM users WHERE user_id = $1', [ctx.from.id]);
  const isPrivileged = user.rows.length > 0 && (user.rows[0].is_premium || user.rows[0].is_admin || ctx.from.id === OWNER_ID);
  
  if (!isPrivileged) {
    return ctx.reply('🚫 Эта команда доступна только для премиум пользователей и выше');
  }
  
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) return ctx.reply('Используйте: /tagall N сообщение');
  
  const count = parseInt(args[0]);
  if (isNaN(count) || count < 1 || count > 100) return ctx.reply('❌ Укажите число от 1 до 100');
  
  const message = args.slice(1).join(' ');
  const users = await pool.query(`
    SELECT user_id, username 
    FROM users 
    WHERE is_banned = FALSE 
    AND user_id != ${ctx.from.id} 
    AND username IS NOT NULL
    ORDER BY RANDOM() 
    LIMIT $1`, 
    [count]
  );
  
  if (users.rows.length === 0) return ctx.reply('❌ Нет пользователей для тега');
  
  let mentions = '';
  users.rows.forEach(user => {
    mentions += `@${user.username} ${message}\n`;
  });
  
  ctx.reply(mentions);
});

// Команда /help
bot.command('help', (ctx) => {
  ctx.replyWithHTML(`
<b>📋 Список команд:</b>

<b>Основные:</b>
/start - начать работу
/profile - ваш профиль
/help - список команд

<b>Админ:</b>
/ban ID - забанить пользователя
/unban ID - разбанить пользователя

<b>Премиум:</b>
/tagall N сообщение - упомянуть N случайных пользователей

Разработчик: @squezzy00
  `);
});

// Вспомогательные функции
async function isAdmin(ctx) {
  try {
    const user = await pool.query('SELECT is_admin FROM users WHERE user_id = $1', [ctx.from.id]);
    return user.rows.length > 0 && user.rows[0].is_admin;
  } catch (err) {
    console.error('Ошибка проверки админа:', err);
    return false;
  }
}

async function getUserIdByUniversalId(universalId) {
  try {
    const res = await pool.query('SELECT user_id FROM users WHERE universal_id = $1', [universalId]);
    return res.rows.length > 0 ? res.rows[0].user_id : null;
  } catch (err) {
    console.error('Ошибка поиска пользователя:', err);
    return null;
  }
}

// Запуск бота
async function start() {
  await checkDB();
  
  if (process.env.WEBHOOK_MODE === 'true') {
    const PORT = process.env.PORT || 3000;
    app.use(bot.webhookCallback('/webhook'));
    bot.telegram.setWebhook(process.env.WEBHOOK_URL);
    app.listen(PORT, () => console.log(`🚀 Вебхук запущен на порту ${PORT}`));
  } else {
    bot.launch().then(() => console.log('🤖 Бот запущен в polling режиме'));
  }
}

start().catch(err => {
  console.error('❌ Ошибка запуска бота:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
