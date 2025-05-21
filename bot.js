require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
let timerCounter = 1;
const activeKeyboards = new Map();
const activeTimers = new Map(); // Хранилище активных таймеров

// Упрощенная функция экранирования
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

// Стартовое сообщение
bot.start((ctx) => {
    const username = ctx.message.from.username ? `@${ctx.message.from.username}` : ctx.message.from.first_name;
    ctx.reply(
        `🕰️ Привет, ${username}, Я бот-напоминалка!\n\n` +
        `✨ Как пользоваться:\n` +
        `/1с Напомни мне - через 1 секунду\n` +
        `/5м Позвонить другу - через 5 минут\n` +
        `/2ч Принять лекарство - через 2 часа\n` +
        `/3д Оплатить счёт - через 3 дня\n\n` +
        `📝 Пример: /10м Проверить почту\n\n` +
        `🆕 Новые команды:\n` +
        `/see Кнопка1, Кнопка2 - показать клавиатуру\n` +
        `/stop - скрыть свою клавиатуру\n` +
        `/timers - показать активные таймеры\n` +
        `/cancel [ID] - отменить таймер\n\n` +
        `DEVELOPER: @SQUEZZY00`
    ).catch(e => console.error('Ошибка при отправке start:', e));
});

// Команда /see - создает постоянную клавиатуру
bot.command('see', (ctx) => {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ').slice(1).join(' ').split(',');

    if (args.length === 0 || args[0].trim() === '') {
        return ctx.reply(
            '❌ Неверный формат команды\n' +
            '✨ Используйте: /see Кнопка1, Кнопка2, Кнопка3\n' +
            '🔹 Пример: /see Да, Нет, Возможно\n\n' +
            'DEVELOPER: @SQUEZZY00'
        ).catch(e => console.error('Ошибка при отправке see:', e));
    }

    const buttons = args.map(btn => btn.trim()).filter(btn => btn !== '');
    const keyboard = Markup.keyboard(buttons.map(btn => [btn]))
        .resize()
        .selective();

    activeKeyboards.set(userId, keyboard);

    ctx.reply('Ваша клавиатура открыта и готова к использованию:\n\nDEVELOPER: @SQUEZZY00', {
        reply_markup: keyboard.reply_markup,
        reply_to_message_id: ctx.message.message_id
    }).catch(e => console.error('Ошибка при отправке клавиатуры:', e));
});

// Команда для просмотра активных таймеров
bot.command('timers', (ctx) => {
    const userId = ctx.from.id;
    const userTimers = Array.from(activeTimers.entries())
        .filter(([_, timer]) => timer.userId === userId);

    if (userTimers.length === 0) {
        return ctx.reply('У вас нет активных таймеров.\n\nDEVELOPER: @SQUEZZY00')
            .catch(e => console.error('Ошибка при отправке timers:', e));
    }

    let message = '⏳ Ваши активные таймеры:\n\n';
    userTimers.forEach(([timerId, timer]) => {
        message += `🆔 ID: ${timerId}\n` +
                  `📝 Текст: ${timer.text}\n` +
                  `⏱️ Осталось: ${getTimeString(timer.amount, timer.unit)}\n\n`;
    });
    message += 'Для отмены используйте /cancel [ID]\n\nDEVELOPER: @SQUEZZY00';

    ctx.reply(message).catch(e => console.error('Ошибка при отправке списка таймеров:', e));
});

// Команда для отмены таймера
bot.command('cancel', (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('❌ Укажите ID таймера для отмены\nПример: /cancel 5\n\nDEVELOPER: @SQUEZZY00')
            .catch(e => console.error('Ошибка при отправке cancel:', e));
    }

    const timerId = parseInt(args[1]);
    if (isNaN(timerId)) {
        return ctx.reply('❌ Неверный ID таймера\n\nDEVELOPER: @SQUEZZY00')
            .catch(e => console.error('Ошибка при отправке cancel:', e));
    }

    const timer = activeTimers.get(timerId);
    if (!timer || timer.userId !== ctx.from.id) {
        return ctx.reply('❌ Таймер не найден или не принадлежит вам\n\nDEVELOPER: @SQUEZZY00')
            .catch(e => console.error('Ошибка при отправке cancel:', e));
    }

    clearTimeout(timer.timeout);
    activeTimers.delete(timerId);
    ctx.reply(`✅ Таймер #${timerId} отменен\n\nDEVELOPER: @SQUEZZY00`)
        .catch(e => console.error('Ошибка при отправке подтверждения отмены:', e));
});

// Обработчик напоминаний
bot.hears(/^\/(\d+)(с|м|ч|д)\s+(.+)$/, async (ctx) => {
    const amount = parseInt(ctx.match[1]);
    const unit = ctx.match[2];
    const text = ctx.match[3];
    const userId = ctx.message.from.id;
    const chatId = ctx.message.chat.id;
    const username = ctx.message.from.username ? `@${ctx.message.from.username}` : ctx.message.from.first_name;
    const currentTimerNumber = timerCounter++;

    let milliseconds = 0;
    switch (unit) {
        case 'с': milliseconds = amount * 1000; break;
        case 'м': milliseconds = amount * 60 * 1000; break;
        case 'ч': milliseconds = amount * 60 * 60 * 1000; break;
        case 'д': milliseconds = amount * 24 * 60 * 60 * 1000; break;
    }

    if (milliseconds > 0) {
        const timeString = getTimeString(amount, unit);
        try {
            await ctx.reply(
                `⏳ ${username}, Таймер №${currentTimerNumber} установлен!\n` +
                `🔹 Текст: ${text}\n` +
                `⏱️ Сработает через: ${timeString}\n` +
                `🆔 ID таймера: ${currentTimerNumber}\n\n` +
                `DEVELOPER: @SQUEZZY00`
            );

            const timeout = setTimeout(async () => {
                try {
                    const keyboard = Markup.inlineKeyboard([
                        Markup.button.callback('🔄 Установить заново', `restart_${amount}${unit}_${text}`)
                    ]);
                    
                    await ctx.telegram.sendMessage(
                        chatId,
                        `🔔 ${username}, Таймер №${currentTimerNumber}!\n` +
                        `📌 Напоминание: ${text}\n` +
                        `🎉 Время пришло!\n\n` +
                        `DEVELOPER: @SQUEZZY00`,
                        { reply_markup: keyboard.reply_markup }
                    );
                    activeTimers.delete(currentTimerNumber);
                } catch (error) {
                    console.error('Ошибка при отправке напоминания:', error);
                }
            }, milliseconds);

            activeTimers.set(currentTimerNumber, {
                userId,
                chatId,
                amount,
                unit,
                text,
                timeout
            });
        } catch (e) {
            console.error('Ошибка при установке таймера:', e);
        }
    } else {
        ctx.reply('❌ Неверный формат времени. Используйте /1с, /5м, /2ч или /3д\n\nDEVELOPER: @SQUEZZY00')
           .catch(e => console.error('Ошибка при отправке ошибки таймера:', e));
    }
});

// Обработчик инлайн-кнопки "Установить заново"
bot.action(/^restart_(\d+)(с|м|ч|д)_(.+)$/, async (ctx) => {
    const amount = parseInt(ctx.match[1]);
    const unit = ctx.match[2];
    const text = ctx.match[3];
    const userId = ctx.from.id;
    const chatId = ctx.callbackQuery.message.chat.id;
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    const currentTimerNumber = timerCounter++;

    let milliseconds = 0;
    switch (unit) {
        case 'с': milliseconds = amount * 1000; break;
        case 'м': milliseconds = amount * 60 * 1000; break;
        case 'ч': milliseconds = amount * 60 * 60 * 1000; break;
        case 'д': milliseconds = amount * 24 * 60 * 60 * 1000; break;
    }

    if (milliseconds > 0) {
        const timeString = getTimeString(amount, unit);
        try {
            await ctx.reply(
                `⏳ ${username}, Таймер №${currentTimerNumber} установлен!\n` +
                `🔹 Текст: ${text}\n` +
                `⏱️ Сработает через: ${timeString}\n` +
                `🆔 ID таймера: ${currentTimerNumber}\n\n` +
                `DEVELOPER: @SQUEZZY00`
            );

            const timeout = setTimeout(async () => {
                try {
                    const keyboard = Markup.inlineKeyboard([
                        Markup.button.callback('🔄 Установить заново', `restart_${amount}${unit}_${text}`)
                    ]);
                    
                    await ctx.telegram.sendMessage(
                        chatId,
                        `🔔 ${username}, Таймер №${currentTimerNumber}!\n` +
                        `📌 Напоминание: ${text}\n` +
                        `🎉 Время пришло!\n\n` +
                        `DEVELOPER: @SQUEZZY00`,
                        { reply_markup: keyboard.reply_markup }
                    );
                    activeTimers.delete(currentTimerNumber);
                } catch (error) {
                    console.error('Ошибка при отправке напоминания:', error);
                }
            }, milliseconds);

            activeTimers.set(currentTimerNumber, {
                userId,
                chatId,
                amount,
                unit,
                text,
                timeout
            });

            await ctx.answerCbQuery('✅ Таймер установлен заново');
        } catch (e) {
            console.error('Ошибка при установке таймера:', e);
            await ctx.answerCbQuery('❌ Ошибка при установке таймера');
        }
    }
});

// Остальной код без изменений...
// (обработчик текста, обработка ошибок, запуск бота)

// Обработчик нажатий на кнопки (не скрывает клавиатуру)
bot.on('text', (ctx) => {
    const text = ctx.message.text;
    const userId = ctx.from.id;

    if (text.startsWith('/')) return;

    if (activeKeyboards.has(userId)) {
        console.log(`Пользователь ${userId} нажал: ${text}`);
    }
});

// Обработка ошибок
bot.catch((err, ctx) => {
    console.error(`Ошибка для ${ctx.updateType}`, err);
});

// Запуск бота
const PORT = process.env.PORT || 3000;
bot.launch({
    webhook: process.env.RENDER ? {
        domain: process.env.WEBHOOK_URL,
        port: PORT
    } : undefined
})
.then(() => console.log('Бот успешно запущен'))
.catch(e => console.error('Ошибка при запуске бота:', e));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
