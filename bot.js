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

// Инициализация БД
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id BIGINT PRIMARY KEY,
        username TEXT,
        first_name TEXT
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS games (
        game_id SERIAL PRIMARY KEY,
        player1_id BIGINT NOT NULL,
        player2_id BIGINT,
        current_player BIGINT,
        player1_field JSONB,
        player2_field JSONB,
        player1_shots JSONB DEFAULT '{}',
        player2_shots JSONB DEFAULT '{}',
        status TEXT DEFAULT 'waiting',
        created_at TIMESTAMP DEFAULT NOW()
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

// Генерация пустого поля
function generateEmptyField() {
  const field = [];
  for (let i = 0; i < 10; i++) {
    field.push(Array(10).fill(0)); // 0 - пусто, 1 - корабль
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
      
      row.push(Markup.button.callback(
        emoji, 
        `shoot_${coord}`
      ));
    }
    keyboard.push(row);
  }
  
  // Добавляем кнопку сдаться
  keyboard.push([Markup.button.callback('🏳️ Сдаться', 'surrender')]);
  
  return Markup.inlineKeyboard(keyboard);
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
        
        // Проверка клетки и соседних
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

// Команда начала игры
bot.command('start_battle', async (ctx) => {
  try {
    // Сохраняем/обновляем пользователя
    await pool.query(
      `INSERT INTO users (user_id, username, first_name) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (user_id) DO UPDATE SET username = $2, first_name = $3`,
      [ctx.from.id, ctx.from.username, ctx.from.first_name]
    );
    
    ctx.reply(
      'Выберите режим игры:',
      Markup.inlineKeyboard([
        [Markup.button.callback('🤖 Играть против бота', 'play_vs_bot')],
        [Markup.button.callback('👥 Играть с другом', 'play_vs_friend')]
      ])
    );
  } catch (err) {
    console.error('Ошибка start_battle:', err);
    ctx.reply('❌ Произошла ошибка при запуске игры');
  }
});

// Обработка выбора режима игры
bot.action('play_vs_bot', async (ctx) => {
  try {
    // Создаем игру с ботом
    const field = placeShipsAutomatically();
    const res = await pool.query(
      `INSERT INTO games (player1_id, player2_id, current_player, player1_field, player2_field, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING game_id`,
      [ctx.from.id, 0, ctx.from.id, field, placeShipsAutomatically(), 'active']
    );
    
    const gameId = res.rows[0].game_id;
    await ctx.reply('🚢 Игра против бота началась! Ваш ход:');
    await ctx.reply('Ваше поле:');
    await showPlayerField(ctx, gameId, ctx.from.id);
    await ctx.reply('Поле противника:', generateShootingKeyboard());
  } catch (err) {
    console.error('Ошибка play_vs_bot:', err);
    ctx.reply('❌ Произошла ошибка при создании игры');
  }
});

bot.action('play_vs_friend', async (ctx) => {
  try {
    await ctx.reply('Введите username или ID друга (например /play_with @username)');
  } catch (err) {
    console.error('Ошибка play_vs_friend:', err);
    ctx.reply('❌ Произошла ошибка');
  }
});

// Приглашение друга
bot.command('play_with', async (ctx) => {
  const targetInput = ctx.message.text.split(' ')[1];
  if (!targetInput) {
    return ctx.reply('Используйте: /play_with @username или /play_with 123456');
  }

  try {
    // Парсим ID из username или получаем напрямую
    let targetId = targetInput.startsWith('@') 
      ? targetInput.slice(1) 
      : parseInt(targetInput);
    
    // Проверяем существование пользователя
    const userRes = await pool.query(
      'SELECT user_id FROM users WHERE user_id = $1 OR username = $2',
      [targetId, targetInput]
    );
    
    if (userRes.rows.length === 0) {
      return ctx.reply('❌ Пользователь не найден');
    }
    
    targetId = userRes.rows[0].user_id;
    
    // Создаем ожидающую игру
    const field = placeShipsAutomatically();
    const res = await pool.query(
      `INSERT INTO games (player1_id, player2_id, current_player, player1_field, status)
       VALUES ($1, $2, $1, $3, 'waiting') RETURNING game_id`,
      [ctx.from.id, targetId, field]
    );
    
    const gameId = res.rows[0].game_id;
    
    // Отправляем запрос другу
    await ctx.telegram.sendMessage(
      targetId,
      `🎮 ${ctx.from.first_name} приглашает вас в Морской бой!`,
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Принять', `accept_${gameId}`)],
        [Markup.button.callback('❌ Отклонить', `decline_${gameId}`)]
      ])
    );
    
    await ctx.reply('✅ Запрос отправлен! Ожидаем подтверждения...');
  } catch (err) {
    console.error('Ошибка play_with:', err);
    ctx.reply('❌ Произошла ошибка при отправке запроса');
  }
});

// Обработка принятия игры
bot.action(/^accept_/, async (ctx) => {
  const gameId = parseInt(ctx.match[0].replace('accept_', ''));
  
  try {
    // Получаем игру
    const gameRes = await pool.query(
      'SELECT * FROM games WHERE game_id = $1 AND player2_id = $2 AND status = $3',
      [gameId, ctx.from.id, 'waiting']
    );
    
    if (gameRes.rows.length === 0) {
      return ctx.reply('❌ Игра не найдена или уже начата');
    }
    
    const game = gameRes.rows[0];
    
    // Обновляем игру
    const field = placeShipsAutomatically();
    await pool.query(
      `UPDATE games 
       SET player2_field = $1, current_player = $2, status = 'active' 
       WHERE game_id = $3`,
      [field, game.player1_id, gameId]
    );
    
    // Уведомляем игроков
    await ctx.telegram.sendMessage(
      game.player1_id,
      `🎉 ${ctx.from.first_name} принял ваше приглашение! Игра началась, ваш ход.`
    );
    
    await ctx.reply('🎉 Вы приняли игру! Ожидайте своего хода.');
    
    // Показываем поля
    await showPlayerField(ctx, gameId, game.player1_id);
    await showPlayerField(ctx, gameId, ctx.from.id);
    
    // Отправляем клавиатуру для стрельбы первому игроку
    await ctx.telegram.sendMessage(
      game.player1_id,
      'Ваш ход:',
      generateShootingKeyboard()
    );
  } catch (err) {
    console.error('Ошибка accept:', err);
    ctx.reply('❌ Произошла ошибка при принятии игры');
  }
});

// Обработка выстрела
bot.action(/^shoot_/, async (ctx) => {
  const coord = ctx.match[0].replace('shoot_', '');
  const letter = coord[0];
  const x = parseInt(coord.slice(1)) - 1;
  const y = letter.charCodeAt(0) - 'A'.charCodeAt(0);
  
  try {
    // Находим активную игру игрока
    const gameRes = await pool.query(
      `SELECT * FROM games 
       WHERE (player1_id = $1 OR player2_id = $1) 
       AND status = 'active' 
       AND current_player = $1`,
      [ctx.from.id]
    );
    
    if (gameRes.rows.length === 0) {
      return ctx.answerCbQuery('❌ Сейчас не ваш ход или игра не найдена');
    }
    
    const game = gameRes.rows[0];
    const isPlayer1 = game.player1_id === ctx.from.id;
    const opponentId = isPlayer1 ? game.player2_id : game.player1_id;
    const opponentField = isPlayer1 ? game.player2_field : game.player1_field;
    const playerShots = isPlayer1 ? game.player1_shots : game.player2_shots;
    
    // Проверяем, не стреляли ли уже сюда
    if (playerShots[coord]) {
      return ctx.answerCbQuery('❌ Вы уже стреляли сюда');
    }
    
    // Проверяем попадание
    const isHit = opponentField[y][x] === 1;
    const newShots = { ...playerShots, [coord]: isHit ? 'hit' : 'miss' };
    
    // Обновляем игру
    await pool.query(
      `UPDATE games 
       SET ${isPlayer1 ? 'player1_shots' : 'player2_shots'} = $1,
           current_player = $2
       WHERE game_id = $3`,
      [newShots, opponentId, game.game_id]
    );
    
    // Проверяем победу
    const isWin = checkWinCondition(newShots, opponentField);
    
    if (isWin) {
      await endGame(ctx, game.game_id, ctx.from.id);
      return;
    }
    
    // Уведомляем игроков
    await ctx.answerCbQuery(isHit ? '💥 Попадание!' : '🌊 Мимо!');
    await ctx.editMessageReplyMarkup(generateShootingKeyboard(newShots).reply_markup);
    
    // Если игра с ботом - его ход
    if (opponentId === 0) {
      await botTurn(ctx, game.game_id);
    } else {
      await ctx.telegram.sendMessage(
        opponentId,
        `${ctx.from.first_name} сделал ход в ${coord} - ${isHit ? '💥 Попадание!' : '🌊 Мимо!'}\nВаш ход:`,
        generateShootingKeyboard(isPlayer1 ? game.player2_shots : game.player1_shots)
      );
    }
  } catch (err) {
    console.error('Ошибка shoot:', err);
    ctx.answerCbQuery('❌ Произошла ошибка');
  }
});

// Ход бота
async function botTurn(ctx, gameId) {
  try {
    const gameRes = await pool.query(
      'SELECT * FROM games WHERE game_id = $1',
      [gameId]
    );
    
    if (gameRes.rows.length === 0) return;
    const game = gameRes.rows[0];
    
    // Простой ИИ бота
    const shots = game.player2_shots || {};
    const field = game.player1_field;
    
    // Находим первую непроверенную клетку
    let x, y, coord;
    const letters = ['A','B','C','D','E','F','G','H','I','J'];
    
    do {
      x = Math.floor(Math.random() * 10);
      y = Math.floor(Math.random() * 10);
      coord = `${letters[y]}${x + 1}`;
    } while (shots[coord]);
    
    // Проверяем попадание
    const isHit = field[y][x] === 1;
    const newShots = { ...shots, [coord]: isHit ? 'hit' : 'miss' };
    
    // Обновляем игру
    await pool.query(
      `UPDATE games 
       SET player2_shots = $1,
           current_player = $2
       WHERE game_id = $3`,
      [newShots, game.player1_id, gameId]
    );
    
    // Проверяем победу
    const isWin = checkWinCondition(newShots, field);
    
    if (isWin) {
      await endGame(ctx, gameId, 0); // Бот победил
      return;
    }
    
    // Уведомляем игрока
    await ctx.telegram.sendMessage(
      game.player1_id,
      `🤖 Бот сделал ход в ${coord} - ${isHit ? '💥 Попадание!' : '🌊 Мимо!'}\nВаш ход:`,
      generateShootingKeyboard(game.player1_shots)
    );
  } catch (err) {
    console.error('Ошибка botTurn:', err);
  }
}

// Проверка победы
function checkWinCondition(shots, field) {
  let hits = 0;
  let ships = 0;
  
  // Считаем все попадания
  for (const coord in shots) {
    if (shots[coord] === 'hit') hits++;
  }
  
  // Считаем все корабли
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      if (field[y][x] === 1) ships++;
    }
  }
  
  return hits === ships;
}

// Завершение игры
async function endGame(ctx, gameId, winnerId) {
  try {
    const gameRes = await pool.query(
      'SELECT * FROM games WHERE game_id = $1',
      [gameId]
    );
    
    if (gameRes.rows.length === 0) return;
    const game = gameRes.rows[0];
    
    // Обновляем статус игры
    await pool.query(
      'UPDATE games SET status = $1 WHERE game_id = $2',
      ['finished', gameId]
    );
    
    // Уведомляем игроков
    if (winnerId === 0) {
      await ctx.telegram.sendMessage(
        game.player1_id,
        '😢 Вы проиграли! Бот победил.'
      );
    } else {
      const winnerName = winnerId === game.player1_id 
        ? game.player1_name 
        : game.player2_name;
      
      if (game.player2_id !== 0) {
        await ctx.telegram.sendMessage(
          winnerId === game.player1_id ? game.player2_id : game.player1_id,
          `😢 Вы проиграли! ${winnerName} победил.`
        );
      }
      
      await ctx.telegram.sendMessage(
        winnerId,
        '🎉 Вы победили!'
      );
    }
  } catch (err) {
    console.error('Ошибка endGame:', err);
  }
}

// Показ поля игрока
async function showPlayerField(ctx, gameId, playerId) {
  try {
    const gameRes = await pool.query(
      'SELECT * FROM games WHERE game_id = $1',
      [gameId]
    );
    
    if (gameRes.rows.length === 0) return;
    const game = gameRes.rows[0];
    
    const isPlayer1 = game.player1_id === playerId;
    const field = isPlayer1 ? game.player1_field : game.player2_field;
    const shots = isPlayer1 ? game.player2_shots : game.player1_shots;
    
    let fieldStr = ' 1 2 3 4 5 6 7 8 9 10\n';
    const letters = ['A','B','C','D','E','F','G','H','I','J'];
    
    for (let y = 0; y < 10; y++) {
      fieldStr += letters[y] + ' ';
      for (let x = 0; x < 10; x++) {
        const coord = `${letters[y]}${x + 1}`;
        
        if (shots && shots[coord] === 'hit') {
          fieldStr += '💥 ';
        } else if (shots && shots[coord] === 'miss') {
          fieldStr += '🌊 ';
        } else if (field[y][x] === 1) {
          fieldStr += '🚢 ';
        } else {
          fieldStr += '⬜ ';
        }
      }
      fieldStr += '\n';
    }
    
    await ctx.telegram.sendMessage(
      playerId,
      `<pre>${fieldStr}</pre>`,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    console.error('Ошибка showPlayerField:', err);
  }
}

// Обработка сдачи
bot.action('surrender', async (ctx) => {
  try {
    const gameRes = await pool.query(
      `SELECT * FROM games 
       WHERE (player1_id = $1 OR player2_id = $1) 
       AND status = 'active'`,
      [ctx.from.id]
    );
    
    if (gameRes.rows.length === 0) {
      return ctx.answerCbQuery('❌ Нет активной игры');
    }
    
    const game = gameRes.rows[0];
    const opponentId = game.player1_id === ctx.from.id ? game.player2_id : game.player1_id;
    
    await endGame(ctx, game.game_id, opponentId);
    await ctx.answerCbQuery('Вы сдались');
  } catch (err) {
    console.error('Ошибка surrender:', err);
    ctx.answerCbQuery('❌ Произошла ошибка');
  }
});

// Запуск сервера
app.use(express.json());
app.use(bot.webhookCallback('/webhook'));

app.get('/', (req, res) => {
  res.send('Морской бот работает!');
});

app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  
  try {
    await initDB();
    console.log('🤖 Бот успешно запущен');
  } catch (err) {
    console.error('❌ Ошибка запуска:', err);
    process.exit(1);
  }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
