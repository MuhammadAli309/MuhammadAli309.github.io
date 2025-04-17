const venom = require('venom-bot');
const fs = require('fs');
const path = require('path');

// ===== CONFIGURATION =====
const CONFIG = {
  OWNER_NUMBER: "923440690209@c.us", // Correct format for your number
  COMMAND_GROUP_ID: "120363419580228015@g.us", // Group ID where commands will be sent
  TRIGGER_WORDS: ["service", "pin", "identity"],
  DATA_FOLDER: path.join(__dirname, 'bot_data'),
  MESSAGE_DELAY: 3000,
  SESSION_NAME: 'venom-bot-session'
};

// ===== SERVICE MESSAGE =====
const SERVICE_MESSAGE = `🌟 MY SERVICES 🌟\n
1. Adsense All Countries Identity & Pin Address Service Available\n\n
Countries We Cover:\n
🇬🇧 UK | 🇺🇸 USA | 🇨🇦 Canada | 🇦🇺 Australia\n
🇮🇪 Ireland | 🇧🇪 Belgium | 🇪🇸 Spain | 🇵🇰 Pakistan | 🇮🇳 India\n\n
📌 PKR 1500: UK, USA, Canada, Australia, Pakistan\n
📌 PKR 2500: India, Ireland, Belgium, Spain\n\n
Contact for quick service!`;

class WhatsAppBot {
  constructor() {
    this.client = null;
    this.isProcessing = false;
    this.groupLinks = new Set(); // To auto-save group links
  }

  // ===== INITIALIZATION =====
  async initialize() {
    try {
      this.cleanSession();
      this.ensureDataFolder();

      this.client = await venom.create({
        session: CONFIG.SESSION_NAME,
        headless: false,
        multidevice: true,
        disableWelcome: true,
        logQR: true,
        browserArgs: ['--no-sandbox', '--disable-extensions', '--disable-dev-shm-usage']
      });

      console.log('✅ Bot initialized successfully');
      this.setupEventHandlers();

    } catch (error) {
      console.error('❌ Initialization failed:', error);
      process.exit(1);
    }
  }

  // ===== CORE METHODS =====
  cleanSession() {
    try {
      const tokenPath = path.join(__dirname, 'tokens');
      if (fs.existsSync(tokenPath)) {
        fs.rmSync(tokenPath, { recursive: true, force: true });
      }
    } catch (err) {
      console.error('⚠️ Session cleanup error:', err.message);
    }
  }

  ensureDataFolder() {
    try {
      if (!fs.existsSync(CONFIG.DATA_FOLDER)) {
        fs.mkdirSync(CONFIG.DATA_FOLDER, { recursive: true });
      }
    } catch (err) {
      console.error('⚠️ Data folder error:', err.message);
    }
  }

  async safeSendMessage(chatId, content) {
    try {
      await this.client.sendText(chatId, content);
      await this.delay(CONFIG.MESSAGE_DELAY);
    } catch (error) {
      console.error('Message send error:', error.message);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===== MESSAGE HANDLING =====
  setupEventHandlers() {
    this.client.onMessage(async (message) => {
      console.log('Incoming Message:', {
        from: message.from,
        to: message.to,
        body: message.body,
        isGroupMsg: message.isGroupMsg
      });

      // Auto-save group links
      if (message.body && message.body.includes('chat.whatsapp.com')) {
        this.groupLinks.add(message.body.trim());
        console.log('Group link saved:', message.body.trim());
      }

      // Handle commands only in the specified group
      if (message.from === CONFIG.COMMAND_GROUP_ID || message.to === CONFIG.COMMAND_GROUP_ID) {
        console.log('Processing command in group:', CONFIG.COMMAND_GROUP_ID); // Debug log
        const body = message.body?.toLowerCase() || '';
        if (body.startsWith('!')) {
          await this.handleCommand(message);
        }
      }

      // Auto-reply to trigger words in private chats
      if (!message.isGroupMsg && CONFIG.TRIGGER_WORDS.some(word => message.body?.toLowerCase().includes(word))) {
        console.log('Trigger word detected in private chat:', message.body); // Debug log
        await this.safeSendMessage(message.from, SERVICE_MESSAGE);
      }
    });
  }

  async handleCommand(message) {
    const command = message.body.substring(1).split(' ')[0].toLowerCase();
    const args = message.body.split(' ').slice(1).join(' ');

    console.log(`Command received: ${command}, Arguments: ${args}`); // Debug log

    switch (command) {
      case 'help':
        await this.showHelp(message.from);
        break;

      case 'extract':
        await this.extractNumbers(message.from);
        break;

      case 'creategroup':
        await this.createGroup(message.from, args);
        break;

      case 'sendall':
        await this.sendToAllGroups(message.from);
        break;

      case 'clearall':
        await this.clearAllGroupChats(message.from);
        break;

      case 'showlinks':
        await this.showSavedLinks(message.from);
        break;

      default:
        console.log('Unknown command:', command); // Debug log
        await this.safeSendMessage(message.from, `❌ Unknown command: ${command}`);
    }
  }

  // ===== COMMAND IMPLEMENTATIONS =====
  async showHelp(chatId) {
    const helpText = `📱 *BOT COMMANDS* 📱\n` +
      `!help - Show this menu\n` +
      `!extract - Get numbers from all groups\n` +
      `!creategroup <name> - Create a group with extracted numbers\n` +
      `!sendall - Send a message to all groups\n` +
      `!clearall - Clear chats in all groups\n` +
      `!showlinks - Show all saved group links`;

    console.log('Sending help message to:', chatId); // Debug log
    await this.safeSendMessage(chatId, helpText);
  }

  async extractNumbers(chatId) {
    const chats = await this.client.getAllChats();
    const groups = chats.filter(chat => chat.isGroup);
    const allNumbers = new Set();

    console.log('Extracting numbers from groups...'); // Debug log

    for (const group of groups) {
      const members = await this.client.getGroupMembers(group.id._serialized);
      members.forEach(member => allNumbers.add(member.id.replace(/@.+/, '')));
    }

    const uniqueNumbers = Array.from(allNumbers);
    const filePath = path.join(CONFIG.DATA_FOLDER, 'extracted_numbers.txt');
    fs.writeFileSync(filePath, uniqueNumbers.join('\n'));

    console.log(`Extracted ${uniqueNumbers.length} numbers.`); // Debug log
    await this.safeSendMessage(chatId, `✅ Extracted ${uniqueNumbers.length} numbers. Saved to extracted_numbers.txt.`);
  }

  async createGroup(chatId, groupName) {
    if (!groupName) {
      console.log('No group name specified'); // Debug log
      return await this.safeSendMessage(chatId, '❌ Please specify a group name: !creategroup <name>');
    }

    const filePath = path.join(CONFIG.DATA_FOLDER, 'extracted_numbers.txt');
    if (!fs.existsSync(filePath)) {
      console.log('No extracted numbers found'); // Debug log
      return await this.safeSendMessage(chatId, '❌ No numbers found. Use !extract first.');
    }

    const numbers = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
    const participants = numbers.map(number => `${number}@c.us`);

    console.log(`Creating group "${groupName}" with ${participants.length} participants...`); // Debug log
    const group = await this.client.createGroup(groupName, participants);

    await this.safeSendMessage(chatId, `✅ Group "${groupName}" created successfully with ${participants.length} members.`);
  }

  async sendToAllGroups(chatId) {
    await this.safeSendMessage(chatId, '📩 Reply with the message you want to send to all groups:');
    this.client.once('message', async (reply) => {
      if (reply.from === CONFIG.COMMAND_GROUP_ID) {
        const chats = await this.client.getAllChats();
        const groups = chats.filter(chat => chat.isGroup);

        for (const group of groups) {
          console.log(`Sending message to group: ${group.id._serialized}`); // Debug log
          await this.safeSendMessage(group.id._serialized, reply.body);
        }

        await this.safeSendMessage(chatId, `✅ Message sent to ${groups.length} groups.`);
      }
    });
  }

  async clearAllGroupChats(chatId) {
    const chats = await this.client.getAllChats();
    const groups = chats.filter(chat => chat.isGroup);

    console.log('Clearing chats for all groups...'); // Debug log

    for (const group of groups) {
      await this.client.clearChat(group.id._serialized);
    }

    await this.safeSendMessage(chatId, `✅ Cleared chats in ${groups.length} groups.`);
  }

  async showSavedLinks(chatId) {
    const links = Array.from(this.groupLinks).join('\n');
    console.log('Showing saved links:', links); // Debug log
    await this.safeSendMessage(chatId, `📎 Saved Group Links:\n${links}`);
  }
}

// ===== START THE BOT =====
(async () => {
  const bot = new WhatsAppBot();
  await bot.initialize();
})();