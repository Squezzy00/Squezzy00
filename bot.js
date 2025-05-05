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

// Улучшенный парсер даты с правильной проверкой времени
function parseDateTime(input) {
    input = input.trim();
    const now = new Date();
    
    // Формат "DD.MM.YYYY HH:mm" или "DD.MM.YYYY"
    const fullDateRegex = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?: (\d{1,2}):(\d{2}))?$/;
    if (fullDateRegex.test(input)) {
        const [, day, month, year, hours, minutes] = input.match(fullDateRegex);
        const fullYear = year.length === 2 ? 2000 + parseInt(year) : parseInt(year);
        const h = hours ? parseInt(hours) : 0;
        const m = minutes ? parseInt(minutes) : 0;
        
        const date = new Date(fullYear, parseInt(month)-1, parseInt(day), h, m);
        if (isNaN(date.getTime())) return null;
        return date;
    }
    
    // Формат "DD.MM HH:mm" или "DD.MM"
    const shortDateRegex = /^(\d{1,2})\.(\d{1,2})(?: (\d{1,2}):(\d{2}))?$/;
    if (shortDateRegex.test(input)) {
        const [, day, month, hours, minutes] = input.match(shortDateRegex);
        const year = now.getFullYear();
        const h = hours ? parseInt(hours) : 0;
        const m = minutes ? parseInt(minutes) : 0;
        
        const date = new Date(year, parseInt(month)-1, parseInt(day), h, m);
        if (isNaN(date.getTime())) return null;
        return date;
    }
    
    // Формат "HH:mm"
    const timeRegex = /^(\d{1,2}):(\d{2})$/;
    if (timeRegex.test(input)) {
        const [, hours, minutes] = input.match(timeRegex);
        const h = parseInt(hours);
        const m = parseInt(minutes);
        
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
        if (isNaN(date.getTime())) return null;
        return date < now ? new Date(date.setDate(date.getDate() + 1)) : date;
    }
    
    return null;
}

// Форматирование даты
function formatDate(date) {
    const pad = num => num.toString().padStart(2, '0');
    return `${pad(date.getDate())}.${pad(date.getMonth()+1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Команда /start
bot.command('start', (ctx) => {
    ctx.reply(
        '👋 Привет! Я бот-напоминалка.\n\n' +
        '📌 Доступные команды:\n' +
        '/timer - установить напоминание\n' +
        '/cancel - отменить напоминание\n' +
        '/see - показать кнопки (только для вас)\n' +
        '/stop - убрать кнопки\n\n' +
        'Примеры:\n' +
        '/timer 05.05.2025 14:00 Встреча\n' +
        '/timer 10.05 День рождения\n' +
        '/timer 18:00 Ужин'
    );
});

// Команда /timer
bot.command('timer', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 2) {
        return ctx.reply(
            '❌ Формат: /timer дата_время напоминание\n\n' +
            'Примеры:\n' +
            '/timer 04.05.2025 22:00 Встреча\n' +
            '/timer 10.05 День рождения\n' +
            '/timer 18:00 Ужин'
        );
    }

    let datetimeStr, text;
    for (let i = 1; i <= 2; i++) {
        const testStr = args.slice(0, i).join(' ');
        if (parseDateTime(testStr)) {
            datetimeStr = testStr;
            text = args.slice(i).join(' ');
            break;
        }
    }

    if (!datetimeStr) {
        return ctx.reply(
            '❌ Неверный формат даты. Используйте:\n' +
            '"DD.MM.YYYY HH:mm"\n' +
            '"DD.MM.YYYY"\n' +
            '"DD.MM HH:mm"\n' +
            '"DD.MM"\n' +
            '"HH:mm"'
        );
    }

    const datetime = parseDateTime(datetimeStr);
    const now = new Date();
    
    if (!datetime || isNaN(datetime.getTime())) {
        return ctx.reply('❌ Неверная дата или время!');
    }

    // Добавляем буфер в 1 минуту
    if (datetime <= new Date(now.getTime() + 60000)) {
        return ctx.reply('❌ Указанное время должно быть минимум на 1 минуту позже текущего!');
    }

    const timerId = timerCounter++;
    const timeout = datetime.getTime() - now.getTime();
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

    const timerInfo = {
        userId: ctx.from.id,
        text,
        datetime,
        chatId: ctx.chat.id
    };
    activeTimers.set(timerId, timerInfo);

    const timer = setTimeout(async () => {
        try {
            await ctx.telegram.sendMessage(
                timerInfo.chatId,
                `🔔 ${username}, Напоминание!\n\n` +
                `📌 Текст: ${timerInfo.text}\n` +
                `⏰ Время: ${formatDate(timerInfo.datetime)}`
            );
            activeTimers.delete(timerId);
        } catch (error) {
            console.error('Ошибка при отправке напоминания:', error);
            try {
                await ctx.telegram.sendMessage(
                    timerInfo.chatId,
                    '❌ Не удалось отправить напоминание!'
                );
            } catch (e) {}
        }
    }, timeout);

    timerInfo.timer = timer;
    activeTimers.set(timerId, timerInfo);

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

// Команда /see - только для отправителя
bot.command('see', (ctx) => {
    const buttonsText = ctx.message.text.split(' ').slice(1).join(' ');
    if (!buttonsText) {
        return ctx.reply(
            '❌ Укажите кнопки через запятую\n' +
            'Пример: /see Кнопка 1, Кнопка 2, Кнопка 3'
        ).catch(e => console.error('Ошибка:', e));
    }

    const buttons = buttonsText.split(',').map(btn => btn.trim()).filter(btn => btn);
    if (buttons.length === 0) {
        return ctx.reply('❌ Нет валидных кнопок').catch(e => console.error('Ошибка:', e));
    }

    const keyboard = Markup.keyboard(
        buttons.map(btn => [btn])
    ).resize().oneTime().selective();

    ctx.reply('Выберите действие:', {
        reply_markup: keyboard.reply_markup,
        chat_id: ctx.chat.id,
        message_id: ctx.message.message_id
    }).then(() => {
        activeKeyboards.set(ctx.from.id, keyboard);
    }).catch(e => console.error('Ошибка при отправке клавиатуры:', e));
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

// Обработка текстовых сообщений (для кнопок)
bot.on('text', (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    
    if (activeKeyboards.has(ctx.from.id)) {
        console.log(`Пользователь ${ctx.from.id} нажал: ${ctx.message.text}`);
        // Можно добавить логику обработки нажатий
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
