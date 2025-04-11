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
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id BIGINT PRIMARY KEY,
        username TEXT,
        universal_id SERIAL,
        is_premium BOOLEAN DEFAULT FALSE,
        is_banned BOOLEAN DEFAULT FALSE,
        is_admin BOOLEAN DEFAULT FALSE
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_keyboards (
        user_id BIGINT PRIMARY KEY,
        buttons TEXT[] NOT NULL DEFAULT '{}'
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS reminders (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        text TEXT NOT NULL,
        end_time BIGINT NOT NULL
      );
    `);
    console.log('✅ Таблицы БД инициализированы');
  } catch (err) {
    console.error('❌ Ошибка инициализации БД:', err);
    throw err;
  } finally {
    client.release();
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

Используйте /help для сп��ска команд
    `);
  } catch (err) {
    console.error('Ошибка /start:', err);
    ctx.reply('❌ Произошла ошибка');
  }
});

// Команда /profile (без ника)
bot.command('profile', async (ctx) => {
  try {
    const user = await pool.query(`
      SELECT universal_id, username, is_premium, is_admin
      FROM users WHERE user_id = $1`,
      [ctx.from.id]
    );

    if (user.rows.length === 0) return ctx.reply('❌ Профиль не найден');
    
    const profileText = `
<blockquote><b>Профиль пользователя</b></blockquote>

<blockquote><b>│ ID:</b> <i>${user.rows[0].universal_id}</i></blockquote>

<blockquote><b>│ Username:</b> <i>@${user.rows[0].username || 'не установлен'}</i></blockquote>

<blockquote><b>│ Статус:</b> <i>${user.rows[0].is_admin ? 'Админ' : 'Пользователь'}</i></blockquote>

<blockquote><b>│ Премиум:</b> <i>${user.rows[0].is_premium ? 'Да' : 'Нет'}</i></blockquote>
    `;

    await ctx.replyWithHTML(profileText);
  } catch (err) {
    console.error('Ошибка /profile:', err);
    ctx.reply('❌ Ошибка загрузки профиля');
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

// Команда /set
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

// Команда /see
bot.command('see', async (ctx) => {
  const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',').map(b => b.trim());
  if (!buttons.length) return ctx.reply('ℹ️ Используйте: /see кнопка1,кнопка2');

  activeKeyboards.set(ctx.from.id, buttons);
  ctx.reply('⌛ Временная клавиатура:', Markup.keyboard(buttons).oneTime());
});

// Команда /open
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

// Команда /stop
bot.command('stop', (ctx) => {
  activeKeyboards.delete(ctx.from.id);
  ctx.reply('🗑 Клавиатура удалена', Markup.removeKeyboard());
});

// Команда /timer
bot.command('timer', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) return ctx.reply('ℹ️ Используйте: /timer 5с/5м/5ч/5д текст');

  // Разбираем временной интервал
  const timeStr = args[1];
  const timeMatch = timeStr.match(/^(\d+)([сmчд])$/i);
  if (!timeMatch) return ctx.reply('❌ Неверный формат времени. Используйте: 5с, 10м, 2ч, 1д');

  const value = parseInt(timeMatch[1]);
  const unit = timeMatch[2].toLowerCase();
  
  let milliseconds;
  switch (unit) {
    case 'с': // секунды
      milliseconds = value * 1000;
      break;
    case 'м': // минуты
      milliseconds = value * 60 * 1000;
      break;
    case 'ч': // часы
      milliseconds = value * 60 * 60 * 1000;
      break;
    case 'д': // дни
      milliseconds = value * 24 * 60 * 60 * 1000;
      break;
    default:
      return ctx.reply('❌ Неизвестная единица времени. Используйте: с, м, ч, д');
  }

  const text = args.slice(2).join(' ');
  if (!text) return ctx.reply('❌ Укажите текст напоминания');
  
  const endTime = Date.now() + milliseconds;

  try {
    await pool.query(`
      INSERT INTO reminders (user_id, text, end_time)
      VALUES ($1, $2, $3)`,
      [ctx.from.id, text, Math.floor(endTime / 1000)]
    );
    
    // Форматируем время для ответа
    let unitName;
    switch (unit) {
      case 'с': unitName = 'секунд'; break;
      case 'м': unitName = 'минут'; break;
      case 'ч': unitName = 'часов'; break;
      case 'д': unitName = 'дней'; break;
    }
    
    ctx.reply(`⏰ Напоминание установлено на ${value} ${unitName} (${new Date(endTime).toLocaleString()})`);
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

<u>Клавиатуры:</u>
/set кнопка1,кнопка2 - сохранить клавиатуру
/see кнопка1,кнопка2 - временная клавиатура
/open - показать клавиатуру
/stop - убрать клавиатуру

<u>Напоминания:</u>
/timer 5с/5м/5ч/5д текст - установить напоминание
(пример: /timer 30м позвонить маме)

<u>Для админов:</u>
/ban ID - забанить пользователя
/unban ID - разбанить пользователя
/premium ID - выдать премиум
/tagall N сообщение - упомянуть участников
  `);
});

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
