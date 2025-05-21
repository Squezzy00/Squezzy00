require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
const BOT_OWNER_ID = 5005387093; // Ваш ID
let timerCounter = 1;

// Хранилища данных
const activeKeyboards = new Map();
const activeTimers = new Map();
const chatButtons = new Map();
const disabledCommands = new Set();
const groupChats = new Set(); // Для хранения ID групповых чатов

// Сохраняем ID групповых чатов при получении сообщений
bot.on('message', (ctx) => {
    if (ctx.chat.type !== 'private') {
        groupChats.add(ctx.chat.id);
    }
});

// Проверка владельца
function isOwner(ctx) {
    return ctx.from.id === BOT_OWNER_ID;
}

function escapeText(text) {
    return text ? text.toString() : '';
}

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

// Проверка отключенных команд
bot.use((ctx, next) => {
    if (ctx.message?.text?.startsWith('/')) {
        const command = ctx.message.text.split(' ')[0].slice(1).toLowerCase();
        if (disabledCommands.has(command) && !isOwner(ctx)) {
            return ctx.reply(`❌ Команда /${command} временно отключена\n\nDEVELOPER: @SQUEZZY00`);
        }
    }
    return next();
});

// Стартовое сообщение
bot.start((ctx) => {
    const username = ctx.message.from.username ? `@${ctx.message.from.username}` : ctx.message.from.first_name;
    ctx.reply(
        `🕰️ Привет, ${username}, Я бот-напоминалка!\n\n` +
        `✨ Основные команды:\n` +
        `/1с Напомни через 1 секунду\n` +
        `/5м Напомни через 5 минут\n` +
        `/2ч Напомни через 2 часа\n` +
        `/3д Напомни через 3 дня\n\n` +
        `/see Кнопки - создать клавиатуру\n` +
        `/open - открыть общие кнопки\n` +
        `/stop - скрыть клавиатуру\n\n` +
        `DEVELOPER: @SQUEZZY00`
    ).catch(e => console.error('Start error:', e));
});

// Рассылка в группы
bot.command('broadcast', async (ctx) => {
    if (!isOwner(ctx)) return ctx.reply('❌ Только для владельца\n\nDEVELOPER: @SQUEZZY00');

    const messageText = ctx.message.text.split(' ').slice(1).join(' ');
    if (!messageText) return ctx.reply('❌ Укажите текст\nПример: /broadcast Текст\n\nDEVELOPER: @SQUEZZY00');

    if (groupChats.size === 0) {
        return ctx.reply('❌ Бот еще не добавлен ни в одну группу\n\nDEVELOPER: @SQUEZZY00');
    }

    let successCount = 0;
    const failedChats = [];

    for (const chatId of groupChats) {
        try {
            await ctx.telegram.sendMessage(
                chatId,
                `📢 Рассылка от администратора:\n\n${messageText}\n\nDEVELOPER: @SQUEZZY00`
            );
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 300));
        } catch (e) {
            console.error(`Ошибка в чате ${chatId}:`, e);
            failedChats.push(chatId);
            groupChats.delete(chatId);
        }
    }

    ctx.reply(
        `✅ Рассылка завершена!\n` +
        `Успешно: ${successCount} чатов\n` +
        `Не удалось: ${failedChats.length}\n\n` +
        `DEVELOPER: @SQUEZZY00`
    );
});

// Создание клавиатуры
bot.command('see', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1).join(' ').split(',');
    if (!args.length) {
        return ctx.reply(
            '❌ Укажите кнопки через запятую\n' +
            'Пример: /see Да, Нет\n\n' +
            'DEVELOPER: @SQUEZZY00'
        );
    }

    const buttons = args.map(b => b.trim()).filter(b => b);
    const buttonRows = [];
    for (let i = 0; i < buttons.length; i += 4) {
        buttonRows.push(buttons.slice(i, i + 4));
    }

    const keyboard = Markup.keyboard(buttonRows).resize();
    activeKeyboards.set(ctx.from.id, keyboard);

    ctx.reply(
        '⌨️ Клавиатура создана:\n\nDEVELOPER: @SQUEZZY00',
        { reply_markup: keyboard.reply_markup }
    ).catch(e => console.error('Keyboard error:', e));
});

// Таймеры
bot.hears(/^\/(\d+)(с|м|ч|д)\s+(.+)$/, async (ctx) => {
    const amount = parseInt(ctx.match[1]);
    const unit = ctx.match[2];
    const text = ctx.match[3];
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const timerId = timerCounter++;

    const timeMap = {
        'с': 1000,
        'м': 60000,
        'ч': 3600000,
        'д': 86400000
    };

    const ms = amount * (timeMap[unit] || 0);
    if (!ms) return ctx.reply('❌ Неверное время\n\nDEVELOPER: @SQUEZZY00');

    try {
        await ctx.reply(
            `⏳ Таймер №${timerId} установлен!\n` +
            `⏱️ Через: ${getTimeString(amount, unit)}\n` +
            `📝 Текст: ${text}\n\n` +
            `DEVELOPER: @SQUEZZY00`
        );

        const timeout = setTimeout(async () => {
            try {
                await ctx.telegram.sendMessage(
                    chatId,
                    `🔔 Таймер №${timerId}!\n` +
                    `📌 Напоминание: ${text}\n\n` +
                    `DEVELOPER: @SQUEZZY00`,
                    Markup.inlineKeyboard([
                        Markup.button.callback('🔄 Повторить', `restart_${amount}${unit}_${text}`)
                    ])
                );
                activeTimers.delete(timerId);
            } catch (e) {
                console.error('Timer error:', e);
            }
        }, ms);

        activeTimers.set(timerId, {
            userId, chatId, amount, unit, text, timeout
        });
    } catch (e) {
        console.error('Set timer error:', e);
    }
});

// Управление клавиатурой
bot.command('stop', (ctx) => {
    if (activeKeyboards.has(ctx.from.id)) {
        ctx.reply('✅ Клавиатура скрыта\n\nDEVELOPER: @SQUEZZY00', {
            reply_markup: { remove_keyboard: true }
        });
        activeKeyboards.delete(ctx.from.id);
    } else {
        ctx.reply('❌ Нет активной клавиатуры\n\nDEVELOPER: @SQUEZZY00');
    }
});

// Повтор таймера
bot.action(/^restart_/, async (ctx) => {
    await ctx.answerCbQuery('⏳ Таймер установлен');
    ctx.replyWithMarkdown(
        `🔁 Таймер повторен!\n` +
        `Напоминание: ${ctx.match[0].split('_')[2]}\n\n` +
        `DEVELOPER: @SQUEZZY00`
    );
});

// Запуск бота с вебхуком
bot.launch({
    webhook: {
        domain: process.env.WEBHOOK_URL,
        port: process.env.PORT || 3000
    }
}).then(() => console.log('Бот запущен через вебхук'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
