require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { DateTime } = require('luxon');
const timezone = 'Europe/Moscow'; // Московское время

const bot = new Telegraf(process.env.BOT_TOKEN);
let timerCounter = 1;
const activeKeyboards = new Map();
const activeTimers = new Map(); // Хранит все активные таймеры

// Функция для экранирования текста
function escapeText(text) {
    return text ? text.toString() : '';
}

// Функция для парсинга даты и времени
function parseDateTime(input, ctx) {
    try {
        const now = DateTime.now().setZone(timezone);
        let datetime;

        if (input.includes('.')) {
            // Форматы: "DD.MM.YYYY HH:mm" или "DD.MM HH:mm"
            const [datePart, timePart] = input.split(' ');
            const [day, month, year] = datePart.split('.');
            
            datetime = DateTime.fromObject({
                day: parseInt(day),
                month: parseInt(month),
                year: year ? parseInt(year) : now.year,
                hour: parseInt(timePart.split(':')[0]),
                minute: parseInt(timePart.split(':')[1]),
                zone: timezone
            });
        } else {
            // Формат "HH:mm"
            const [hours, minutes] = input.split(':');
            datetime = DateTime.fromObject({
                hour: parseInt(hours),
                minute: parseInt(minutes),
                zone: timezone
            }).set({
                day: now.day,
                month: now.month,
                year: now.year
            });
            
            // Если время уже прошло сегодня, ставим на завтра
            if (datetime < now) {
                datetime = datetime.plus({ days: 1 });
            }
        }
        
        if (!datetime.isValid) {
            ctx.reply(`❌ Неверный формат даты/времени. Используйте:\n` +
                     `"DD.MM.YYYY HH:mm"\n"DD.MM HH:mm"\n"HH:mm"`);
            return null;
        }
        
        return datetime;
    } catch (e) {
        ctx.reply(`❌ Ошибка парсинга даты. Используйте:\n` +
                 `"DD.MM.YYYY HH:mm"\n"DD.MM HH:mm"\n"HH:mm"`);
        return null;
    }
}

// Стартовое сообщение
bot.start((ctx) => {
    const username = ctx.message.from.username ? `@${ctx.message.from.username}` : ctx.message.from.first_name;
    ctx.reply(
        `🕰️ Привет, ${username}, Я бот-напоминалка!\n\n` +
        `✨ Как пользоваться:\n\n` +
        `⏰ Установка таймеров:\n` +
        `/timer 25.12.2023 20:00 Поздравить с Рождеством\n` +
        `/timer 15.08 12:00 Обед\n` +
        `/timer 18:30 Звонок маме\n` +
        `/cancel 123 - отменить таймер №123\n\n` +
        `⏱ Быстрые напоминания:\n` +
        `/1с Напомни мне - через 1 секунду\n` +
        `/5м Позвонить другу - через 5 минут\n` +
        `/2ч Принять лекарство - через 2 часа\n` +
        `/3д Оплатить счёт - через 3 дня\n\n` +
        `🆕 Другие команды:\n` +
        `/see Кнопка1, Кнопка2 - показать клавиатуру\n` +
        `/stop - скрыть свою клавиатуру`
    ).catch(e => console.error('Ошибка при отправке start:', e));
});

// Команда /see - создает клавиатуру
bot.command('see', (ctx) => {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ').slice(1).join(' ').split(',');

    if (args.length === 0 || args[0].trim() === '') {
        return ctx.reply(
            '❌ Неверный формат команды\n' +
            '✨ Используйте: /see Кнопка1, Кнопка2, Кнопка3\n' +
            '🔹 Пример: /see Да, Нет, Возможно'
        ).catch(e => console.error('Ошибка при отправке see:', e));
    }

    const buttons = args.map(btn => btn.trim()).filter(btn => btn !== '');
    const keyboard = Markup.keyboard(buttons.map(btn => [btn]))
        .resize()
        .selective();

    activeKeyboards.set(userId, keyboard);

    ctx.reply('Ваша клавиатура готова к использованию:', {
        reply_markup: keyboard.reply_markup,
        reply_to_message_id: ctx.message.message_id
    }).catch(e => console.error('Ошибка при отправке клавиатуры:', e));
});

// Команда /stop - скрывает клавиатуру
bot.command('stop', (ctx) => {
    const userId = ctx.from.id;

    if (activeKeyboards.has(userId)) {
        ctx.reply('Клавиатура скрыта', {
            reply_markup: { remove_keyboard: true },
            reply_to_message_id: ctx.message.message_id
        }).then(() => {
            activeKeyboards.delete(userId);
        }).catch(e => console.error('Ошибка при скрытии клавиатуры:', e));
    } else {
        ctx.reply('У вас нет активной клавиатуры. Сначала используйте /see', {
            reply_to_message_id: ctx.message.message_id
        }).catch(e => console.error('Ошибка при отправке stop:', e));
    }
});

// Команда /timer - установка таймера по дате/времени
bot.command('timer', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 2) {
        return ctx.reply('❌ Используйте: /timer дата_время напоминание\n' +
                       'Примеры:\n' +
                       '/timer 25.12.2023 20:00 Поздравить с Рождеством\n' +
                       '/timer 15.08 12:00 Обед\n' +
                       '/timer 18:30 Звонок маме');
    }

    const datetimeStr = args[0] + ' ' + args[1];
    const text = args.slice(2).join(' ');
    const datetime = parseDateTime(datetimeStr, ctx);
    
    if (!datetime) return;

    const now = DateTime.now().setZone(timezone);
    const diff = datetime.diff(now).as('milliseconds');

    if (diff <= 0) {
        return ctx.reply('❌ Указанное время уже прошло!');
    }

    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    const timerId = timerCounter++;

    const timer = setTimeout(async () => {
        try {
            await ctx.telegram.sendMessage(
                chatId,
                `🔔 ${username}, Напоминание!\n` +
                `📌 ${text}\n` +
                `⏰ Запланировано на ${datetime.setZone(timezone).toFormat('dd.MM.yyyy HH:mm')}`
            );
            activeTimers.delete(timerId);
        } catch (error) {
            console.error('Ошибка при отправке напоминания:', error);
        }
    }, diff);

    // Сохраняем таймер
    activeTimers.set(timerId, {
        timer,
        userId,
        chatId,
        text,
        datetime: datetime.toISO()
    });

    ctx.reply(
        `⏳ ${username}, Таймер №${timerId} установлен!\n` +
        `📌 Текст: ${text}\n` +
        `⏱️ Сработает: ${datetime.setZone(timezone).toFormat('dd.MM.yyyy HH:mm')}\n` +
        `🆔 ID таймера: ${timerId}\n\n` +
        `Для отмены используйте: /cancel ${timerId}`
    ).catch(e => console.error('Ошибка при установке таймера:', e));
});

// Команда /cancel - отмена таймера
bot.command('cancel', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length === 0) {
        return ctx.reply('❌ Укажите ID таймера для отмены\n' +
                        'Пример: /cancel 123');
    }

    const timerId = parseInt(args[0]);
    if (isNaN(timerId)) {
        return ctx.reply('❌ Неверный ID таймера. Укажите число');
    }

    if (activeTimers.has(timerId)) {
        const timerData = activeTimers.get(timerId);
        if (timerData.userId !== ctx.from.id) {
            return ctx.reply('❌ Вы можете отменять только свои таймеры');
        }

        clearTimeout(timerData.timer);
        activeTimers.delete(timerId);
        ctx.reply(`✅ Таймер №${timerId} отменен:\n"${timerData.text}"`)
           .catch(e => console.error('Ошибка при отмене таймера:', e));
    } else {
        ctx.reply('❌ Таймер с таким ID не найден')
           .catch(e => console.error('Ошибка при отмене таймера:', e));
    }
});

// Обработчик быстрых напоминаний (Nс, Nм, Nч, Nд)
bot.hears(/^\/(\d+)(с|м|ч|д)\s+(.+)$/, async (ctx) => {
    const amount = parseInt(ctx.match[1]);
    const unit = ctx.match[2];
    const text = ctx.match[3];
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    const timerId = timerCounter++;

    let milliseconds = 0;
    switch (unit) {
        case 'с': milliseconds = amount * 1000; break;
        case 'м': milliseconds = amount * 60 * 1000; break;
        case 'ч': milliseconds = amount * 60 * 60 * 1000; break;
        case 'д': milliseconds = amount * 24 * 60 * 60 * 1000; break;
    }

    if (milliseconds > 0) {
        const now = DateTime.now().setZone(timezone);
        const triggerTime = now.plus({ milliseconds });

        const timer = setTimeout(async () => {
            try {
                await ctx.telegram.sendMessage(
                    chatId,
                    `🔔 ${username}, Напоминание!\n` +
                    `📌 ${text}\n` +
                    `⏰ Запланировано на ${now.toFormat('dd.MM.yyyy HH:mm')}`
                );
                activeTimers.delete(timerId);
            } catch (error) {
                console.error('Ошибка при отправке напоминания:', error);
            }
        }, milliseconds);

        // Сохраняем таймер
        activeTimers.set(timerId, {
            timer,
            userId,
            chatId,
            text,
            datetime: triggerTime.toISO()
        });

        ctx.reply(
            `⏳ ${username}, Таймер №${timerId} установлен!\n` +
            `📌 Текст: ${text}\n` +
            `⏱️ Сработает через: ${amount} ${unit}\n` +
            `🕒 Время срабатывания: ${triggerTime.toFormat('dd.MM.yyyy HH:mm')}\n` +
            `🆔 ID таймера: ${timerId}\n\n` +
            `Для отмены используйте: /cancel ${timerId}`
        ).catch(e => console.error('Ошибка при установке таймера:', e));
    } else {
        ctx.reply('❌ Неверный формат времени. Используйте /1с, /5м, /2ч или /3д')
           .catch(e => console.error('Ошибка при отправке:', e));
    }
});

// Обработчик нажатий на кнопки
bot.on('text', (ctx) => {
    const text = ctx.message.text;
    const userId = ctx.from.id;

    if (text.startsWith('/')) return;

    if (activeKeyboards.has(userId)) {
        console.log(`Пользователь ${userId} нажал: ${text}`);
        // Клавиатура остается активной
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
}).then(() => console.log('Бот успешно запущен'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
