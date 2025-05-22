require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

const bot = new Telegraf(process.env.BOT_TOKEN);
const BOT_OWNER_ID = 5005387093; // Ваш ID аккаунта
let timerCounter = 1;
const activeKeyboards = new Map();
const activeTimers = new Map();
const chatButtons = new Map();
const disabledCommands = new Set();
const reportBans = new Set(); // Для хранения забаненных пользователей
const activeReports = new Map(); // Для хранения активных репортов (userId -> message)

// Файл для хранения chat_id
const CHATS_FILE = path.join(__dirname, 'chats.json');
// Файл для хранения банов репортов
const BANS_FILE = path.join(__dirname, 'report_bans.json');

// Загрузка сохраненных данных
let knownChats = new Set();
let savedReportBans = new Set();

try {
    // Загрузка чатов
    if (fs.existsSync(CHATS_FILE)) {
        const data = fs.readFileSync(CHATS_FILE, 'utf-8');
        knownChats = new Set(JSON.parse(data));
    }
    
    // Загрузка банов
    if (fs.existsSync(BANS_FILE)) {
        const data = fs.readFileSync(BANS_FILE, 'utf-8');
        savedReportBans = new Set(JSON.parse(data));
        reportBans = new Set(savedReportBans);
    }
} catch (e) {
    console.error('Ошибка загрузки файлов:', e);
}

// Сохранение данных
function saveData() {
    try {
        fs.writeFileSync(CHATS_FILE, JSON.stringify([...knownChats]), 'utf-8');
        fs.writeFileSync(BANS_FILE, JSON.stringify([...reportBans]), 'utf-8');
    } catch (e) {
        console.error('Ошибка сохранения данных:', e);
    }
}

// Middleware для сохранения chat_id
bot.use((ctx, next) => {
    if (ctx.chat) {
        if (!knownChats.has(ctx.chat.id)) {
            knownChats.add(ctx.chat.id);
            saveData();
        }
    }
    return next();
});

// Проверка на владельца
function isOwner(ctx) {
    return ctx.from.id === BOT_OWNER_ID;
}

// Проверка на администратора чата
async function isAdmin(ctx) {
    if (ctx.chat.type === 'private') return false;
    try {
        const member = await ctx.getChatMember(ctx.from.id);
        return ['creator', 'administrator'].includes(member.status);
    } catch (e) {
        console.error('Ошибка проверки администратора:', e);
        return false;
    }
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

// Middleware для проверки отключенных команд
bot.use((ctx, next) => {
    if (ctx.message && ctx.message.text && ctx.message.text.startsWith('/')) {
        const command = ctx.message.text.split(' ')[0].slice(1).toLowerCase();
        if (disabledCommands.has(command) && !isOwner(ctx)) {
            return ctx.reply(`❌ Команда /${command} временно отключена`);
        }
    }
    return next();
});

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
        `/cancel [ID] - отменить таймер\n` +
        `/open - показать общие кнопки чата\n\n` +
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
    const buttonRows = [];
    for (let i = 0; i < buttons.length; i += 4) {
        buttonRows.push(buttons.slice(i, i + 4));
    }

    const keyboard = Markup.keyboard(buttonRows)
        .resize()
        .selective();

    activeKeyboards.set(userId, keyboard);

    ctx.reply('Ваша клавиатура открыта и готова к использованию:\n\nDEVELOPER: @SQUEZZY00', {
        reply_markup: keyboard.reply_markup,
        reply_to_message_id: ctx.message.message_id
    }).catch(e => console.error('Ошибка при отправке клавиатуры:', e));
});

// Команда для отключения команд
bot.command('cmdoff', (ctx) => {
    if (!isOwner(ctx)) {
        return ctx.reply('❌ Эта команда только для владельца бота');
    }

    const command = ctx.message.text.split(' ')[1];
    if (!command) {
        return ctx.reply('❌ Укажите команду для отключения\nПример: /cmdoff see');
    }

    disabledCommands.add(command);
    ctx.reply(`✅ Команда /${command} отключена`);
});

// Команда для включения команд
bot.command('cmdon', (ctx) => {
    if (!isOwner(ctx)) {
        return ctx.reply('❌ Эта команда только для владельца бота');
    }

    const command = ctx.message.text.split(' ')[1];
    if (!command) {
        return ctx.reply('❌ Укажите команду для включения\nПример: /cmdon see');
    }

    disabledCommands.delete(command);
    ctx.reply(`✅ Команда /${command} включена`);
});

// Команда для установки общих кнопок чата (доступна владельцу и админам чата)
bot.command('set', async (ctx) => {
    // Проверка прав (владелец или админ)
    const isAdminOrOwner = isOwner(ctx) || (ctx.chat.type !== 'private' && await isAdmin(ctx));
    
    if (!isAdminOrOwner) {
        return ctx.reply('❌ Эта команда только для владельца бота или администраторов чата');
    }

    const chatId = ctx.chat.id;
    const args = ctx.message.text.split(' ').slice(1).join(' ').split(',');
    
    if (args.length === 0 || args[0].trim() === '') {
        return ctx.reply(
            '❌ Неверный формат команды\n' +
            '✨ Используйте: /set Кнопка1, Кнопка2, Кнопка3\n' +
            '🔹 Пример: /set Да, Нет, Возможно'
        );
    }

    const buttons = args.map(btn => btn.trim()).filter(btn => btn !== '');
    const buttonRows = [];
    for (let i = 0; i < buttons.length; i += 4) {
        buttonRows.push(buttons.slice(i, i + 4));
    }

    chatButtons.set(chatId, buttonRows);
    ctx.reply(`✅ Кнопки для этого чата установлены (${buttons.length} кнопок)`);
});

// Команда для открытия общих кнопок чата
bot.command('open', (ctx) => {
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    
    if (!chatButtons.has(chatId)) {
        return ctx.reply('❌ Для этого чата не установлены общие кнопки');
    }

    const buttonRows = chatButtons.get(chatId);
    const keyboard = Markup.keyboard(buttonRows)
        .resize()
        .selective();

    activeKeyboards.set(userId, keyboard);

    ctx.reply('Общие кнопки чата:', {
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
        ctx.reply('У вас нет активной клавиатуры. Сначала используйте /see или /open', {
            reply_to_message_id: ctx.message.message_id
        }).catch(e => console.error('Ошибка при отправке stop:', e));
    }
});

// Команда /report - отправка сообщения владельцу
bot.command('report', async (ctx) => {
    const userId = ctx.from.id;
    
    // Проверка на бан
    if (reportBans.has(userId)) {
        return ctx.reply('❌ Вы заблокированы для отправки репортов');
    }

    const reportText = ctx.message.text.split(' ').slice(1).join(' ');
    if (!reportText) {
        return ctx.reply('❌ Укажите текст сообщения\nПример: /report Нашел баг в команде /timer');
    }

    try {
        // Сохраняем репорт для ответа
        activeReports.set(userId, {
            chatId: ctx.chat.id,
            messageId: ctx.message.message_id,
            text: reportText
        });

        // Отправляем владельцу
        await ctx.telegram.sendMessage(
            BOT_OWNER_ID,
            `🚨 Новый репорт от ${ctx.from.username || ctx.from.first_name} (ID: ${userId})\n` +
            `📝 Текст: ${reportText}\n\n` +
            `Ответить: /reply_${userId} ваш_ответ`,
            Markup.inlineKeyboard([
                Markup.button.callback('🔨 Забанить', `ban_${userId}`),
                Markup.button.callback('✅ Ответить', `replybtn_${userId}`)
            ])
        );

        await ctx.reply('✅ Ваше сообщение отправлено владельцу. Спасибо за обратную связь!');
    } catch (e) {
        console.error('Ошибка отправки репорта:', e);
        await ctx.reply('❌ Произошла ошибка при отправке сообщения');
    }
});

// Обработка ответов владельца на репорты
bot.hears(/^\/reply_(\d+)\s+(.+)/, async (ctx) => {
    if (!isOwner(ctx)) return;

    const userId = parseInt(ctx.match[1]);
    const replyText = ctx.match[2];
    const report = activeReports.get(userId);

    if (!report) {
        return ctx.reply('❌ Репорт не найден или устарел');
    }

    try {
        // Отправляем ответ пользователю
        await ctx.telegram.sendMessage(
            report.chatId,
            `📢 Ответ от владельца на ваш репорт:\n` +
            `"${report.text}"\n\n` +
            `💬 Ответ: ${replyText}`,
            { reply_to_message_id: report.messageId }
        );

        // Удаляем репорт из активных
        activeReports.delete(userId);
        await ctx.reply('✅ Ответ успешно отправлен');
    } catch (e) {
        console.error('Ошибка отправки ответа:', e);
        await ctx.reply('❌ Не удалось отправить ответ');
    }
});

// Инлайн кнопки для ответа/бана
bot.action(/^ban_(\d+)$/, async (ctx) => {
    if (!isOwner(ctx)) {
        await ctx.answerCbQuery('Только для владельца');
        return;
    }

    const userId = parseInt(ctx.match[1]);
    reportBans.add(userId);
    saveData();

    await ctx.answerCbQuery('Пользователь забанен');
    await ctx.editMessageText(
        ctx.callbackQuery.message.text + '\n\n🔨 Пользователь забанен для репортов',
        { reply_markup: Markup.inlineKeyboard([]) }
    );
});

bot.action(/^replybtn_(\d+)$/, async (ctx) => {
    if (!isOwner(ctx)) {
        await ctx.answerCbQuery('Только для владельца');
        return;
    }

    const userId = ctx.match[1];
    await ctx.answerCbQuery(`Используйте команду /reply_${userId} ваш_ответ`);
});

// Команда для разбана пользователя
bot.command('unban_report', async (ctx) => {
    if (!isOwner(ctx)) return;

    const userId = parseInt(ctx.message.text.split(' ')[1]);
    if (isNaN(userId)) {
        return ctx.reply('❌ Укажите ID пользователя\nПример: /unban_report 123456789');
    }

    if (reportBans.has(userId)) {
        reportBans.delete(userId);
        saveData();
        await ctx.reply(`✅ Пользователь ${userId} разбанен`);
    } else {
        await ctx.reply('ℹ️ Этот пользователь не забанен');
    }
});

// Команда /timers - просмотр активных таймеров
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

// Команда /cancel - отмена таймера
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

// Команда для рассылки сообщений
bot.command('broadcast', async (ctx) => {
    if (!isOwner(ctx)) {
        return ctx.reply('❌ Эта команда только для владельца бота');
    }

    const messageText = ctx.message.text.split(' ').slice(1).join(' ');
    if (!messageText) {
        return ctx.reply('❌ Укажите текст рассылки\nПример: /broadcast Важное сообщение для всех чатов');
    }

    try {
        const chats = [...knownChats];
        let successCount = 0;
        let failCount = 0;

        await ctx.reply(`⏳ Начинаю рассылку для ${chats.length} чатов...`);

        for (const chatId of chats) {
            try {
                await ctx.telegram.sendMessage(
                    chatId, 
                    `📢 Рассылка от администратора:\n\n${messageText}\n\nDEVELOPER: @SQUEZZY00`
                );
                successCount++;
                // Задержка чтобы не превысить лимиты Telegram
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error(`Ошибка при отправке в чат ${chatId}:`, error);
                failCount++;
                // Удаляем нерабочие chat_id из списка
                knownChats.delete(chatId);
            }
        }

        saveChats();
        await ctx.reply(`✅ Рассылка завершена\nУспешно: ${successCount}\nНе удалось: ${failCount}\nВсего чатов: ${knownChats.size}`);
    } catch (error) {
        console.error('Ошибка при выполнении рассылки:', error);
        ctx.reply('❌ Произошла ошибка при выполнении рассылки');
    }
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

// Обработчик текстовых сообщений (кнопок)
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

process.once('SIGINT', () => {
    saveChats();
    bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
    saveChats();
    bot.stop('SIGTERM');
});
