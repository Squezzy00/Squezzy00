const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const express = require('express');

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const PORT = process.env.PORT || 3000;

// Генерация пустого поля
function generateEmptyField() {
  return Array(10).fill().map(() => Array(10).fill(0));
}

// Автоматическая расстановка кораблей
function placeShipsAutomatically() {
  const sizes = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];
  const field = generateEmptyField();
  
  for (const size of sizes) {
    let placed = false;
    while (!placed) {
      const vertical = Math.random() > 0.5;
      const x = Math.floor(Math.random() * (vertical ? 10 : 10 - size));
      const y = Math.floor(Math.random() * (vertical ? 10 - size : 10));
      
      let canPlace = true;
      for (let i = 0; i < size; i++) {
        const checkX = vertical ? x : x + i;
        const checkY = vertical ? y + i : y;
        
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const nx = checkX + dx;
            const ny = checkY + dy;
            if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10 && field[ny][nx] === 1) {
              canPlace = false;
            }
          }
        }
      }
      
      if (canPlace) {
        for (let i = 0; i < size; i++) {
          if (vertical) {
            field[y + i][x] = 1;
          } else {
            field[y][x + i] = 1;
          }
        }
        placed = true;
      }
    }
  }
  
  return field;
}

// Генерация клавиатуры для стрельбы
function generateShootingKeyboard(shots = {}) {
  const letters = ['A','B','C','D','E','F','G','H','I','J'];
  const keyboard = [];
  
  for (let y = 0; y < 10; y++) {
    const row = [];
    for (let x = 1; x <= 10; x++) {
      const coord = `${letters[y]}${x}`;
      const shot = shots[coord];
      
      let emoji = '⬜';
      if (shot === 'hit') emoji = '💥';
      if (shot === 'miss') emoji = '🌊';
      
      row.push(Markup.button.callback(emoji, `shoot_${coord}`));
    }
    keyboard.push(row);
  }
  
  keyboard.push([Markup.button.callback('🏳️ Сдаться', 'surrender')]);
  return Markup.inlineKeyboard(keyboard);
}

// Инициализация БД с улучшенной обработкой ошибок
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id BIGINT PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS games (
        game_id SERIAL PRIMARY KEY,
        player1_id BIGINT NOT NULL,
        player2_id BIGINT,
        current_player BIGINT,
        player1_field JSONB NOT NULL,
        player2_field JSONB,
        player1_shots JSONB DEFAULT '{}',
        player2_shots JSONB DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'waiting',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    await client.query('COMMIT');
    console.log('✅ Таблицы БД успешно инициализированы');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка инициализации БД:', err.stack);
    throw err;
  } finally {
    client.release();
  }
}

// Команда start_battle с полной обработкой ошибок
bot.command('start_battle', async (ctx) => {
  try {
    console.log(`[start_battle] Запуск для пользователя ${ctx.from.id}`);
    
    // Проверка подключения к БД
    try {
      await pool.query('SELECT 1');
    } catch (dbErr) {
      console.error('Ошибка подключения к БД:', dbErr);
      throw new Error('Проблемы с подключением к базе данных');
    }
    
    // Сохранение пользователя
    const userRes = await pool.query(
      `INSERT INTO users (user_id, username, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
       SET username = EXCLUDED.username,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name
       RETURNING user_id`,
      [ctx.from.id, ctx.from.username, ctx.from.first_name, ctx.from.last_name]
    );
    
    if (!userRes.rows.length) {
      throw new Error('Не удалось сохранить пользователя');
    }
    
    // Отправка меню выбора режима
    await ctx.reply(
      '🚢 Добро пожаловать в Морской бой!\n\nВыберите режим игры:',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('🤖 Против бота', 'play_vs_bot'),
          Markup.button.callback('👥 С другом', 'play_vs_friend')
        ],
        [Markup.button.callback('📖 Правила игры', 'show_rules')]
      ])
    );
    
    console.log(`[start_battle] Успешно для пользователя ${ctx.from.id}`);
    
  } catch (err) {
    console.error(`[start_battle] Ошибка для ${ctx.from.id}:`, err.stack);
    
    let errorMessage = '❌ Произошла ошибка при запуске игры\n\n';
    errorMessage += 'Попробуйте позже или сообщите администратору';
    
    try {
      await ctx.reply(errorMessage);
    } catch (sendErr) {
      console.error('Не удалось отправить сообщение об ошибке:', sendErr);
    }
  }
});

// Показ правил игры
bot.action('show_rules', async (ctx) => {
  try {
    await ctx.editMessageText(
      `📖 Правила Морского боя:\n\n` +
      `1. Каждый игрок имеет поле 10×10 с кораблями\n` +
      `2. Корабли расставляются автоматически\n` +
      `3. Игроки по очереди делают выстрелы\n` +
      `4. Цель - первым потопить все корабли противника\n\n` +
      `Обозначения:\n` +
      `🚢 - ваш корабль (видно только вам)\n` +
      `💥 - попадание\n` +
      `🌊 - промах\n` +
      `⬜ - еще не стреляли\n\n` +
      `Выберите режим игры:`,
      {
        reply_markup: Markup.inlineKeyboard([
          [
            Markup.button.callback('🤖 Против бота', 'play_vs_bot'),
            Markup.button.callback('👥 С другом', 'play_vs_friend')
          ]
        ]).reply_markup
      }
    );
    await ctx.answerCbQuery();
  } catch (err) {
    console.error('Ошибка show_rules:', err);
    ctx.answerCbQuery('❌ Не удалось показать правила');
  }
});

// Игра против бота
bot.action('play_vs_bot', async (ctx) => {
  try {
    const field = placeShipsAutomatically();
    const botField = placeShipsAutomatically();
    
    const gameRes = await pool.query(
      `INSERT INTO games (player1_id, player2_id, current_player, player1_field, player2_field, status)
       VALUES ($1, 0, $1, $2, $3, 'active')
       RETURNING game_id`,
      [ctx.from.id, field, botField]
    );
    
    await ctx.editMessageText('🎮 Игра против бота началась! Ваш ход:');
    await showPlayerField(ctx, gameRes.rows[0].game_id, ctx.from.id);
    await ctx.reply('Стреляйте по полю противника:', generateShootingKeyboard());
    await ctx.answerCbQuery();
    
  } catch (err) {
    console.error('Ошибка play_vs_bot:', err);
    ctx.answerCbQuery('❌ Не удалось начать игру');
  }
});

// Игра с другом
bot.action('play_vs_friend', async (ctx) => {
  try {
    await ctx.editMessageText(
      'Введите команду /play_with @username или /play_with ID пользователя',
      Markup.inlineKeyboard([
        [Markup.button.callback('↩️ Назад', 'back_to_menu')]
      ])
    );
    await ctx.answerCbQuery();
  } catch (err) {
    console.error('Ошибка play_vs_friend:', err);
    ctx.answerCbQuery('❌ Ошибка при выборе режима');
  }
});

// Обработка кнопки "Назад"
bot.action('back_to_menu', async (ctx) => {
  try {
    await ctx.editMessageText(
      'Выберите режим игры:',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('🤖 Против бота', 'play_vs_bot'),
          Markup.button.callback('👥 С другом', 'play_vs_friend')
        ],
        [Markup.button.callback('📖 Правила игры', 'show_rules')]
      ])
    );
    await ctx.answerCbQuery();
  } catch (err) {
    console.error('Ошибка back_to_menu:', err);
  }
});

// Приглашение друга
bot.command('play_with', async (ctx) => {
  const targetInput = ctx.message.text.split(' ')[1];
  if (!targetInput) {
    return ctx.reply('Используйте: /play_with @username или /play_with ID');
  }

  try {
    let targetId = targetInput.startsWith('@') ? targetInput.slice(1) : parseInt(targetInput);
    
    const userRes = await pool.query(
      'SELECT user_id, first_name FROM users WHERE user_id = $1 OR username = $2',
      [targetId, targetInput]
    );
    
    if (userRes.rows.length === 0) {
      return ctx.reply('❌ Пользователь не найден. Попросите его сначала запустить бота.');
    }
    
    targetId = userRes.rows[0].user_id;
    const targetName = userRes.rows[0].first_name;
    
    if (targetId === ctx.from.id) {
      return ctx.reply('❌ Нельзя играть с самим собой!');
    }
    
    const field = placeShipsAutomatically();
    const gameRes = await pool.query(
      `INSERT INTO games (player1_id, player2_id, player1_field, status)
       VALUES ($1, $2, $3, 'waiting')
       RETURNING game_id`,
      [ctx.from.id, targetId, field]
    );
    
    await ctx.telegram.sendMessage(
      targetId,
      `🎮 ${ctx.from.first_name} приглашает вас в Морской бой!`,
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Принять', `accept_${gameRes.rows[0].game_id}`)],
        [Markup.button.callback('❌ Отклонить', `decline_${gameRes.rows[0].game_id}`)]
      ])
    );
    
    await ctx.reply(`✅ Приглашение отправлено ${targetName}! Ожидайте подтверждения...`);
    
  } catch (err) {
    console.error('Ошибка play_with:', err);
    ctx.reply('❌ Произошла ошибка при отправке приглашения');
  }
});

// Остальные функции (обработка выстрелов, ход бота и т.д.) остаются без изменений
// ...

// Запуск сервера
async function startServer() {
  try {
    // Инициализация БД с повторными попытками
    let dbInitialized = false;
    for (let i = 1; i <= 3; i++) {
      try {
        console.log(`Попытка инициализации БД (${i}/3)...`);
        await initDB();
        dbInitialized = true;
        break;
      } catch (err) {
        console.error(`Ошибка инициализации (попытка ${i}):`, err);
        if (i < 3) await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    if (!dbInitialized) {
      throw new Error('Не удалось инициализировать БД после 3 попыток');
    }
    
    app.use(express.json());
    app.use(bot.webhookCallback('/webhook'));
    
    app.get('/', (req, res) => {
      res.status(200).json({
        status: 'running',
        game: 'Морской бот',
        version: '1.0.0'
      });
    });
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 Сервер запущен на порту ${PORT}`);
    });
    
    process.once('SIGINT', () => {
      console.log('🛑 Получен SIGINT. Остановка...');
      server.close();
      bot.stop('SIGINT');
    });
    
    process.once('SIGTERM', () => {
      console.log('🛑 Получен SIGTERM. Остановка...');
      server.close();
      bot.stop('SIGTERM');
    });
    
  } catch (err) {
    console.error('❌ Фатальная ошибка при запуске:', err);
    process.exit(1);
  }
}

startServer();
