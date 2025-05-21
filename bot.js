require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

// Инициализация бота с проверкой токена
const bot = new Telegraf(process.env.BOT_TOKEN);
const BOT_OWNER_ID = 5005387093;

// Хранилища данных
const activeKeyboards = new Map();
const activeTimers = new Map();
const groupChats = new Set();

// Логирование входящих сообщений
bot.use((ctx, next) => {
    console.log(`[${new Date().toISOString()}] Update:`, ctx.updateType);
    return next();
});

// Обработчик всех сообщений для сбора групп
bot.on('message', (ctx) => {
    if (ctx.chat.type !== 'private') {
        groupChats.add(ctx.chat.id);
    }
});

// Проверка владельца
function isOwner(ctx) {
    return ctx.from && ctx.from.id === BOT_OWNER_ID;
}

// Форматирование времени
function getTimeString(amount, unit) {
    const units = {
        'с': ['секунду', 'секунды', 'секунд'],
        'м': ['минуту', 'минуты', 'минут'],
        'ч': ['час', 'часа', 'часов'],
        'д': ['день', 'дня', 'дней']
    };

    let word;
    if (amount % 10 === 1 && amount % 100 !== 11) {
        word = units[unit][0];
    } else if ([2, 3, 4].includes(amount % 10) && ![12, 13, 14].includes(amount % 100)) {
        word = units[unit][1];
    } else {
        word = units[unit][2];
    }

    return `${amount} ${word}`;
}

// Стартовое сообщение
bot.start((ctx) => {
    const name = ctx.from.first_name || ctx.from.username;
    return ctx.replyWithMarkdown(
        `Привет, ${name}! Я бот-напоминалка.\n\n` +
        `*Основные команды:*\n` +
        `/1с Напомнить через 1 секунду\n` +
        `/5м Напомнить через 5 минут\n` +
        `/see Кнопка1, Кнопка2 - создать клавиатуру\n` +
        `/stop - скрыть клавиатуру\n\n` +
        `Разработчик: @SQUEZZY00`
    );
});

// Рассылка в группы
bot.command('broadcast', async (ctx) => {
    if (!isOwner(ctx)) {
        return ctx.reply('❌ Только для владельца');
    }

    const text = ctx.message.text.split(' ').slice(1).join(' ');
    if (!text) return ctx.reply('Укажите текст для рассылки');

    let success = 0;
    for (const chatId of groupChats) {
        try {
            await bot.telegram.sendMessage(
                chatId, 
                `📢 Рассылка:\n${text}\n\n@SQUEZZY00`
            );
            success++;
            await new Promise(r => setTimeout(r, 300)); // Антифлуд
        } catch (e) {
            console.error(`Ошибка в чате ${chatId}:`, e);
        }
    }

    return ctx.reply(`✅ Отправлено в ${success} групп`);
});

// Создание клавиатуры
bot.command('see', (ctx) => {
    const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',')
        .map(b => b.trim())
        .filter(b => b);

    if (!buttons.length) {
        return ctx.reply('Укажите кнопки через запятую');
    }

    const keyboard = Markup.keyboard(
        buttons.reduce((rows, b, i) => {
            if (i % 4 === 0) rows.push([]);
            rows[rows.length-1].push(b);
            return rows;
        }, []),
        { columns: 4 }
    ).resize();

    activeKeyboards.set(ctx.from.id, keyboard);
    return ctx.reply('Клавиатура создана:', keyboard);
});

// Таймеры
bot.hears(/^\/(\d+)([смчд])\s+(.+)/i, async (ctx) => {
    const [, amountStr, unit, text] = ctx.match;
    const amount = parseInt(amountStr);
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    const timerId = Date.now();

    const multipliers = { с: 1, м: 60, ч: 3600, д: 86400 };
    const seconds = amount * multipliers[unit];
    if (!seconds) return ctx.reply('Неверный формат времени');

    await ctx.reply(
        `⏳ Таймер установлен на ${getTimeString(amount, unit)}\n` +
        `Текст: ${text}`
    );

    const timeout = setTimeout(async () => {
        try {
            await ctx.telegram.sendMessage(
                chatId,
                `🔔 Напоминание: ${text}`,
                Markup.inlineKeyboard([
                    Markup.button.callback('🔄 Повторить', `restart_${timerId}`)
                ])
            );
            activeTimers.delete(timerId);
        } catch (e) {
            console.error('Ошибка таймера:', e);
        }
    }, seconds * 1000);

    activeTimers.set(timerId, { timeout, userId });
});

// Остальные обработчики
bot.command('stop', (ctx) => {
    activeKeyboards.delete(ctx.from.id);
    return ctx.reply('Клавиатура скрыта', Markup.removeKeyboard());
});

bot.action(/^restart_/, async (ctx) => {
    await ctx.answerCbQuery('Таймер обновлён');
    // Логика повторения таймера
});

// Запуск бота
bot.launch().then(() => {
    console.log('Бот запущен');
    bot.telegram.sendMessage(BOT_OWNER_ID, 'Бот запущен').catch(console.error);
});

process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
