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

// Команда /setnick (установка никнейма)
bot.command('setnick', async (ctx) => {
  const nickname = ctx.message.text.split(' ').slice(1).join(' ');
  
  if (!nickname) {
    return ctx.reply('Используйте: /setnick ВашНикнейм');
  }

  try {
    await pool.query('UPDATE users SET nickname = $1 WHERE user_id = $2', [nickname, ctx.from.id]);
    ctx.reply(`✅ Ваш никнейм установлен: ${nickname}`);
  } catch (err) {
    console.error('Ошибка /setnick:', err);
    ctx.reply('❌ Ошибка установки никнейма');
  }
});

// Обработчик для установки баннера
bot.on('message', async (ctx) => {
  if (ctx.message.reply_to_message && ctx.message.reply_to_message.text === '/setbanner') {
    if (ctx.message.photo) {
      const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      
      try {
        await pool.query('UPDATE users SET banner_file_id = $1 WHERE user_id = $2', [fileId, ctx.from.id]);
        ctx.reply('✅ Баннер профиля успешно установлен!');
      } catch (err) {
        console.error('Ошибка установки баннера:', err);
        ctx.reply('❌ Ошибка установки баннера');
      }
    } else {
      ctx.reply('Пожалуйста, отправьте фото в ответ на команду /setbanner');
    }
  }
});

// Команда /setbanner
bot.command('setbanner', async (ctx) => {
  ctx.reply('Ответьте на это сообщение фотографией, чтобы установить её как баннер профиля');
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
      SELECT universal_id, is_premium, is_admin, nickname 
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
    
    const nickname = userData.rows[0].nickname || ctx.from.username || ctx.from.first_name;
    
    ctx.replyWithHTML(`
👋 <b>Привет, ${nickname}!</b>

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
/setbanner - установить баннер профиля (ответом на команду)
/setnick Никнейм - установить никнейм
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
      SELECT universal_id, is_premium, is_admin, nickname, username, banner_file_id 
      FROM users 
      WHERE user_id = $1`, 
      [targetId]
    );
    
    if (user.rows.length === 0) return ctx.reply('❌ Пользователь не найден');
    
    const keyboard = await pool.query('SELECT buttons FROM user_keyboards WHERE user_id = $1', [targetId]);
    
    const nickname = user.rows[0].nickname || user.rows[0].username || 'Не установлен';
    const nicknameText = user.rows[0].nickname ? 
      `<a href="tg://user?id=${targetId}">${user.rows[0].nickname}</a>` : 
      nickname;
    
    let status = 'Игрок';
    if (targetId === OWNER_ID) {
      status = 'Владелец';
    } else if (user.rows[0].is_admin) {
      status = 'Администратор';
    }
    
    const premiumStatus = user.rows[0].is_premium ? 'Премиум' : 'Нет';
    const buttonsStatus = keyboard.rows.length > 0 ? 
      keyboard.rows[0].buttons.join(', ') : 
      'Не установлены';
    
    const profileText = `
<b>Профиль игрока</b>
<i>━━━━━━━━━━━━━━</i>

<b>│ Ник:</b> <i>${nicknameText}</i>
<b>│ ID:</b> <i>${user.rows[0].universal_id}</i>
<b>│ Статус:</b> <i>${status}</i>
<b>│ Вип:</b> <i>${premiumStatus}</i>
<b>│ Сохранённые кнопки:</b> <i>${buttonsStatus}</i>
    `;
    
    // Если есть баннер, отправляем фото с подписью
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
    ctx.reply('❌ Произошла ошибка');
  }
});

// Команда /set (установка клавиатуры)
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
    
    await ctx.replyWithMarkdown(
      `✅ *Постоянная клавиатура сохранена!*\nИспользуйте /open\n\nРазработчик: @squezzy00`,
      Markup.keyboard(buttons)
        .resize()
        .persistent()
    );
  } catch (err) {
    console.error('Ошибка /set:', err);
    ctx.reply('❌ Ошибка сохранения');
  }
});

// Команда /see (временная клавиатура)
bot.command('see', async (ctx) => {
  const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',').map(b => b.trim());
  
  if (buttons.length === 0 || buttons[0] === '') {
    return ctx.reply('Используйте: /see Кнопка1, Кнопка2');
  }

  activeKeyboards.set(ctx.from.id, buttons);
  
  await ctx.replyWithMarkdown(
    `⌛ *Временная клавиатура активирована*\nИспользуйте /stop для удаления\n\nРазработчик: @squezzy00`,
    Markup.keyboard(buttons)
      .resize()
      .oneTime()
  );
});

// Команда /open (показать клавиатуру)
bot.command('open', async (ctx) => {
  try {
    let buttons = [];
    
    // 1. Проверка временной клавиатуры
    if (activeKeyboards.has(ctx.from.id)) {
      buttons = activeKeyboards.get(ctx.from.id);
      return ctx.replyWithMarkdown(
        `⌛ *Временная клавиатура*\n\nРазработчик: @squezzy00`,
        Markup.keyboard(buttons).resize().oneTime()
      );
    }

    // 2. Проверка личной клавиатуры
    const userKb = await pool.query('SELECT buttons FROM user_keyboards WHERE user_id = $1', [ctx.from.id]);
    if (userKb.rows.length > 0) {
      buttons = userKb.rows[0].buttons;
      return ctx.replyWithMarkdown(
        `✅ *Ваша клавиатура*\n\nРазработчик: @squezzy00`,
        Markup.keyboard(buttons).resize().persistent()
      );
    }

    // 3. Проверка клавиатуры чата
    if (ctx.chat.type !== 'private') {
      const chatKb = await pool.query('SELECT buttons FROM chat_keyboards WHERE chat_id = $1', [ctx.chat.id]);
      if (chatKb.rows.length > 0) {
        buttons = chatKb.rows[0].buttons;
        return ctx.replyWithMarkdown(
          `👥 *Клавиатура чата*\n\nРазработчик: @squezzy00`,
          Markup.keyboard(buttons).resize().persistent()
        );
      }
    }

    ctx.reply('ℹ️ Нет сохраненных клавиатур');
  } catch (err) {
    console.error('Ошибка /open:', err);
    ctx.reply('❌ Ошибка загрузки');
  }
});

// Команда /stop (убрать клавиатуру)
bot.command('stop', async (ctx) => {
  activeKeyboards.delete(ctx.from.id);
  await ctx.reply('🗑 Клавиатура удалена', Markup.removeKeyboard());
});

// Остальные команды (/ban, /premium, /makeadmin, /tagall, /timer) остаются без изменений

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
