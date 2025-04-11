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

// Игровые константы
const SHIP_TYPES = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]; // Размеры кораблей
const BOARD_SIZE = 10;
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

// Установка команд бота
const commands = [
  { command: 'start', description: 'Начать игру' },
  { command: 'rules', description: 'Правила игры' },
  { command: 'playbot', description: 'Играть с ботом' },
  { command: 'playfriend', description: 'Играть с другом' },
  { command: 'invite', description: 'Пригласить друга' }
];

// Инициализация бота
async function initBot() {
  try {
    await bot.telegram.setMyCommands(commands);
    await initDB();
    console.log('✅ Бот инициализирован');
  } catch (err) {
    console.error('❌ Ошибка инициализации:', err);
    process.exit(1);
  }
}

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
        player1_field JSONB NOT NULL,
        player2_field JSONB,
        player1_shots JSONB DEFAULT '{}',
        player2_shots JSONB DEFAULT '{}',
        status TEXT DEFAULT 'waiting'
      );
    `);
  } catch (err) {
    console.error('❌ Ошибка БД:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Генерация поля с кораблями
function generateBoard() {
  const board = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(0));
  
  for (const size of SHIP_TYPES) {
    let placed = false;
    while (!placed) {
      const vertical = Math.random() > 0.5;
      const x = Math.floor(Math.random() * (vertical ? BOARD_SIZE : BOARD_SIZE - size));
      const y = Math.floor(Math.random() * (vertical ? BOARD_SIZE - size : BOARD_SIZE));
      
      let canPlace = true;
      for (let i = 0; i < size; i++) {
        const nx = vertical ? x : x + i;
        const ny = vertical ? y + i : y;
        
        // Проверяем соседние клетки
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (board[ny + dy]?.[nx + dx] === 1) {
              canPlace = false;
            }
          }
        }
      }
      
      if (canPlace) {
        for (let i = 0; i < size; i++) {
          if (vertical) {
            board[y + i][x] = 1;
          } else {
            board[y][x + i] = 1;
          }
        }
        placed = true;
      }
    }
  }
  return board;
}

// Генерация клавиатуры для стрельбы
function generateShootingKeyboard(shots = {}) {
  const keyboard = [];
  
  for (let y = 0; y < BOARD_SIZE; y++) {
    const row = [];
    for (let x = 1; x <= BOARD_SIZE; x++) {
      const coord = `${LETTERS[y]}${x}`;
      const emoji = shots[coord] === 'hit' ? '💥' : 
                   shots[coord] === 'miss' ? '🌊' : '⬜';
      row.push(Markup.button.callback(emoji, `shoot_${coord}`));
    }
    keyboard.push(row);
  }
  
  keyboard.push([Markup.button.callback('🏳️ Сдаться', 'surrender')]);
  return Markup.inlineKeyboard(keyboard);
}

// Отображение поля игрока
function renderBoard(board, shots = {}) {
  let result = '  ' + Array(BOARD_SIZE).fill().map((_, i) => i + 1).join(' ') + '\n';
  
  for (let y = 0; y < BOARD_SIZE; y++) {
    result += LETTERS[y] + ' ';
    for (let x = 0; x < BOARD_SIZE; x++) {
      const coord = `${LETTERS[y]}${x + 1}`;
      if (shots[coord] === 'hit') {
        result += '💥';
      } else if (shots[coord] === 'miss') {
        result += '🌊';
      } else if (board[y][x] === 1) {
        result += '🚢';
      } else {
        result += '⬜';
      }
      result += ' ';
    }
    result += '\n';
  }
  
  return `<pre>${result}</pre>`;
}

// Команда /start
bot.command('start', async (ctx) => {
  try {
    await ctx.reply(
      '🚢 Добро пожаловать в Морской бой!\n\n' +
      'Выберите действие:',
      Markup.inlineKeyboard([
        [Markup.button.callback('📖 Правила', 'show_rules')],
        [
          Markup.button.callback('🤖 Играть с ботом', 'play_bot'),
          Markup.button.callback('👥 Играть с другом', 'play_friend')
        ]
      ])
    );
  } catch (err) {
    console.error('Ошибка start:', err);
    ctx.reply('❌ Ошибка при запуске');
  }
});

// Команда /rules
bot.command('rules', (ctx) => {
  ctx.replyWithMarkdown(
    `*📖 Правила Морского боя:*\n\n` +
    `1. Играют два игрока на поле 10×10\n` +
    `2. Корабли расставляются автоматически\n` +
    `3. По очереди делаете выстрелы\n` +
    `4. Цель - первым потопить все корабли противника\n\n` +
    `*Доступные команды:*\n` +
    `/playbot - игра с ботом\n` +
    `/playfriend - игра с другом\n` +
    `/invite @user - пригласить друга`
  );
});

// Команда /playbot
bot.command('playbot', async (ctx) => {
  try {
    const playerBoard = generateBoard();
    const botBoard = generateBoard();
    
    const res = await pool.query(
      `INSERT INTO games (player1_id, player2_id, current_player, player1_field, player2_field, status)
       VALUES ($1, 0, $1, $2, $3, 'active')
       RETURNING game_id`,
      [ctx.from.id, playerBoard, botBoard]
    );
    
    await ctx.reply('🎮 Игра против бота началась! Ваш ход:');
    await ctx.replyWithHTML(renderBoard(playerBoard));
    await ctx.reply('Стреляйте по полю:', generateShootingKeyboard());
  } catch (err) {
    console.error('Ошибка playbot:', err);
    ctx.reply('❌ Не удалось начать игру');
  }
});

// Обработка выстрелов
bot.action(/^shoot_/, async (ctx) => {
  const coord = ctx.match[0].replace('shoot_', '');
  const letter = coord[0];
  const x = parseInt(coord.slice(1)) - 1;
  const y = LETTERS.indexOf(letter);
  
  try {
    const gameRes = await pool.query(
      `SELECT * FROM games 
       WHERE (player1_id = $1 OR player2_id = $1) 
       AND status = 'active' 
       AND current_player = $1`,
      [ctx.from.id]
    );
    
    if (!gameRes.rows.length) {
      return ctx.answerCbQuery('❌ Сейчас не ваш ход');
    }
    
    const game = gameRes.rows[0];
    const isPlayer1 = game.player1_id === ctx.from.id;
    const opponentField = isPlayer1 ? game.player2_field : game.player1_field;
    const playerShots = isPlayer1 ? game.player1_shots : game.player2_shots;
    
    if (playerShots[coord]) {
      return ctx.answerCbQuery('❌ Вы уже стреляли сюда');
    }
    
    const isHit = opponentField[y][x] === 1;
    const newShots = { ...playerShots, [coord]: isHit ? 'hit' : 'miss' };
    
    await pool.query(
      `UPDATE games 
       SET ${isPlayer1 ? 'player1_shots' : 'player2_shots'} = $1,
           current_player = ${isPlayer1 ? 0 : game.player1_id}
       WHERE game_id = $2`,
      [newShots, game.game_id]
    );
    
    await ctx.answerCbQuery(isHit ? '💥 Попадание!' : '🌊 Мимо!');
    await ctx.editMessageReplyMarkup(generateShootingKeyboard(newShots).reply_markup);
    
    // Проверка победы и ход бота
    if (isPlayer1 && await checkWin(newShots, opponentField)) {
      await endGame(ctx, game.game_id, ctx.from.id);
    } else if (isPlayer1) {
      await botTurn(ctx, game.game_id);
    }
  } catch (err) {
    console.error('Ошибка shoot:', err);
    ctx.answerCbQuery('❌ Ошибка при выстреле');
  }
});

// Ход бота
async function botTurn(ctx, gameId) {
  const gameRes = await pool.query(
    'SELECT * FROM games WHERE game_id = $1',
    [gameId]
  );
  const game = gameRes.rows[0];
  
  const shots = game.player2_shots || {};
  const field = game.player1_field;
  
  let x, y, coord;
  do {
    x = Math.floor(Math.random() * 10);
    y = Math.floor(Math.random() * 10);
    coord = `${LETTERS[y]}${x + 1}`;
  } while (shots[coord]);
  
  const isHit = field[y][x] === 1;
  const newShots = { ...shots, [coord]: isHit ? 'hit' : 'miss' };
  
  await pool.query(
    `UPDATE games 
     SET player2_shots = $1,
         current_player = $2
     WHERE game_id = $3`,
    [newShots, game.player1_id, gameId]
  );
  
  if (await checkWin(newShots, field)) {
    await endGame(ctx, gameId, 0);
  } else {
    await ctx.telegram.sendMessage(
      game.player1_id,
      `🤖 Бот выстрелил в ${coord} - ${isHit ? '💥 Попадание!' : '🌊 Мимо!'}\nВаш ход:`,
      generateShootingKeyboard(game.player1_shots)
    );
  }
}

// Проверка победы
async function checkWin(shots, field) {
  let hits = 0;
  let ships = 0;
  
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (field[y][x] === 1) ships++;
      const coord = `${LETTERS[y]}${x + 1}`;
      if (shots[coord] === 'hit') hits++;
    }
  }
  
  return hits === ships;
}

// Завершение игры
async function endGame(ctx, gameId, winnerId) {
  const gameRes = await pool.query(
    'SELECT * FROM games WHERE game_id = $1',
    [gameId]
  );
  const game = gameRes.rows[0];
  
  await pool.query(
    'UPDATE games SET status = $1 WHERE game_id = $2',
    ['finished', gameId]
  );
  
  if (winnerId === 0) {
    await ctx.telegram.sendMessage(
      game.player1_id,
      '😢 Вы проиграли! Бот победил.'
    );
  } else {
    await ctx.telegram.sendMessage(
      winnerId,
      '🎉 Вы победили!'
    );
    if (game.player2_id !== 0) {
      await ctx.telegram.sendMessage(
        game.player1_id === winnerId ? game.player2_id : game.player1_id,
        '😢 Вы проиграли!'
      );
    }
  }
}

// Запуск сервера
app.use(express.json());
app.use(bot.webhookCallback('/webhook'));

app.get('/', (req, res) => res.send('Морской бот работает!'));

app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  try {
    await initBot();
    console.log('🤖 Бот готов к работе!');
  } catch (err) {
    console.error('❌ Ошибка запуска:', err);
  }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
