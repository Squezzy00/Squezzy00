require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
let timerCounter = 1;
const activeKeyboards = new Map();
const activeTimers = new Map();

// Функция для экранирования MarkdownV2
function escapeMarkdown(text) {
    if (!text) return '';
    return text.toString()
        .replace(/\_/g, '\\_')
        .replace(/\*/g, '\\*')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/\~/g, '\\~')
        .replace(/\`/g, '\\`')
        .replace(/\>/g, '\\>')
        .replace(/\#/g, '\\#')
        .replace(/\+/g, '\\+')
        .replace(/\-/g, '\\-')
        .replace(/\=/g, '\\=')
        .replace(/\|/g, '\\|')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/\./g, '\\.')
        .replace(/\!/g, '\\!');
}

// Полностью переработанный парсер даты
function parseDateTime(input) {
    // Удаляем лишние пробелы
    input = input.trim();
    
    // Проверяем формат "DD.MM.YYYY HH:mm"
    const fullDateRegex = /^(\d{1,2})\.(\d{1,2})\.(\d{4}) (\d{1,2}):(\d{2})$/;
    if (fullDateRegex.test(input)) {
        const [, day, month, year, hours, minutes] = input.match(fullDateRegex);
        return new Date(year, month-1, day, hours, minutes);
    }
    
    // Проверяем формат "DD.MM HH:mm"
    const shortDateRegex = /^(\d{1,2})\.(\d{1,2}) (\d{1,2}):(\d{2})$/;
    if (shortDateRegex.test(input)) {
        const [, day, month, hours, minutes] = input.match(shortDateRegex);
        const year = new Date().getFullYear();
        return new Date(year, month-1, day, hours, minutes);
    }
    
    // Проверяем формат "HH:mm"
    const timeRegex = /^(\d{1,2}):(\d{2})$/;
    if (timeRegex.test(input)) {
        const [, hours, minutes] = input.match(timeRegex);
        const now = new Date();
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
        // Если время уже прошло, ставим на завтра
        return date < now ? new Date(date.setDate(date.getDate() + 1)) : date;
    }
    
    return null;
}

// Форматирование даты
function formatDate(date) {
    const pad = num => num.toString().padStart(2, '0');
    return `${pad(date.getDate())}.${pad(date.getMonth()+1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Команда /timer
bot.command('timer', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 2) {
        return ctx.reply(
            '❌ Формат: /timer дата_время напоминание\n\n' +
            'Примеры:\n' +
            '/timer 04.05.2025 22:00 Привет\n' +
            '/timer 10.05 15:30 Обед\n' +
            '/timer 18:00 Ужин'
        );
    }

    // Объединяем дату и время
    let datetimeStr, text;
    if (args[1].includes(':')) {
        datetimeStr = args[0];
        text = args.slice(1).join(' ');
    } else {
        datetimeStr = args[0] + ' ' + args[1];
        text = args.slice(2).join(' ');
    }

    const datetime = parseDateTime(datetimeStr);
    
    if (!datetime || isNaN(datetime.getTime())) {
        return ctx.reply(
            '❌ Неверный формат даты. Используйте:\n' +
            '"DD.MM.YYYY HH:mm"\n' +
            '"DD.MM HH:mm"\n' +
            '"HH:mm"'
        );
    }

    const now = new Date();
    if (datetime <= now) {
        return ctx.reply('❌ Указанное время уже прошло!');
    }

    const timerId = timerCounter++;
    const timeout = datetime.getTime() - now.getTime();
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

    const timer = setTimeout(async () => {
        try {
            await ctx.reply(
                `🔔 ${username}, Напоминание!\n\n` +
                `📌 Текст: ${text}\n` +
                `⏰ Время: ${formatDate(datetime)}`
            );
            activeTimers.delete(timerId);
        } catch (error) {
            console.error('Ошибка при отправке напоминания:', error);
        }
    }, timeout);

    activeTimers.set(timerId, { timer, userId: ctx.from.id, text, datetime });
    ctx.reply(
        `⏳ ${username}, Таймер №${timerId} установлен!\n\n` +
        `📌 Текст: ${text}\n` +
        `⏱ Сработает: ${formatDate(datetime)}\n` +
        `🆔 ID таймера: ${timerId}\n\n` +
        `Для отмены: /cancel ${timerId}`
    );
});


    
// Команда /cancel
bot.command('cancel', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (!args.length) {
        return ctx.replyWithMarkdownV2(
            '❌ Укажите ID таймера\nПример: `/cancel 123`',
            { parse_mode: 'MarkdownV2' }
        ).catch(e => console.error('Ошибка:', e));
    }

    const timerId = parseInt(args[0]);
    if (!activeTimers.has(timerId)) {
        return ctx.reply('❌ Таймер не найден').catch(e => console.error('Ошибка:', e));
    }

    const timer = activeTimers.get(timerId);
    if (timer.userId !== ctx.from.id) {
        return ctx.reply('❌ Вы можете отменять только свои таймеры').catch(e => console.error('Ошибка:', e));
    }

    clearTimeout(timer.timer);
    activeTimers.delete(timerId);
    ctx.replyWithMarkdownV2(
        `✅ *Таймер №${timerId} отменён\\!*\n\n` +
        `📌 *Текст:* ${escapeMarkdown(timer.text)}`,
        { parse_mode: 'MarkdownV2' }
    ).catch(e => console.error('Ошибка при отмене таймера:', e));
});

// Команда /see
bot.command('see', (ctx) => {
    const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',');
    if (!buttons.length) {
        return ctx.replyWithMarkdownV2(
            '❌ Укажите кнопки через запятую\nПример: `/see Кнопка1, Кнопка2`',
            { parse_mode: 'MarkdownV2' }
        ).catch(e => console.error('Ошибка:', e));
    }

    const keyboard = Markup.keyboard(
        buttons.map(btn => [btn.trim()])
    ).resize().selective();

    activeKeyboards.set(ctx.from.id, keyboard);
    ctx.reply('Выберите действие:', keyboard).catch(e => console.error('Ошибка при отправке клавиатуры:', e));
});

// Команда /stop
bot.command('stop', (ctx) => {
    if (activeKeyboards.has(ctx.from.id)) {
        ctx.reply('Клавиатура скрыта', Markup.removeKeyboard())
           .then(() => activeKeyboards.delete(ctx.from.id))
           .catch(e => console.error('Ошибка при скрытии клавиатуры:', e));
    } else {
        ctx.reply('Нет активной клавиатуры').catch(e => console.error('Ошибка:', e));
    }
});

// Обработка обычных сообщений
bot.on('text', (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    if (activeKeyboards.has(ctx.from.id)) {
        console.log(`Пользователь ${ctx.from.id} нажал: ${ctx.message.text}`);
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
}).then(() => console.log('Бот запущен'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
