const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const express = require('express');

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// Конфигурация подключения к PostgreSQL для Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const activeKeyboards = new Map();
const PORT = process.env.PORT || 3000;

// Инициализация БД с проверкой существования таблиц и колонок
async function initDB() {
  try {
    // Проверяем существование таблицы users
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

    // Проверяем существование таблицы user_keyboards
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_keyboards (
        user_id BIGINT PRIMARY KEY,
        buttons TEXT[] NOT NULL DEFAULT '{}'
      )
    `);

    // Проверяем существование таблицы reminders
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reminders (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        text TEXT NOT NULL,
        end_time BIGINT NOT NULL
      )
    `);

    console.log('✅ Таблицы БД успешно проверены/созданы');
  } catch (err) {
    console.error('❌ Ошибка инициализации БД:', err);
    throw err;
  }
}

// Проверка админа
async function isAdmin(userId) {
  try {
    const res = await pool.query('SELECT is_admin FROM users WHERE user_id = $1', [userId]);
    return res.rows.length > 0 && res.rows[0].is_admin;
  } catch (err) {
    console.error('Ошибка проверки админа:', err);
    return false;
  }
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
<b>🤖 Telegram-бот</b>

Доступные функции:
• Настройка клавиатур (/set, /see, /open)
• Напоминания (/timer)
• Управление профилем (/profile)

Используйте /help для полного списка команд
    `);
  } catch (err) {
    console.error('Ошибка в /start:', err);
    ctx.reply('⚠️ Произошла ошибка при запуске бота');
  }
});

// Команда /profile с проверкой существования колонки nickname
bot.command('profile', async (ctx) => {
  try {
    // Сначала проверяем существование колонки nickname
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='nickname'
    `);

    let nickname;
    if (columnCheck.rows.length > 0) {
      // Если колонка существует, делаем запрос с nickname
      const user = await pool.query(`
        SELECT universal_id, nickname, username, is_premium, is_admin, banner_file_id 
        FROM users 
        WHERE user_id = $1`,
        [ctx.from.id]
      );
      nickname = user.rows[0]?.nickname;
    } else {
      // Если колонки нет, делаем запрос без nickname
      const user = await pool.query(`
        SELECT universal_id, username, is_premium, is_admin, banner_file_id 
        FROM users 
        WHERE user_id = $1`,
        [ctx.from.id]
      );
      nickname = null;
    }

    const user = await pool.query(`
      SELECT universal_id, username, is_premium, is_admin, banner_file_id 
      FROM users 
      WHERE user_id = $1`,
      [ctx.from.id]
    );

    if (user.rows.length === 0) return ctx.reply('❌ Профиль не найден');

    const displayName = nickname || `@${user.rows[0].username}` || ctx.from.first_name;
    
    const profileText = `
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const express = require('express');

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const activeKeyboards = new Map();
const PORT = process.env.PORT || 3000;

// Проверка обязательных переменных
if (!process.env.BOT_TOKEN) {
  console.error('❌ Отсутствует BOT_TOKEN');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('❌ Отсутствует DATABASE_URL');
  process.exit(1);
}

// Инициализация БД
async function initDB() {
  try {
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
    console.log('✅ Таблицы БД инициализированы');
  } catch (err) {
    console.error('❌ Ошибка инициализации БД:', err);
    throw err;
  }
}

// Проверка прав администратора
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
<b>🤖 Telegram-бот</b>

Доступные функции:
• Настройка клавиатур (/set, /see, /open)
• Напоминания (/timer)
• Управление профилем (/profile)

Используйте /help для списка команд
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
      SELECT universal_id, username, is_premium, is_admin, banner_file_id,
      COALESCE(nickname, username) as display_name
      FROM users WHERE user_id = $1`,
      [ctx.from.id]
    );

    if (user.rows.length === 0) return ctx.reply('❌ Профиль не найден');
    
    const profileText = `
<blockquote><b>Профиль пользователя</b></blockquote>

<blockquote><b>│ Ник:</b> <i>${user.rows[0].display_name || 'Не установлен'}</i></blockquote>

<blockquote><b>│ ID:</b> <i>${user.rows[0].universal_id}</i></blockquote>

<blockquote><b>│ Статус:</b> <i>${user.rows[0].is_admin ? 'Админ' : 'Пользователь'}</i></blockquote>

<blockquote><b>│ Премиум:</b> <i>${user.rows[0].is_premium ? 'Да' : 'Нет'}</i></blockquote>
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
});}
});

// [Все остальные команды (/setnick, /setbanner, /ban, /unban, /premium, /tagall, /set, /see, /open, /stop, /timer) остаются без изменений]

// Middleware проверки бана
bot.use(async (ctx, next) => {
  if (ctx.from) {
    try {
      const user = await pool.query('SELECT is_banned FROM users WHERE user_id = $1', [ctx.from.id]);
      if (user.rows.length > 0 && user.rows[0].is_banned) {
        return ctx.reply('🚫 Вы заблокированы в этом боте');
      }
    } catch (err) {
      console.error('Ошибка проверки бана:', err);
    }
  }
  return next();
});

// Настройка вебхука
const setupWebhook = async () => {
  if (!process.env.WEBHOOK_URL) {
    console.log('ℹ️ WEBHOOK_URL не указан, использую polling');
    return bot.launch();
  }

  const webhookUrl = `${process.env.WEBHOOK_URL}/webhook`;
  console.log(`⌛ Устанавливаю вебхук: ${webhookUrl}`);

  try {
    await bot.telegram.setWebhook(webhookUrl);
    console.log('✅ Вебхук установлен');
  } catch (err) {
    console.error('❌ Ошибка вебхука:', err);
    process.exit(1);
  }
};

// Запуск сервера
app.use(express.json());
app.use(bot.webhookCallback('/webhook'));

app.get('/', (req, res) => {
  res.send('Бот работает!');
});

app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  
  try {
    await initDB();
    await setupWebhook();
    console.log('🤖 Бот успешно запущен');
  } catch (err) {
    console.error('❌ Ошибка запуска:', err);
    process.exit(1);
  }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
