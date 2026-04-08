const { Telegraf, Markup } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
    console.error('❌ BOT_TOKEN не найден!');
    process.exit(1);
}

const bot = new Telegraf(TOKEN);

// ========== КОНФИГУРАЦИЯ ==========
const ADMINS = {
    owner: {
        name: '👑 Владелец',
        level: 5,
        permissions: ['all'],
        users: [5005387093]
    },
    admin: {
        name: '⚙️ Администратор',
        level: 4,
        permissions: ['ban', 'unban', 'give_money', 'announce', 'set_admin', 'set_vip'],
        users: []
    },
    moderator: {
        name: '🛡️ Модератор',
        level: 3,
        permissions: ['ban', 'unban', 'warn'],
        users: []
    },
    support: {
        name: '🎧 Поддержка',
        level: 2,
        permissions: ['help_users'],
        users: []
    }
};

const BUSINESSES = {
    1: { name: '🏪 Ларёк', income: 50, upgradeCost: 500, emoji: '🏪', defense: 5 },
    2: { name: '🏬 Магазин', income: 150, upgradeCost: 2000, emoji: '🏬', defense: 10 },
    3: { name: '🏢 Супермаркет', income: 400, upgradeCost: 8000, emoji: '🏢', defense: 15 },
    4: { name: '🏙️ ТЦ', income: 1000, upgradeCost: 30000, emoji: '🏙️', defense: 20 },
    5: { name: '🌆 Корпорация', income: 2500, upgradeCost: 100000, emoji: '🌆', defense: 30 },
    6: { name: '🌍 Империя', income: 6000, upgradeCost: 500000, emoji: '🌍', defense: 40 },
    7: { name: '🚀 Космическая', income: 15000, upgradeCost: 2000000, emoji: '🚀', defense: 50 },
    8: { name: '✨ Божественная', income: 50000, upgradeCost: 5000000, emoji: '✨', defense: 70 },
    9: { name: '👑 Легендарная', income: 150000, upgradeCost: 15000000, emoji: '👑', defense: 100 },
    10: { name: '💎 Абсолют', income: 500000, upgradeCost: null, emoji: '💎', defense: 150 }
};

const UPGRADES = {
    manager: { name: '👔 Менеджер', cost: 2000, incomeBonus: 0.20, defenseBonus: 5 },
    advertising: { name: '📢 Реклама', cost: 1500, incomeBonus: 0.15, defenseBonus: 0 },
    security: { name: '🛡️ Охрана', cost: 3000, incomeBonus: 0, defenseBonus: 20 },
    marketing: { name: '📊 Маркетинг', cost: 5000, incomeBonus: 0.25, defenseBonus: 0 },
    armored: { name: '🚛 Бронированный', cost: 10000, incomeBonus: 0, defenseBonus: 40 },
    hacker: { name: '💻 Хакер', cost: 15000, incomeBonus: 0, attackBonus: 30 }
};

const VIP_STATUSES = {
    bronze: { name: '🥉 Бронза', price: 50000, bonusIncome: 5, bonusDefense: 10, emoji: '🥉' },
    silver: { name: '🥈 Серебро', price: 150000, bonusIncome: 10, bonusDefense: 20, emoji: '🥈' },
    gold: { name: '🥇 Золото', price: 500000, bonusIncome: 20, bonusDefense: 35, emoji: '🥇' },
    platinum: { name: '💎 Платина', price: 1500000, bonusIncome: 35, bonusDefense: 50, emoji: '💎' },
    diamond: { name: '✨ Алмаз', price: 5000000, bonusIncome: 50, bonusDefense: 75, emoji: '✨' }
};

// ========== НОВАЯ СИСТЕМА 1: КЛЕШНИ (NFT) ==========
const CLAWS = {
    1: { name: '🦀 Клешня новичка', rarity: 'common', price: 1000, attackBonus: 5, defenseBonus: 5, emoji: '🦀' },
    2: { name: '🦞 Стальная клешня', rarity: 'rare', price: 5000, attackBonus: 15, defenseBonus: 10, emoji: '🦞' },
    3: { name: '🦂 Золотая клешня', rarity: 'epic', price: 25000, attackBonus: 30, defenseBonus: 25, emoji: '🦂' },
    4: { name: '🐉 Драконья клешня', rarity: 'legendary', price: 100000, attackBonus: 60, defenseBonus: 50, emoji: '🐉' },
    5: { name: '👑 Королевская клешня', rarity: 'mythic', price: 500000, attackBonus: 120, defenseBonus: 100, emoji: '👑' },
    6: { name: '✨ Божественная клешня', rarity: 'divine', price: 2500000, attackBonus: 250, defenseBonus: 200, emoji: '✨' }
};

const RARITY_COLORS = {
    common: '⚪',
    rare: '🔵',
    epic: '🟣',
    legendary: '🟠',
    mythic: '🔴',
    divine: '🌈'
};

// ========== НОВАЯ СИСТЕМА 2: КОЛЛЕКЦИИ ==========
const COLLECTIONS = {
    pirate: {
        name: '🏴‍☠️ ПИРАТСКАЯ КОЛЛЕКЦИЯ',
        items: ['🗡️ Пиратский меч', '🏴‍☠️ Череп', '⚓ Якорь', '📜 Карта сокровищ'],
        reward: 50000,
        bonus: 'Пиратская удача +15% к доходу'
    },
    magic: {
        name: '🔮 МАГИЧЕСКАЯ КОЛЛЕКЦИЯ',
        items: ['🔮 Хрустальный шар', '⚡ Волшебная палочка', '📖 Книга заклинаний', '🧪 Зелье мудрости'],
        reward: 75000,
        bonus: 'Магическая защита +20% к защите'
    },
    space: {
        name: '🚀 КОСМИЧЕСКАЯ КОЛЛЕКЦИЯ',
        items: ['🛸 Летающая тарелка', '⭐ Звезда', '🌙 Лунный камень', '☄️ Метеорит'],
        reward: 100000,
        bonus: 'Космическая атака +25% к атаке'
    }
};

// ========== БАЗА ДАННЫХ ==========
const db = new sqlite3.Database('business.db');

db.serialize(() => {
    // Пользователи
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE,
        balance INTEGER DEFAULT 1000,
        business_level INTEGER DEFAULT 1,
        last_collect TEXT,
        total_earned INTEGER DEFAULT 0,
        total_collects INTEGER DEFAULT 0,
        manager INTEGER DEFAULT 0,
        advertising INTEGER DEFAULT 0,
        security INTEGER DEFAULT 0,
        marketing INTEGER DEFAULT 0,
        armored INTEGER DEFAULT 0,
        hacker INTEGER DEFAULT 0,
        last_daily TEXT,
        streak INTEGER DEFAULT 0,
        attacks_won INTEGER DEFAULT 0,
        defenses_won INTEGER DEFAULT 0,
        vip_level TEXT DEFAULT 'none',
        banned INTEGER DEFAULT 0,
        warn_count INTEGER DEFAULT 0,
        register_date TEXT,
        equipped_claw INTEGER DEFAULT 0
    )`);
    
    // Клешни (инвентарь)
    db.run(`CREATE TABLE IF NOT EXISTS user_claws (
        user_id INTEGER,
        claw_id INTEGER,
        quantity INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, claw_id)
    )`);
    
    // Коллекции
    db.run(`CREATE TABLE IF NOT EXISTS user_collections (
        user_id INTEGER,
        collection_id TEXT,
        items_collected INTEGER DEFAULT 0,
        completed INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, collection_id)
    )`);
    
    // Админы
    db.run(`CREATE TABLE IF NOT EXISTS admins (
        user_id INTEGER PRIMARY KEY,
        role TEXT DEFAULT 'helper',
        appointed_by INTEGER,
        appointed_at TEXT
    )`);
    
    // Добавляем владельца
    db.run(`INSERT OR IGNORE INTO admins (user_id, role, appointed_by, appointed_at) 
            VALUES (5005387093, 'owner', 5005387093, datetime('now'))`);
});

// ========== ФУНКЦИИ ==========
function getDb() { return db; }

async function getUser(userId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE user_id = ?', [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

async function getUserById(id) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

async function getGameId(userId) {
    const user = await getUser(userId);
    return user ? user.id : null;
}

async function registerUser(userId) {
    const existing = await getUser(userId);
    if (existing) return existing.id;
    
    return new Promise((resolve, reject) => {
        const now = new Date().toISOString();
        db.run(`INSERT INTO users (user_id, last_collect, last_daily, register_date) 
                VALUES (?, ?, ?, ?)`, [userId, now, now, now], function(err) {
            if (err) reject(err);
            else {
                if (this.lastID === 1) {
                    db.run('UPDATE users SET balance = 1000000 WHERE user_id = ?', [userId]);
                }
                resolve(this.lastID);
            }
        });
    });
}

async function updateBalance(userId, amount) {
    const user = await getUser(userId);
    if (!user) return;
    
    return new Promise((resolve, reject) => {
        db.run('UPDATE users SET balance = balance + ?, total_earned = total_earned + ? WHERE user_id = ?',
            [amount, Math.max(amount, 0), userId], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

async function addClaw(userId, clawId, quantity = 1) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT OR REPLACE INTO user_claws (user_id, claw_id, quantity) 
                VALUES (?, ?, COALESCE((SELECT quantity FROM user_claws WHERE user_id = ? AND claw_id = ?), 0) + ?)`,
                [userId, clawId, userId, clawId, quantity], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

async function getUserClaws(userId) {
    return new Promise((resolve, reject) => {
        db.all('SELECT claw_id, quantity FROM user_claws WHERE user_id = ?', [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function equipClaw(userId, clawId) {
    return new Promise((resolve, reject) => {
        db.run('UPDATE users SET equipped_claw = ? WHERE user_id = ?', [clawId, userId], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

async function getAdminRole(userId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT role FROM admins WHERE user_id = ?', [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row ? row.role : null);
        });
    });
}

async function hasPermission(userId, permission) {
    const role = await getAdminRole(userId);
    if (!role) return false;
    const roleData = ADMINS[role];
    if (!roleData) return false;
    return roleData.permissions.includes('all') || roleData.permissions.includes(permission);
}

function calculateIncome(user) {
    const level = user.business_level;
    const business = BUSINESSES[level];
    let multiplier = 1.0;
    
    if (user.manager) multiplier += 0.20;
    if (user.advertising) multiplier += 0.15;
    if (user.marketing) multiplier += 0.25;
    
    if (user.vip_level !== 'none' && VIP_STATUSES[user.vip_level]) {
        multiplier += VIP_STATUSES[user.vip_level].bonusIncome / 100;
    }
    
    return Math.floor(business.income * multiplier);
}

function calculateDefense(user) {
    const level = user.business_level;
    let defense = BUSINESSES[level].defense;
    
    if (user.manager) defense += 5;
    if (user.security) defense += 20;
    if (user.armored) defense += 40;
    
    if (user.vip_level !== 'none' && VIP_STATUSES[user.vip_level]) {
        defense += VIP_STATUSES[user.vip_level].bonusDefense;
    }
    
    // Бонус от экипированной клешни
    if (user.equipped_claw && CLAWS[user.equipped_claw]) {
        defense += CLAWS[user.equipped_claw].defenseBonus;
    }
    
    return defense;
}

function calculateAttack(user) {
    let attack = 10 + (user.business_level * 3);
    if (user.hacker) attack += 30;
    
    // Бонус от экипированной клешни
    if (user.equipped_claw && CLAWS[user.equipped_claw]) {
        attack += CLAWS[user.equipped_claw].attackBonus;
    }
    
    return attack;
}

// ========== КЛАВИАТУРА ==========
function mainKeyboard() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('💰 Баланс', 'balance'), Markup.button.callback('🏪 Бизнес', 'business')],
        [Markup.button.callback('💼 Собрать', 'collect'), Markup.button.callback('📈 Магазин', 'upgrades')],
        [Markup.button.callback('⚔️ Атака', 'attack'), Markup.button.callback('🛡️ Защита', 'protect')],
        [Markup.button.callback('🎁 Бонус', 'daily'), Markup.button.callback('👑 VIP', 'vip')],
        [Markup.button.callback('🦀 Клешни', 'claws'), Markup.button.callback('📦 Коллекции', 'collections')],
        [Markup.button.callback('📊 Топ', 'top'), Markup.button.callback('ℹ️ Помощь', 'help')]
    ]);
}

// ========== КОМАНДЫ ==========
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const gameId = await registerUser(userId);
    const user = await getUser(userId);
    
    const text = `🦀 *CRYPTO EMPIRE: БИТВА КЛЕШНЕЙ* 🦀\n\n` +
                 `✨ *Твой ID:* #${gameId}\n` +
                 `💰 *Баланс:* ${user.balance.toLocaleString()} монет\n\n` +
                 `📌 *Любую команду можно вводить без /*\n` +
                 `🔥 *Доступные команды:*\n` +
                 `• баланс, б, деньги - баланс\n` +
                 `• бизнес, биз - бизнес\n` +
                 `• собрать - доход каждые 15 мин\n` +
                 `• атака @ник - атаковать\n` +
                 `• защита 24 - купить защиту\n` +
                 `• клешни - твои клешни\n` +
                 `• коллекции - коллекции\n` +
                 `• топ - топ игроков\n` +
                 `• гет @ник - информация\n` +
                 `• админ - админ панель\n\n` +
                 `👇 *Используй кнопки!*`;
    
    await ctx.reply(text, { parse_mode: 'Markdown', ...mainKeyboard() });
});

// Функция для обработки любой команды без /
async function handleAnyCommand(ctx, commandName, args) {
    const userId = ctx.from.id;
    
    switch(commandName) {
        case 'баланс': case 'б': case 'деньги': case 'balance':
            const user = await getUser(userId);
            if (!user) { await ctx.reply('❌ Напиши /start'); return; }
            const gameId = await getGameId(userId);
            await ctx.reply(`💰 *БАЛАНС*\n\n🆔 #${gameId}\n💵 ${user.balance.toLocaleString()} монет\n⚔️ Атак: ${user.attacks_won}\n🛡️ Защит: ${user.defenses_won}`, { parse_mode: 'Markdown', ...mainKeyboard() });
            break;
            
        case 'бизнес': case 'биз': case 'business':
            const userBiz = await getUser(userId);
            if (!userBiz) { await ctx.reply('❌ Напиши /start'); return; }
            const business = BUSINESSES[userBiz.business_level];
            const income = calculateIncome(userBiz);
            await ctx.reply(`${business.emoji} *${business.name}* (ур.${userBiz.business_level}/10)\n💵 Доход: ${income.toLocaleString()}\n⬆️ Апгрейд: ${business.upgradeCost?.toLocaleString() || 'MAX'}`, { parse_mode: 'Markdown' });
            break;
            
        case 'собрать': case 'collect':
            await ctx.reply('💼 Сбор дохода (скоро появится!)', { ...mainKeyboard() });
            break;
            
        case 'атака': case 'attack':
            if (args.length > 0) {
                await ctx.reply(`⚔️ Атака на ${args[0]} (в разработке)`);
            } else {
                await ctx.reply('❌ Использование: атака @username');
            }
            break;
            
        case 'защита': case 'protect':
            if (args.length > 0 && !isNaN(parseInt(args[0]))) {
                await ctx.reply(`🛡️ Защита куплена на ${args[0]} часов! (в разработке)`);
            } else {
                await ctx.reply('❌ Использование: защита 24');
            }
            break;
            
        case 'клешни': case 'claws':
            const userClaws = await getUser(userId);
            const claws = await getUserClaws(userId);
            let clawsText = `🦀 *ТВОИ КЛЕШНИ*\n\n`;
            if (claws.length === 0) {
                clawsText += `У тебя пока нет клешней!\nКупи в магазине: /магазин\n`;
            } else {
                for (const claw of claws) {
                    const clawData = CLAWS[claw.claw_id];
                    clawsText += `${RARITY_COLORS[clawData.rarity]} ${clawData.name} x${claw.quantity}\n`;
                }
                if (userClaws.equipped_claw) {
                    const equipped = CLAWS[userClaws.equipped_claw];
                    clawsText += `\n✨ *Экипировано:* ${equipped.name}`;
                }
            }
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('🎒 Магазин клешней', 'shop_claws')],
                [Markup.button.callback('⚔️ Экипировать', 'equip_menu')],
                [Markup.button.callback('🔙 Назад', 'back')]
            ]);
            await ctx.reply(clawsText, { parse_mode: 'Markdown', ...keyboard });
            break;
            
        case 'коллекции': case 'collections':
            let collectionsText = `📦 *КОЛЛЕКЦИИ*\n\nСобирай предметы и получай бонусы!\n\n`;
            for (const [id, col] of Object.entries(COLLECTIONS)) {
                collectionsText += `${col.name}\n`;
                collectionsText += `📜 Предметы: ${col.items.join(', ')}\n`;
                collectionsText += `🏆 Награда: ${col.reward.toLocaleString()} монет\n`;
                collectionsText += `✨ Бонус: ${col.bonus}\n\n`;
            }
            await ctx.reply(collectionsText, { parse_mode: 'Markdown', ...mainKeyboard() });
            break;
            
        case 'топ': case 'top':
            db.all('SELECT id, balance FROM users ORDER BY balance DESC LIMIT 10', (err, rows) => {
                if (err) return;
                let text = '🏆 *ТОП 10 БОГАЧЕЙ* 🏆\n\n';
                rows.forEach((row, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '📌';
                    text += `${medal} #${row.id} — ${row.balance.toLocaleString()} монет\n`;
                });
                ctx.reply(text, { parse_mode: 'Markdown' });
            });
            break;
            
        case 'гет': case 'get': case 'info':
            if (args.length > 0) {
                const target = args[0];
                let userInfo;
                if (target.startsWith('@')) {
                    try {
                        const chat = await ctx.telegram.getChat(target);
                        userInfo = await getUser(chat.id);
                        if (userInfo) {
                            const gid = await getGameId(chat.id);
                            await ctx.reply(`📊 *ИНФО*\n🆔 #${gid}\n💰 Баланс: ${userInfo.balance.toLocaleString()}\n🏪 Уровень: ${userInfo.business_level}/10`, { parse_mode: 'Markdown' });
                        } else {
                            await ctx.reply('❌ Игрок не найден');
                        }
                    } catch(e) { await ctx.reply('❌ Пользователь не найден'); }
                } else if (/^\d+$/.test(target)) {
                    userInfo = await getUserById(parseInt(target));
                    if (userInfo) {
                        await ctx.reply(`📊 *ИНФО*\n🆔 #${target}\n💰 Баланс: ${userInfo.balance.toLocaleString()}\n🏪 Уровень: ${userInfo.business_level}/10`, { parse_mode: 'Markdown' });
                    } else {
                        await ctx.reply('❌ Игрок не найден');
                    }
                }
            } else {
                await ctx.reply('❌ Использование: гет @username или гет 15');
            }
            break;
            
        case 'админ': case 'ahelp': case 'ахелп': case 'акмд':
            const role = await getAdminRole(userId);
            if (!role) {
                await ctx.reply('❌ Нет прав!');
                return;
            }
            const roleData = ADMINS[role];
            let adminText = `🛡️ *АДМИН ПАНЕЛЬ*\n👑 Роль: ${roleData.name}\n\n📋 Команды:\n`;
            if (roleData.permissions.includes('all') || roleData.permissions.includes('ban')) adminText += `• забанить @ник - бан\n`;
            if (roleData.permissions.includes('all') || roleData.permissions.includes('give_money')) adminText += `• выдать @ник сумма - выдать монеты\n`;
            if (roleData.permissions.includes('all') || roleData.permissions.includes('announce')) adminText += `• объявить текст - объявление\n`;
            if (roleData.permissions.includes('all') || roleData.permissions.includes('set_admin')) adminText += `• назначить @ник роль - назначить админа\n`;
            await ctx.reply(adminText, { parse_mode: 'Markdown' });
            break;
            
        case 'забанить': case 'ban':
            if (!await hasPermission(userId, 'ban')) { await ctx.reply('❌ Нет прав'); return; }
            if (args.length > 0) {
                await ctx.reply(`✅ Игрок ${args[0]} забанен (демо)`);
            } else {
                await ctx.reply('❌ Использование: забанить @ник');
            }
            break;
            
        case 'выдать': case 'give':
            if (!await hasPermission(userId, 'give_money')) { await ctx.reply('❌ Нет прав'); return; }
            if (args.length >= 2) {
                await ctx.reply(`✅ Выдано ${args[1]} монет игроку ${args[0]} (демо)`);
            } else {
                await ctx.reply('❌ Использование: выдать @ник сумма');
            }
            break;
            
        case 'объявить': case 'announce':
            if (!await hasPermission(userId, 'announce')) { await ctx.reply('❌ Нет прав'); return; }
            if (args.length > 0) {
                const msg = args.join(' ');
                await ctx.reply(`📢 ОБЪЯВЛЕНИЕ: ${msg}`);
            } else {
                await ctx.reply('❌ Использование: объявить текст');
            }
            break;
            
        case 'назначить': case 'setadmin':
            if (!await hasPermission(userId, 'set_admin')) { await ctx.reply('❌ Нет прав'); return; }
            if (args.length >= 2) {
                await ctx.reply(`✅ Игрок ${args[0]} назначен на роль ${args[1]} (демо)`);
            } else {
                await ctx.reply('❌ Использование: назначить @ник роль');
            }
            break;
            
        case 'помощь': case 'help': case 'хелп':
            await ctx.reply(`📚 *ПОМОЩЬ*\n\n` +
                `💰 баланс, б - баланс\n` +
                `🏪 бизнес, биз - бизнес\n` +
                `💼 собрать - доход\n` +
                `⚔️ атака @ник - атака\n` +
                `🛡️ защита 24 - защита\n` +
                `🦀 клешни - твои клешни\n` +
                `📦 коллекции - коллекции\n` +
                `📊 топ - топ игроков\n` +
                `🔍 гет @ник - информация\n` +
                `🛡️ админ - админ панель\n` +
                `🎁 магазин - магазин\n\n` +
                `*Любую команду можно вводить без /*`, { parse_mode: 'Markdown' });
            break;
            
        case 'магазин': case 'shop':
            let shopText = `🎒 *МАГАЗИН КЛЕШНЕЙ*\n\n`;
            for (const [id, claw] of Object.entries(CLAWS)) {
                const rarityColor = RARITY_COLORS[claw.rarity];
                shopText += `${rarityColor} *${claw.name}*\n`;
                shopText += `💰 Цена: ${claw.price.toLocaleString()} монет\n`;
                shopText += `⚔️ +${claw.attackBonus} атаки | 🛡️ +${claw.defenseBonus} защиты\n`;
                shopText += `📦 Редкость: ${claw.rarity}\n\n`;
            }
            const shopKeyboard = Markup.inlineKeyboard([
                [Markup.button.callback('🛒 Купить клешню 1', 'buy_claw_1')],
                [Markup.button.callback('🛒 Купить клешню 2', 'buy_claw_2')],
                [Markup.button.callback('🛒 Купить клешню 3', 'buy_claw_3')],
                [Markup.button.callback('🛒 Купить клешню 4', 'buy_claw_4')],
                [Markup.button.callback('🔙 Назад', 'back')]
            ]);
            await ctx.reply(shopText, { parse_mode: 'Markdown', ...shopKeyboard });
            break;
            
        default:
            // Игнорируем неизвестные команды
            break;
    }
}

// ========== КНОПКИ ==========
bot.action('balance', async (ctx) => {
    const userId = ctx.from.id;
    const user = await getUser(userId);
    const gameId = await getGameId(userId);
    await ctx.editMessageText(`💰 *БАЛАНС*\n\n🆔 #${gameId}\n💵 ${user?.balance.toLocaleString() || 0} монет`, { parse_mode: 'Markdown', ...mainKeyboard() });
    await ctx.answerCbQuery();
});

bot.action('claws', async (ctx) => {
    const userId = ctx.from.id;
    const claws = await getUserClaws(userId);
    let text = `🦀 *ТВОИ КЛЕШНИ*\n\n`;
    if (claws.length === 0) {
        text += `У тебя пока нет клешней!\nКупи в магазине: /магазин`;
    } else {
        for (const claw of claws) {
            const clawData = CLAWS[claw.claw_id];
            text += `${RARITY_COLORS[clawData.rarity]} ${clawData.name} x${claw.quantity}\n`;
        }
    }
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🎒 Магазин', 'shop_menu')],
        [Markup.button.callback('🔙 Назад', 'back')]
    ]);
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard });
    await ctx.answerCbQuery();
});

bot.action('shop_menu', async (ctx) => {
    let text = `🎒 *МАГАЗИН КЛЕШНЕЙ*\n\n`;
    for (const [id, claw] of Object.entries(CLAWS)) {
        text += `${RARITY_COLORS[claw.rarity]} *${claw.name}*\n💰 ${claw.price.toLocaleString()} монет\n⚔️ +${claw.attackBonus} | 🛡️ +${claw.defenseBonus}\n\n`;
    }
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🛒 Купить 1', 'buy_claw_1'), Markup.button.callback('🛒 Купить 2', 'buy_claw_2')],
        [Markup.button.callback('🛒 Купить 3', 'buy_claw_3'), Markup.button.callback('🛒 Купить 4', 'buy_claw_4')],
        [Markup.button.callback('🛒 Купить 5', 'buy_claw_5'), Markup.button.callback('🛒 Купить 6', 'buy_claw_6')],
        [Markup.button.callback('🔙 Назад', 'claws')]
    ]);
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard });
    await ctx.answerCbQuery();
});

for (let i = 1; i <= 6; i++) {
    bot.action(`buy_claw_${i}`, async (ctx) => {
        const userId = ctx.from.id;
        const claw = CLAWS[i];
        const user = await getUser(userId);
        
        if (user.balance >= claw.price) {
            await updateBalance(userId, -claw.price);
            await addClaw(userId, i);
            await ctx.answerCbQuery(`✅ Куплено! +${claw.name}`);
            await ctx.editMessageText(`✅ *Покупка успешна!*\n\n${claw.name} добавлен в инвентарь!\n💰 Остаток: ${(user.balance - claw.price).toLocaleString()} монет`, { parse_mode: 'Markdown', ...mainKeyboard() });
        } else {
            await ctx.answerCbQuery(`❌ Не хватает ${(claw.price - user.balance).toLocaleString()} монет!`);
        }
    });
}

bot.action('back', async (ctx) => {
    await ctx.editMessageText('🏪 *ГЛАВНОЕ МЕНЮ*', { parse_mode: 'Markdown', ...mainKeyboard() });
    await ctx.answerCbQuery();
});

bot.action(['business', 'collect', 'upgrades', 'attack', 'protect', 'daily', 'vip', 'top', 'collections', 'help'], async (ctx) => {
    await ctx.answerCbQuery('🚧 В разработке!');
});

// ========== ОБРАБОТКА ЛЮБОГО ТЕКСТА БЕЗ / ==========
bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();
    const userId = ctx.from.id;
    
    // Пропускаем команды с /
    if (text.startsWith('/')) return;
    
    // Разбиваем на команду и аргументы
    const parts = text.toLowerCase().split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);
    
    // Список всех доступных команд
    const commands = [
        'баланс', 'б', 'деньги', 'balance',
        'бизнес', 'биз', 'business',
        'собрать', 'collect',
        'атака', 'attack',
        'защита', 'protect',
        'клешни', 'claws',
        'коллекции', 'collections',
        'топ', 'top',
        'гет', 'get', 'info',
        'админ', 'ahelp', 'ахелп', 'акмд',
        'забанить', 'ban',
        'выдать', 'give',
        'объявить', 'announce',
        'назначить', 'setadmin',
        'помощь', 'help', 'хелп',
        'магазин', 'shop'
    ];
    
    if (commands.includes(command)) {
        await handleAnyCommand(ctx, command, args);
    }
});

// ========== ЗАПУСК ==========
bot.launch().then(() => {
    console.log('🦀 CRYPTO EMPIRE: БИТВА КЛЕШНЕЙ ЗАПУЩЕН!');
    console.log('📡 Любую команду можно вводить без /');
    console.log('🎮 Добавлены системы: КЛЕШНИ и КОЛЛЕКЦИИ');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
