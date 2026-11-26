const PY_BUILTINS = [
  { label: 'print',       detail: 'print(*objects, sep=" ", end="\\n")',         doc: 'Print objects to stdout.' },
  { label: 'len',         detail: 'len(obj) -> int',                             doc: 'Return the number of items in a container.' },
  { label: 'range',       detail: 'range(stop) | range(start, stop[, step])',    doc: 'Generate a sequence of numbers.' },
  { label: 'str',         detail: 'str(object="") -> str',                       doc: 'Create a new string object.' },
  { label: 'int',         detail: 'int(x=0) -> int',                             doc: 'Convert to integer.' },
  { label: 'float',       detail: 'float(x=0.0) -> float',                       doc: 'Convert to float.' },
  { label: 'bool',        detail: 'bool(x=False) -> bool',                       doc: 'Convert to boolean.' },
  { label: 'list',        detail: 'list(iterable=()) -> list',                   doc: 'Create a new list.' },
  { label: 'dict',        detail: 'dict(**kwargs) -> dict',                      doc: 'Create a new dictionary.' },
  { label: 'set',         detail: 'set(iterable=()) -> set',                     doc: 'Create a new set.' },
  { label: 'tuple',       detail: 'tuple(iterable=()) -> tuple',                 doc: 'Create a new tuple.' },
  { label: 'isinstance',  detail: 'isinstance(obj, classinfo) -> bool',          doc: 'Check object type.' },
  { label: 'enumerate',   detail: 'enumerate(iterable, start=0)',                doc: 'Pairs of (index, item).' },
  { label: 'zip',         detail: 'zip(*iterables)',                             doc: 'Zip iterables together.' },
  { label: 'map',         detail: 'map(func, *iterables)',                       doc: 'Apply function to each element.' },
  { label: 'filter',      detail: 'filter(func, iterable)',                      doc: 'Filter elements by predicate.' },
  { label: 'sorted',      detail: 'sorted(iterable, *, key=None, reverse=False)', doc: 'Return sorted list.' },
  { label: 'open',        detail: 'open(file, mode="r", encoding=None)',         doc: 'Open a file.' },
  { label: 'input',       detail: 'input(prompt="") -> str',                     doc: 'Read user input.' },
  { label: 'type',        detail: 'type(obj) -> type',                           doc: 'Return the type.' },
  { label: 'repr',        detail: 'repr(obj) -> str',                            doc: 'Canonical string representation.' },
  { label: 'abs',         detail: 'abs(x) -> number',                            doc: 'Absolute value.' },
  { label: 'min',         detail: 'min(*args, key=None)',                        doc: 'Smallest item.' },
  { label: 'max',         detail: 'max(*args, key=None)',                        doc: 'Largest item.' },
  { label: 'sum',         detail: 'sum(iterable, start=0)',                      doc: 'Sum of items.' },
  { label: 'any',         detail: 'any(iterable) -> bool',                       doc: 'True if any item is truthy.' },
  { label: 'all',         detail: 'all(iterable) -> bool',                       doc: 'True if all items are truthy.' },
  { label: 'getattr',     detail: 'getattr(obj, name[, default])',               doc: 'Get attribute by name.' },
  { label: 'setattr',     detail: 'setattr(obj, name, value)',                   doc: 'Set attribute by name.' },
  { label: 'hasattr',     detail: 'hasattr(obj, name) -> bool',                  doc: 'Check attribute existence.' },
];

const PY_KEYWORDS = [
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
  'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
  'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
  'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
  'match', 'case',
];

const AIOGRAM_API = [
  { label: 'Bot',                  kind: 'class',    detail: 'Bot(token: str, **kwargs)',                 doc: 'Telegram Bot API client.' },
  { label: 'Dispatcher',           kind: 'class',    detail: 'Dispatcher(**kwargs)',                       doc: 'Root dispatcher for incoming updates.' },
  { label: 'Router',               kind: 'class',    detail: 'Router(name: str = None)',                  doc: 'Sub-router for organizing handlers.' },
  { label: 'F',                    kind: 'variable', detail: 'aiogram.F',                                  doc: 'Magic filter factory: F.text == "hi"' },
  { label: 'types',                kind: 'module',   detail: 'aiogram.types',                              doc: 'Telegram object types.' },
  { label: 'filters',              kind: 'module',   detail: 'aiogram.filters',                            doc: 'Built-in filters (Command, CommandStart, ...).' },
  { label: 'Message',              kind: 'class',    detail: 'aiogram.types.Message',                      doc: 'Incoming message.' },
  { label: 'CallbackQuery',        kind: 'class',    detail: 'aiogram.types.CallbackQuery',                doc: 'Callback from inline button.' },
  { label: 'InlineKeyboardMarkup', kind: 'class',    detail: 'InlineKeyboardMarkup(inline_keyboard=...)',  doc: 'Inline keyboard.' },
  { label: 'InlineKeyboardButton', kind: 'class',    detail: 'InlineKeyboardButton(text, callback_data?)', doc: 'Inline button.' },
  { label: 'ReplyKeyboardMarkup',  kind: 'class',    detail: 'ReplyKeyboardMarkup(keyboard=...)',          doc: 'Reply keyboard.' },
  { label: 'KeyboardButton',       kind: 'class',    detail: 'KeyboardButton(text)',                       doc: 'Reply button.' },
  { label: 'FSInputFile',          kind: 'class',    detail: 'FSInputFile(path)',                          doc: 'File from filesystem.' },
  { label: 'Command',              kind: 'class',    detail: 'Command(commands, prefix="/")',              doc: 'Filter for commands.' },
  { label: 'CommandStart',         kind: 'class',    detail: 'CommandStart()',                             doc: 'Filter for /start.' },
  { label: 'StateFilter',          kind: 'class',    detail: 'StateFilter(*states)',                       doc: 'Filter by FSM state.' },
];

const BOT_METHODS = [
  { label: 'send_message',     detail: 'async send_message(chat_id, text, parse_mode=None, reply_markup=None)', doc: 'Send a text message.' },
  { label: 'send_photo',       detail: 'async send_photo(chat_id, photo, caption=None)',                       doc: 'Send a photo.' },
  { label: 'send_video',       detail: 'async send_video(chat_id, video, caption=None)',                       doc: 'Send a video.' },
  { label: 'send_audio',       detail: 'async send_audio(chat_id, audio, caption=None)',                       doc: 'Send an audio file.' },
  { label: 'send_document',    detail: 'async send_document(chat_id, document, caption=None)',                 doc: 'Send a document.' },
  { label: 'send_chat_action', detail: 'async send_chat_action(chat_id, action)',                              doc: 'Send chat action (typing, ...).' },
  { label: 'edit_message_text',detail: 'async edit_message_text(text, chat_id=None, message_id=None)',         doc: 'Edit message text.' },
  { label: 'delete_message',   detail: 'async delete_message(chat_id, message_id)',                            doc: 'Delete message.' },
  { label: 'answer_callback_query', detail: 'async answer_callback_query(callback_query_id, text=None)',       doc: 'Answer callback query.' },
  { label: 'get_me',           detail: 'async get_me() -> User',                                              doc: 'Get bot info.' },
  { label: 'get_chat',         detail: 'async get_chat(chat_id) -> Chat',                                     doc: 'Get chat info.' },
  { label: 'set_my_commands',  detail: 'async set_my_commands(commands)',                                      doc: 'Set bot commands.' },
];

const MESSAGE_METHODS = [
  { label: 'answer',           detail: 'async answer(text, parse_mode=None, reply_markup=None)',                  doc: 'Reply with a message in the same chat.' },
  { label: 'reply',            detail: 'async reply(text, parse_mode=None, reply_markup=None)',                   doc: 'Reply quoting this message.' },
  { label: 'answer_photo',     detail: 'async answer_photo(photo, caption=None)',                                  doc: 'Send a photo as reply.' },
  { label: 'answer_video',     detail: 'async answer_video(video, caption=None)',                                  doc: 'Send a video as reply.' },
  { label: 'answer_document',  detail: 'async answer_document(document, caption=None)',                            doc: 'Send a document as reply.' },
  { label: 'edit_text',        detail: 'async edit_text(text, parse_mode=None, reply_markup=None)',                doc: 'Edit this message text.' },
  { label: 'delete',           detail: 'async delete()',                                                            doc: 'Delete this message.' },
  { label: 'forward',          detail: 'async forward(chat_id)',                                                    doc: 'Forward to another chat.' },
  { label: 'text',             detail: 'str | None',                                                                doc: 'Message text.', kind: 'property' },
  { label: 'chat',             detail: 'Chat',                                                                      doc: 'Source chat.', kind: 'property' },
  { label: 'from_user',        detail: 'User | None',                                                               doc: 'Sender.', kind: 'property' },
  { label: 'message_id',       detail: 'int',                                                                       doc: 'Message ID.', kind: 'property' },
  { label: 'date',             detail: 'datetime',                                                                  doc: 'Date sent.', kind: 'property' },
  { label: 'photo',            detail: 'list[PhotoSize] | None',                                                    doc: 'Attached photo sizes.', kind: 'property' },
  { label: 'document',         detail: 'Document | None',                                                           doc: 'Attached document.', kind: 'property' },
  { label: 'video',            detail: 'Video | None',                                                              doc: 'Attached video.', kind: 'property' },
  { label: 'voice',            detail: 'Voice | None',                                                              doc: 'Attached voice.', kind: 'property' },
  { label: 'sticker',          detail: 'Sticker | None',                                                            doc: 'Attached sticker.', kind: 'property' },
  { label: 'contact',          detail: 'Contact | None',                                                            doc: 'Attached contact.', kind: 'property' },
  { label: 'location',         detail: 'Location | None',                                                           doc: 'Attached location.', kind: 'property' },
  { label: 'reply_to_message', detail: 'Message | None',                                                            doc: 'Replied-to message.', kind: 'property' },
];

const CALLBACK_METHODS = [
  { label: 'answer',     detail: 'async answer(text=None, show_alert=False)', doc: 'Acknowledge callback query.' },
  { label: 'data',       detail: 'str | None',                                doc: 'Callback data.', kind: 'property' },
  { label: 'message',    detail: 'Message | None',                            doc: 'Source message.', kind: 'property' },
  { label: 'from_user',  detail: 'User',                                      doc: 'User who clicked.', kind: 'property' },
];

const USER_PROPS = [
  { label: 'id',            detail: 'int',          doc: 'Telegram user ID.',     kind: 'property' },
  { label: 'is_bot',        detail: 'bool',         doc: 'Is this user a bot.',   kind: 'property' },
  { label: 'first_name',    detail: 'str',          doc: "User's first name.",    kind: 'property' },
  { label: 'last_name',     detail: 'str | None',   doc: "User's last name.",     kind: 'property' },
  { label: 'username',      detail: 'str | None',   doc: "User's @username.",     kind: 'property' },
  { label: 'language_code', detail: 'str | None',   doc: 'IETF language tag.',    kind: 'property' },
  { label: 'is_premium',    detail: 'bool | None',  doc: 'Telegram Premium user.', kind: 'property' },
];

const ASYNCIO_API = [
  { label: 'run',          detail: 'asyncio.run(coro) -> T',                doc: 'Run an async coroutine.' },
  { label: 'sleep',        detail: 'async asyncio.sleep(seconds)',          doc: 'Async sleep.' },
  { label: 'gather',       detail: 'async asyncio.gather(*coros)',          doc: 'Run coros concurrently.' },
  { label: 'create_task',  detail: 'asyncio.create_task(coro) -> Task',     doc: 'Schedule a coroutine.' },
  { label: 'wait',         detail: 'async asyncio.wait(coros, timeout=...)', doc: 'Wait for coros.' },
  { label: 'wait_for',     detail: 'async asyncio.wait_for(coro, timeout)',  doc: 'Wait with timeout.' },
  { label: 'Lock',         detail: 'asyncio.Lock()',                         doc: 'Async mutex lock.' },
  { label: 'Queue',        detail: 'asyncio.Queue(maxsize=0)',               doc: 'Async FIFO queue.' },
  { label: 'Event',        detail: 'asyncio.Event()',                        doc: 'Async event.' },
];

const TELEBOT_API = [
  { label: 'TeleBot',                detail: 'TeleBot(token, parse_mode=None)',           doc: 'Synchronous Telegram bot.' },
  { label: 'AsyncTeleBot',           detail: 'AsyncTeleBot(token, parse_mode=None)',      doc: 'Asynchronous Telegram bot.' },
  { label: 'types',                  detail: 'telebot.types',                              doc: 'Type module.' },
  { label: 'apihelper',              detail: 'telebot.apihelper',                          doc: 'Low-level API helpers.' },
];

const SNIPPETS = [
  {
    label: 'aiogram-bot',
    detail: 'aiogram bot skeleton',
    insertText: [
      'import asyncio',
      'from aiogram import Bot, Dispatcher, F',
      'from aiogram.filters import CommandStart',
      'from aiogram.types import Message',
      '',
      'bot = Bot(token="${1:YOUR_TOKEN}")',
      'dp = Dispatcher()',
      '',
      '@dp.message(CommandStart())',
      'async def start_handler(message: Message):',
      '    await message.answer("Hello, ${2:world}!")',
      '',
      'async def main():',
      '    await dp.start_polling(bot)',
      '',
      'if __name__ == "__main__":',
      '    asyncio.run(main())',
    ].join('\n'),
    doc: 'Full aiogram 3.x bot template.',
  },
  {
    label: 'message-handler',
    detail: 'aiogram message handler',
    insertText: [
      '@dp.message(${1:F.text == "hi"})',
      'async def ${2:handler_name}(message: Message):',
      '    await message.answer("${3:reply}")',
    ].join('\n'),
    doc: 'Add a new message handler.',
  },
  {
    label: 'callback-handler',
    detail: 'aiogram callback handler',
    insertText: [
      '@dp.callback_query(F.data == "${1:button_id}")',
      'async def ${2:handler_name}(callback: CallbackQuery):',
      '    await callback.answer("${3:OK}")',
      '    await callback.message.edit_text("${4:new text}")',
    ].join('\n'),
    doc: 'Handle callback button press.',
  },
  {
    label: 'inline-keyboard',
    detail: 'inline keyboard markup',
    insertText: [
      'kb = InlineKeyboardMarkup(inline_keyboard=[',
      '    [InlineKeyboardButton(text="${1:Button}", callback_data="${2:btn1}")],',
      '])',
    ].join('\n'),
    doc: 'Build an inline keyboard.',
  },
  {
    label: 'http-request',
    detail: 'aiohttp GET request',
    insertText: [
      'import aiohttp',
      'async with aiohttp.ClientSession() as session:',
      '    async with session.get("${1:https://api.example.com}") as resp:',
      '        data = await resp.${2|json,text|}()',
    ].join('\n'),
    doc: 'Make an async HTTP request.',
  },
  { label: 'try-except', detail: 'try/except block',
    insertText: ['try:', '    ${1:pass}', 'except ${2:Exception} as e:', '    ${3:print(e)}'].join('\n'),
    doc: 'Exception handler.',
  },
  { label: 'if-main', detail: 'if __name__ == "__main__"',
    insertText: 'if __name__ == "__main__":\n    ${1:main()}',
    doc: 'Module main entry point.',
  },
  { label: 'async-def', detail: 'async function',
    insertText: 'async def ${1:name}(${2:args}):\n    ${3:pass}',
    doc: 'Define a coroutine.',
  },
  { label: 'class-def', detail: 'class definition',
    insertText: 'class ${1:Name}:\n    def __init__(self${2:, args}):\n        ${3:pass}',
    doc: 'Define a class.',
  },
];

const HOVER_DB = (() => {
  const m = {};
  PY_BUILTINS.forEach((s) => { m[s.label] = s; });
  AIOGRAM_API.forEach((s) => { m[s.label] = s; });
  ASYNCIO_API.forEach((s) => { m[`asyncio.${s.label}`] = s; m[s.label] = s; });
  TELEBOT_API.forEach((s) => { m[s.label] = s; });
  return m;
})();

let _registered = false;

export function registerPythonIntelliSense(monaco) {
  if (_registered) return;
  _registered = true;

  monaco.languages.registerCompletionItemProvider('python', {
    triggerCharacters: ['.', '(', ' '],
    provideCompletionItems: (model, position) => {
      const lineUntil = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const Kind = monaco.languages.CompletionItemKind;
      const Rule = monaco.languages.CompletionItemInsertTextRule;

      const kindOf = (k) => ({
        class: Kind.Class, module: Kind.Module, variable: Kind.Variable,
        property: Kind.Property, function: Kind.Function,
      }[k] ?? Kind.Function);

      const dotMatch = lineUntil.match(/(\w+)\.(\w*)$/);
      if (dotMatch) {
        const target = dotMatch[1];
        let pool = null;
        if (target === 'bot' || target === 'self.bot') pool = BOT_METHODS;
        else if (target === 'message' || target === 'msg' || target === 'm') pool = MESSAGE_METHODS;
        else if (target === 'callback' || target === 'cb' || target === 'query') pool = CALLBACK_METHODS;
        else if (target === 'user' || target === 'from_user') pool = USER_PROPS;
        else if (target === 'asyncio') pool = ASYNCIO_API;
        else if (target === 'aiogram') pool = AIOGRAM_API;
        else if (target === 'telebot') pool = TELEBOT_API;

        if (pool) {
          return {
            suggestions: pool.map((s) => ({
              label: s.label,
              kind: s.kind === 'property' ? Kind.Property : (s.detail?.startsWith('async ') ? Kind.Method : Kind.Method),
              detail: s.detail,
              documentation: { value: s.doc },
              insertText: s.label,
              range,
            })),
          };
        }
      }

      if (/^\s*(from|import)\s+\w*$/.test(lineUntil)) {
        const modules = ['aiogram', 'asyncio', 'telebot', 'os', 'sys', 'json', 'datetime',
                         'random', 'time', 're', 'pathlib', 'typing', 'logging', 'aiohttp',
                         'sqlite3', 'requests'];
        return {
          suggestions: modules.map((m) => ({
            label: m, kind: Kind.Module, detail: 'module',
            insertText: m, range,
          })),
        };
      }

      const suggestions = [];

      PY_KEYWORDS.forEach((k) => suggestions.push({
        label: k, kind: Kind.Keyword, insertText: k, range,
      }));

      PY_BUILTINS.forEach((s) => suggestions.push({
        label: s.label, kind: Kind.Function, detail: s.detail,
        documentation: { value: s.doc }, insertText: s.label, range,
      }));

      AIOGRAM_API.forEach((s) => suggestions.push({
        label: s.label, kind: kindOf(s.kind), detail: s.detail,
        documentation: { value: s.doc }, insertText: s.label, range,
      }));

      SNIPPETS.forEach((s) => suggestions.push({
        label: s.label, kind: Kind.Snippet, detail: s.detail,
        documentation: { value: s.doc },
        insertText: s.insertText, insertTextRules: Rule.InsertAsSnippet,
        range,
      }));

      const text = model.getValue();
      const localSymbols = new Set();
      const symbolRe = /(?:^|\n)\s*(?:async\s+)?(?:def|class)\s+(\w+)/g;
      const varRe = /(?:^|\n)\s*(\w+)\s*=/g;
      let match;
      while ((match = symbolRe.exec(text)) !== null) localSymbols.add(match[1]);
      while ((match = varRe.exec(text)) !== null) {
        if (match[1].length > 1 && !PY_KEYWORDS.includes(match[1])) localSymbols.add(match[1]);
      }
      localSymbols.forEach((sym) => {
        suggestions.push({
          label: sym, kind: Kind.Variable, detail: 'local',
          insertText: sym, range,
          sortText: '0_' + sym,
        });
      });

      return { suggestions };
    },
  });

  monaco.languages.registerHoverProvider('python', {
    provideHover: (model, position) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const sym = HOVER_DB[word.word];
      if (!sym) return null;
      return {
        range: new monaco.Range(
          position.lineNumber, word.startColumn,
          position.lineNumber, word.endColumn,
        ),
        contents: [
          { value: '```python\n' + (sym.detail || sym.label) + '\n```' },
          { value: sym.doc || '' },
        ],
      };
    },
  });

  monaco.languages.registerSignatureHelpProvider('python', {
    signatureHelpTriggerCharacters: ['(', ','],
    provideSignatureHelp: (model, position) => {
      const lineText = model.getLineContent(position.lineNumber);
      const before = lineText.substring(0, position.column - 1);
      const m = before.match(/(\w+)\s*\(([^)]*)$/);
      if (!m) return null;
      const fnName = m[1];
      const argsText = m[2];
      const activeParam = argsText.split(',').length - 1;

      const sym = HOVER_DB[fnName] || MESSAGE_METHODS.find((x) => x.label === fnName)
                  || BOT_METHODS.find((x) => x.label === fnName);
      if (!sym) return null;

      const detail = sym.detail || `${fnName}()`;
      const paramMatch = detail.match(/\(([^)]*)\)/);
      const params = paramMatch
        ? paramMatch[1].split(',').map((p) => ({ label: p.trim() }))
        : [];

      return {
        value: {
          signatures: [{
            label: detail,
            documentation: sym.doc,
            parameters: params,
          }],
          activeSignature: 0,
          activeParameter: Math.min(activeParam, Math.max(0, params.length - 1)),
        },
        dispose: () => {},
      };
    },
  });
}
