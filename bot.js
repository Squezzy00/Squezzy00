const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// Константы
const OWNER_ID = 5005387093; // ID владельца
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
      CREATE TABLE IF NOT EXISTS users (
        user_id BIGINT PRIMARY KEY,
        username TEXT,
        universal_id SERIAL,
        is_premium BOOLEAN DEFAULT FALSE,
        is_banned BOOLEAN DEFAULT FALSE,
        is_admin BOOLEAN DEFAULT FALSE
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
        username TEXT,
        text TEXT NOT NULL,
        end_time BIGINT NOT NULL,
        unit TEXT NOT NULL
      )
    `);
    
    // Убедимся, что владелец добавлен в базу
    await pool.query(`
      INSERT INTO users (user_id, is_admin) 
      VALUES ($1, TRUE) 
      ON CONFLICT (user_id) DO UPDATE SET is_admin = TRUE`,
      [OWNER_ID]
    );
    
    console.log('✅ Таблицы БД готовы');
  } catch (err) {
    console.error('❌ Ошибка создания таблиц:', err);
    process.exit(1);
  }
})();

// Хранилище временных клавиатур
const activeKeyboards = new Map();

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
    // Регистрируем пользователя, если его нет
    await pool.query(`
      INSERT INTO users (user_id, username) 
      VALUES ($1, $2) 
      ON CONFLICT (user_id) DO UPDATE SET username = $2`,
      [ctx.from.id, ctx.from.username]
    );
    
    // Получаем данные пользователя
    const userData = await pool.query(`
      SELECT universal_id, is_premium, is_admin 
      FROM users 
      WHERE user_id = $1`, 
      [ctx.from.id]
    );
    
    let status = '';
    if (ctx.from.id === OWNER_ID) {
      status = '👑 Владелец';
    } else if (userData.rows[0].is_admin) {
      status = '🛡 Администратор';
    }
    
    status += userData.rows[0].is_premium ? ' 💎 Премиум' : '';
    
    ctx.replyWithHTML(`
👋 <b>Привет, ${ctx.from.first_name}!</b>

📌 Ваш ID в боте: <code>${userData.rows[0].universal_id}</code>
${status ? `🌟 Статус: ${status}` : ''}

Используйте <code>/help</code> для списка команд

Разработчик: @squezzy00
    `);
  } catch (err) {
    console.error('Ошибка /start:', err);
    ctx.reply('❌ Произошла ошибка');
  }
});

// Команда /help
bot.command('help', (ctx) => {
  ctx.replyWithHTML(`
<b>📋 Список команд:</b>

<b>Основные:</b>
/profile - ваш профиль
/profile ID - профиль другого игрока (премиум+)
/timer - активные напоминания

<b>Клавиатуры:</b>
/set кнопка1,кнопка2 - установить клавиатуру
/see кнопка1,кнопка2 - временная клавиатура
/open - показать клавиатуру
/stop - убрать клавиатуру

<b>Премиум:</b>
/tagall N текст - тегнуть всех (премиум+)

<b>Админ:</b>
/ban ID - забанить
/premium ID - выдать премиум

<b>Владелец:</b>
/makeadmin ID - назначить админа

Разработчик: @squezzy00
  `);
});

// Команда /profile
bot.command('profile', async (ctx) => {
  try {
    let targetId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    
    // Проверка на просмотр чужого профиля
    if (args.length > 1) {
      const user = await pool.query('SELECT is_premium, is_admin FROM users WHERE user_id = $1', [ctx.from.id]);
      const isPrivileged = user.rows.length > 0 && (user.rows[0].is_premium || user.rows[0].is_admin || ctx.from.id === OWNER_ID);
      
      if (!isPrivileged) {
        return ctx.reply('🚫 Просмотр чужих профилей доступен только для премиум аккаунтов и выше');
      }
      
      targetId = await getUserIdByUniversalId(parseInt(args[1]));
      if (!targetId) return ctx.reply('❌ Пользователь с таким ID не найден');
    }

    const user = await pool.query(`
      SELECT universal_id, is_premium, is_admin 
      FROM users 
      WHERE user_id = $1`, 
      [targetId]
    );
    
    if (user.rows.length === 0) return ctx.reply('❌ Пользователь не найден');
    
    const keyboard = await pool.query('SELECT buttons FROM user_keyboards WHERE user_id = $1', [targetId]);
    
    let status = '';
    if (targetId === OWNER_ID) {
      status = '👑 Владелец';
    } else if (user.rows[0].is_admin) {
      status = '🛡 Администратор';
    }
    
    status += user.rows[0].is_premium ? ' 💎 Премиум' : '';
    
    ctx.replyWithHTML(`
📌 <b>Профиль ${targetId === ctx.from.id ? 'ваш' : 'игрока'}</b>

🆔 ID: <code>${user.rows[0].universal_id}</code>
${status ? `🌟 Статус: ${status}` : ''}
⌨️ Сохранённые кнопки: ${keyboard.rows.length > 0 ? keyboard.rows[0].buttons.join(', ') : 'нет'}
    `);
  } catch (err) {
    console.error('Ошибка /profile:', err);
    ctx.reply('❌ Произошла ошибка');
  }
});

// Команда /ban (админ+)
bot.command('ban', async (ctx) => {
  if (!(await isAdmin(ctx) || ctx.from.id === OWNER_ID)) return;
  
  const targetId = parseInt(ctx.message.text.split(' ')[1]);
  if (!targetId) return ctx.reply('Укажите ID пользователя');

  try {
    await pool.query('UPDATE users SET is_banned = TRUE WHERE universal_id = $1', [targetId]);
    ctx.reply(`✅ Пользователь с ID ${targetId} заблокирован`);
  } catch (err) {
    console.error('Ошибка /ban:', err);
    ctx.reply('❌ Ошибка блокировки');
  }
});

// Команда /premium (админ+)
bot.command('premium', async (ctx) => {
  if (!(await isAdmin(ctx) || ctx.from.id === OWNER_ID)) return;
  
  const targetId = parseInt(ctx.message.text.split(' ')[1]);
  if (!targetId) return ctx.reply('Укажите ID пользователя');

  try {
    await pool.query('UPDATE users SET is_premium = TRUE WHERE universal_id = $1', [targetId]);
    ctx.reply(`✅ Пользователь с ID ${targetId} получил премиум`);
  } catch (err) {
    console.error('Ошибка /premium:', err);
    ctx.reply('❌ Ошибка выдачи премиума');
  }
});

// Команда /makeadmin (только владелец)
bot.command('makeadmin', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) {
    return ctx.reply('🚫 Эта команда только для владельца');
  }
  
  const targetId = parseInt(ctx.message.text.split(' ')[1]);
  if (!targetId) return ctx.reply('Укажите ID пользователя');

  try {
    await pool.query('UPDATE users SET is_admin = TRUE WHERE universal_id = $1', [targetId]);
    ctx.reply(`✅ Пользователь с ID ${targetId} стал администратором`);
  } catch (err) {
    console.error('Ошибка /makeadmin:', err);
    ctx.reply('❌ Ошибка назначения администратора');
  }
});

// Команда /tagall (премиум+)
bot.command('tagall', async (ctx) => {
  try {
    // Проверка прав (премиум, админ или владелец)
    const user = await pool.query('SELECT is_premium, is_admin FROM users WHERE user_id = $1', [ctx.from.id]);
    const isAllowed = user.rows.length > 0 && 
                     (user.rows[0].is_premium || user.rows[0].is_admin || ctx.from.id === OWNER_ID);
    
    if (!isAllowed) {
      return ctx.reply('🚫 Эта команда только для премиум пользователей и выше');
    }

    // Парсинг аргументов
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 2) return ctx.reply('Используйте: /tagall N текст');
    
    const count = parseInt(args[0]);
    const text = args.slice(1).join(' ');

    // Получаем участников чата
    const chatMembers = await ctx.getChatAdministrators();
    const mentions = [];

    for (let i = 0; i < Math.min(count, chatMembers.length); i++) {
      const member = chatMembers[i].user;
      mentions.push(`@${member.username || member.id} ${text}`);
    }

    ctx.reply(mentions.join('\n'));
  } catch (err) {
    console.error('Ошибка /tagall:', err);
    ctx.reply('❌ Ошибка выполнения команды');
  }
});

// Обработчик таймеров
bot.hears(/^\/(\d+)([сcмmчhдd])\s(.+)$/i, async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;
  const [, amount, unit, text] = ctx.match;
  
  const unitMap = { 'с':'с', 'c':'с', 'м':'м', 'm':'м', 'ч':'ч', 'h':'ч', 'д':'д', 'd':'д' };
  const cleanUnit = unitMap[unit.toLowerCase()];

  const ms = {
    'с': amount * 1000,
    'м': amount * 60 * 1000,
    'ч': amount * 60 * 60 * 1000,
    'д': amount * 24 * 60 * 60 * 1000
  }[cleanUnit];

  const endTime = Date.now() + ms;

  try {
    await pool.query(
      'INSERT INTO reminders (user_id, username, text, end_time, unit) VALUES ($1, $2, $3, $4, $5)',
      [userId, username, text, endTime, cleanUnit]
    );

    setTimeout(async () => {
      await ctx.reply(`🔔 @${username}, напоминание: ${text}`);
      await pool.query('DELETE FROM reminders WHERE user_id = $1 AND text = $2 AND unit = $3', 
        [userId, text, cleanUnit]);
    }, ms);

    ctx.reply(`⏳ Напоминание установлено через ${amount}${cleanUnit}: "${text}"`);
  } catch (err) {
    console.error('Ошибка БД:', err);
    ctx.reply('Не удалось установить напоминание');
  }
});

// Команда /timer
bot.command('timer', async (ctx) => {
  const userId = ctx.from.id;
  
  try {
    const res = await pool.query(
      `SELECT text, unit, 
       (end_time - EXTRACT(EPOCH FROM NOW())*1000) AS ms_left
       FROM reminders 
       WHERE user_id = $1 AND end_time > EXTRACT(EPOCH FROM NOW())*1000`,
      [userId]
    );

    if (res.rows.length === 0) {
      return ctx.reply('У вас нет активных напоминаний ⏳');
    }

    const timerList = res.rows.map(row => {
      const timeLeft = Math.ceil(row.ms_left / 1000);
      const units = { 'с': 'сек', 'м': 'мин', 'ч': 'час', 'д': 'дн' };
      return `⏱ ${row.text} (осталось: ${timeLeft}${units[row.unit] || '?'})`;
    }).join('\n');

    ctx.reply(`📋 Ваши напоминания:\n${timerList}`);
  } catch (err) {
    console.error('Ошибка БД:', err);
    ctx.reply('Произошла ошибка при загрузке напоминаний 😢');
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
