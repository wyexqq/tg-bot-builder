export const BLOCK_DEFS = {
  command: {
    label: 'Команда',
    label_en: 'Command',
    icon: '⚡',
    color: '#2196f3',
    defaultData: {
      command_name: '/start',
      description: 'Запустить бота',
      handler_name: 'cmd_start',
      parse_mode: 'HTML',
      only_private: false,
      only_admins: false,
      only_groups: false,
    },
  },
  text: {
    label: 'Текст',
    label_en: 'Text',
    icon: '💬',
    color: '#4caf50',
    defaultData: {
      message_text: 'Привет!',
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      disable_notification: false,
    },
  },
  buttons: {
    label: 'Кнопки',
    label_en: 'Buttons',
    icon: '🔘',
    color: '#ff9800',
    defaultData: {
      button_type: 'inline',
      buttons: [
        { text: 'Да',    callback_data: 'btn_yes',  row_break: true  },
        { text: 'Нет',   callback_data: 'btn_no',   row_break: false },
        { text: 'Назад', callback_data: 'btn_back', row_break: false },
      ],
      attach_to_previous: false,
      message_text: 'Выберите:',
      one_time_keyboard: false,
      resize_keyboard: true,
      selective: false,
      dynamic_enabled: false,
      dynamic_source: 'items',
      dynamic_text_expr: 'str(item)',
      dynamic_callback_expr: 'str(item)',
      dynamic_columns: 1,
      dynamic_result_var: 'dyn_arg',
    },
  },
  edit_message: {
    label: 'Изменить сообщение',
    label_en: 'Edit Message',
    icon: '✏️',
    color: '#f59e0b',
    defaultData: {
      edit_text: true,
      new_text: 'Обновлено',
      parse_mode: 'HTML',
      edit_markup: false,
      buttons: [],
    },
  },
  condition: {
    label: 'Условие',
    label_en: 'Condition',
    icon: '❓',
    color: '#ffc107',
    defaultData: {
      condition_mode: 'preset',
      condition_expression: "message.text == 'да'",
      field: 'message.text',
      operator: '==',
      value: 'да',
      true_label: 'Да',
      false_label: 'Нет',
    },
  },

  media: {
    label: 'Медиа',
    label_en: 'Media',
    icon: '🖼️',
    color: '#06b6d4',
    defaultData: {
      media_type: 'photo',
      file_id: '',
      caption: '',
      parse_mode: 'HTML',
      disable_notification: false,
    },
  },

  variable: {
    label: 'Переменная',
    label_en: 'Variable',
    icon: '📦',
    color: '#8b5cf6',
    defaultData: {
      operation: 'set',
      scope: 'user',
      var_name: 'my_var',
      var_value: '',
      result_variable: 'my_var',
    },
  },

  list_op: {
    label: 'Список',
    label_en: 'List',
    icon: '📋',
    color: '#8b5cf6',
    defaultData: {
      list_name: 'my_list',
      scope: 'user',
      operation: 'append',
      value: '',
      index: '0',
      result_variable: 'result',
    },
  },

  timer: {
    label: 'Таймер',
    label_en: 'Timer',
    icon: '⏱️',
    color: '#f97316',
    defaultData: {
      delay: 5,
      unit: 'seconds',
    },
  },

  admin_notify: {
    label: 'Уведомить админа',
    label_en: 'Notify Admin',
    icon: '🔔',
    color: '#ec4899',
    defaultData: {
      admin_mode: 'id',
      admins: [''],
      admin_tag: '',
      message_template: 'Действие от @{username} (ID: {user_id}):\n{text}',
    },
  },

  wait_input: {
    label: 'Ждать ввода',
    label_en: 'Wait Input',
    icon: '⌨️',
    color: '#0ea5e9',
    defaultData: {
      prompt_enabled: true,
      prompt: 'Введите значение:',
      var_name: 'user_input',
      var_scope: 'user',
      validation: 'none',
    },
  },

  http_request: {
    label: 'HTTP-запрос',
    label_en: 'HTTP Request',
    icon: '🌐',
    color: '#14b8a6',
    defaultData: {
      method: 'GET',
      url: 'https://api.example.com/data',
      headers: '',
      body: '',
      result_variable: 'response',
      timeout: 10,
    },
  },

  code_block: {
    label: 'Python-код',
    label_en: 'Python Code',
    icon: '🐍',
    color: '#6366f1',
    defaultData: {
      code: '# Ваш код здесь\nresult = 42',
      description: '',
    },
  },

  dynamic_step: {
    label: 'Динамическая анкета',
    label_en: 'Dynamic Survey',
    icon: '📝',
    color: '#0ea5e9',
    defaultData: {
      steps_source: 'question_list',
      answers_scope: 'user',
      answers_list_name: 'survey_answers',
      finish_message: 'Спасибо! Ответы сохранены.',
    },
  },

  loop_for: {
    label: 'Цикл',
    label_en: 'Loop',
    icon: '🔁',
    color: '#78716c',
    defaultData: {
      loop_type: 'count',
      count: '10',
      iter_var: 'i',
      list_var: '',
      item_var: 'item',
      while_condition: 'True',
      range_start: '0',
      range_stop: '10',
      range_step: '1',
      max_iterations: '1000',
    },
  },

  webhook: {
    label: 'Webhook',
    label_en: 'Webhook',
    icon: '🔗',
    color: '#0891b2',
    defaultData: {
      method: 'POST',
      url: '',
      headers: '',
      payload: '{"text": "Hello from bot!"}',
      result_variable: 'wh_status',
      timeout: 10,
    },
  },


  get_user_info: {
    label: 'Данные пользователя',
    label_en: 'User Info',
    icon: '👤',
    color: '#06b6d4',
    defaultData: {
      fields: [
        { field: 'first_name', var_name: 'user_name' },
      ],
    },
  },

  message_handler: {
    label: 'Сообщение',
    label_en: 'Message',
    icon: '✉️',
    color: '#2196f3',
    defaultData: {
      filter_type: 'any',
      filter_value: '',
      handler_name: 'on_message',
    },
  },

  broadcast: {
    label: 'Рассылка',
    label_en: 'Broadcast',
    icon: '📢',
    color: '#ec4899',
    defaultData: {
      message_text: 'Привет всем!',
      parse_mode: 'HTML',
      delay_between: 0.05,
      audience: 'all',
      filter_sql: '',
      tag: '',
    },
  },

  schedule: {
    label: 'Расписание',
    label_en: 'Schedule',
    icon: '⏰',
    color: '#7c3aed',
    defaultData: {
      schedule_type: 'daily',
      time_of_day: '09:00',
      interval_value: 30,
      interval_unit: 'minutes',
      audience: 'all',
      filter_sql: '',
      tag: '',
    },
  },

  deep_link: {
    label: 'Deep Link',
    label_en: 'Deep Link',
    icon: '🔗',
    color: '#f97316',
    defaultData: {
      payload_var: 'start_payload',
      save_referrer: true,
      referrer_var: 'referrer_id',
    },
  },

  save_user: {
    label: 'Сохранить пользователя',
    label_en: 'Save User',
    icon: '💾',
    color: '#10b981',
    defaultData: {
      fields: [
        { column: 'user_id',    value: 'message.from_user.id' },
        { column: 'username',   value: 'message.from_user.username or ""' },
        { column: 'first_name', value: 'message.from_user.first_name or ""' },
        { column: 'last_name',  value: 'message.from_user.last_name or ""' },
      ],
    },
  },

  contact_request: {
    label: 'Запрос контакта',
    label_en: 'Request Contact',
    icon: '📱',
    color: '#0ea5e9',
    defaultData: {
      prompt: 'Поделитесь номером телефона:',
      button_text: 'Поделиться номером',
      phone_var: 'user_phone',
      contact_var: 'user_contact',
    },
  },

  google_sheets: {
    label: 'Google Таблицы',
    label_en: 'Google Sheets',
    icon: '📊',
    color: '#22c55e',
    defaultData: {
      action: 'append',
      credentials_var: 'GOOGLE_CREDS_JSON',
      spreadsheet_id: '',
      sheet_name: 'Sheet1',
      row_data: '{user_id},{user_name},{user_phone}',
      range: 'A1',
      result_variable: 'sheets_result',
    },
  },

  rate_limit: {
    label: 'Лимит частоты',
    label_en: 'Rate Limit',
    icon: '⏱️',
    color: '#f59e0b',
    defaultData: {
      count_what: 'any',
      scope: 'user',
      max_calls: 3,
      window_seconds: 60,
      blocked_message: 'Подождите немного',
    },
  },

  db_create_table: {
    label: 'БД: Создать таблицу',
    label_en: 'DB: Create Table',
    icon: '🗄️',
    color: '#9c27b0',
    defaultData: {
      table_name: 'users',
      if_not_exists: true,
      columns: [
        { name: 'id',         type: 'INTEGER', primary_key: true,  not_null: true,  unique: false, autoincrement: true  },
        { name: 'user_id',    type: 'INTEGER', primary_key: false, not_null: true,  unique: true,  autoincrement: false },
        { name: 'username',   type: 'TEXT',    primary_key: false, not_null: false, unique: false, autoincrement: false },
        { name: 'score',      type: 'REAL',    primary_key: false, not_null: false, unique: false, autoincrement: false },
        { name: 'created_at', type: 'TEXT',    primary_key: false, not_null: false, unique: false, autoincrement: false },
      ],
    },
  },
  db_write: {
    label: 'БД: Записать',
    label_en: 'DB: Write',
    icon: '✏️',
    color: '#9c27b0',
    defaultData: {
      table_name: 'users',
      mode: 'INSERT OR REPLACE',
      values: [
        { column: 'user_id',  value: 'message.from_user.id'       },
        { column: 'username', value: 'message.from_user.username'  },
        { column: 'score',    value: '0'                           },
      ],
      where_clause: '',
    },
  },
  db_read: {
    label: 'БД: Прочитать',
    label_en: 'DB: Read',
    icon: '📖',
    color: '#9c27b0',
    defaultData: {
      table_name: 'users',
      columns_to_select: '*',
      where_clause: 'user_id = {message.from_user.id}',
      order_by: '',
      limit: '',
      result_variable: 'user_row',
      fetch_mode: 'one',
    },
  },
  db_delete: {
    label: 'БД: Удалить',
    label_en: 'DB: Delete',
    icon: '🗑️',
    color: '#e53935',
    defaultData: {
      table_name: 'users',
      where_clause: 'user_id = {message.from_user.id}',
      confirm: false,
    },
  },
  group_frame: {
    label: 'Группа',
    label_en: 'Group',
    icon: '⬡',
    color: '#0078d4',
    defaultData: { label: 'Группа', _childIds: [], _width: 320, _height: 220, collapsed: false },
  },
  comment: {
    label: 'Заметка',
    label_en: 'Note',
    icon: '📝',
    color: '#f59e0b',
    defaultData: {
      text: '',
      color: 'rgba(255,255,255,0.04)',
      textColor: '#d4d4d4',
    },
  },
};

export const PALETTE_ITEMS = [
  { type: 'command',         label: 'Команда',             label_en: 'Command',         icon: '⚡', desc: '/start, /help, /menu...',         desc_en: '/start, /help, /menu...',         color: '#2196f3' },
  { type: 'text',            label: 'Текст',               label_en: 'Text',            icon: '💬', desc: 'Отправить сообщение',              desc_en: 'Send message',                    color: '#4caf50' },
  { type: 'media',           label: 'Медиа',               label_en: 'Media',           icon: '🖼️', desc: 'Фото / видео / стикер / GIF',     desc_en: 'Photo / video / sticker / GIF',   color: '#06b6d4' },
  { type: 'buttons',         label: 'Кнопки',              label_en: 'Buttons',         icon: '🔘', desc: 'Inline / Reply',                   desc_en: 'Inline / Reply',                  color: '#ff9800' },
  { type: 'edit_message',    label: 'Изменить сообщение',  label_en: 'Edit Message',    icon: '✏️', desc: 'Обновить текст/кнопки на месте',  desc_en: 'Update text/buttons in place',    color: '#f59e0b' },
  { type: 'condition',       label: 'Условие',   label_en: 'Condition',       icon: '❓', desc: 'Ветвление логики',                 desc_en: 'Branch logic',                    color: '#ffc107' },
  { type: 'loop_for',        label: 'Цикл',                label_en: 'Loop',            icon: '🔁', desc: 'Повторить N раз / по списку',      desc_en: 'Repeat N times / over list',      color: '#78716c' },
  { type: 'wait_input',      label: 'Ждать ввода',         label_en: 'Wait Input',      icon: '⌨️', desc: 'Сохранить ответ в переменную',    desc_en: 'Save reply to variable',          color: '#0ea5e9' },
  { type: 'dynamic_step',    label: 'Динамическая анкета', label_en: 'Dynamic Survey',  icon: '📝', desc: 'N вопросов, решается в рантайме', desc_en: 'N questions, decided at runtime', color: '#0ea5e9' },
  { type: 'timer',           label: 'Таймер',              label_en: 'Timer',           icon: '⏱️', desc: 'Задержка перед следующим',         desc_en: 'Delay before next block',         color: '#f97316' },
  { type: 'schedule',        label: 'Расписание',          label_en: 'Schedule',        icon: '⏰', desc: 'Фоновый триггер по времени',       desc_en: 'Background time-based trigger',   color: '#7c3aed' },
  { type: 'message_handler', label: 'Сообщение',           label_en: 'Message',         icon: '✉️', desc: 'Обработчик текста',               desc_en: 'Text message handler',            color: '#2196f3' },
  { type: 'deep_link',       label: 'Deep Link',           label_en: 'Deep Link',       icon: '🔗', desc: '/start?payload=...',               desc_en: '/start?payload=...',              color: '#f97316' },
  { type: 'get_user_info',   label: 'Данные пользователя',        label_en: 'User Info',       icon: '👤', desc: 'first_name, username, id...',      desc_en: 'first_name, username, id...',     color: '#06b6d4' },
  { type: 'save_user',       label: 'Сохранить пользователя',     label_en: 'Save User',       icon: '💾', desc: 'Регистрация в БД',                 desc_en: 'Register user in DB',             color: '#10b981' },
  { type: 'contact_request', label: 'Запрос контакта',     label_en: 'Request Contact', icon: '📱', desc: 'Запросить телефон',               desc_en: 'Request phone number',            color: '#0ea5e9' },
  { type: 'broadcast',       label: 'Рассылка',            label_en: 'Broadcast',       icon: '📢', desc: 'Отправить всем юзерам',            desc_en: 'Send to all users',               color: '#ec4899' },
  { type: 'rate_limit',      label: 'Лимит частоты',       label_en: 'Rate Limit',      icon: '⏱️', desc: 'Антифлуд: ограничить частоту',     desc_en: 'Anti-flood: limit frequency',     color: '#f59e0b' },
  { type: 'variable',        label: 'Переменная',          label_en: 'Variable',        icon: '📦', desc: 'Установить / получить',            desc_en: 'Set / get variable',              color: '#8b5cf6' },
  { type: 'list_op',         label: 'Список',              label_en: 'List',            icon: '📋', desc: 'Массив / контейнер данных',        desc_en: 'Array / data container',          color: '#8b5cf6' },
  { type: 'admin_notify',    label: 'Уведомить админа',    label_en: 'Notify Admin',    icon: '🔔', desc: 'Послать сообщение владельцу',      desc_en: 'Send message to owner',           color: '#ec4899' },
  { type: 'http_request',    label: 'HTTP-запрос',         label_en: 'HTTP Request',    icon: '🌐', desc: 'GET / POST запрос к API',          desc_en: 'GET / POST request to API',       color: '#14b8a6' },
  { type: 'webhook',         label: 'Webhook',             label_en: 'Webhook',         icon: '🔗', desc: 'POST в Discord / Slack / Zapier', desc_en: 'POST to Discord / Slack / Zapier', color: '#0891b2' },
  { type: 'google_sheets',   label: 'Google Таблицы',      label_en: 'Google Sheets',   icon: '📊', desc: 'Append / Read строки',             desc_en: 'Append / Read rows',              color: '#22c55e' },
  { type: 'code_block',      label: 'Python-код',          label_en: 'Python Code',     icon: '🐍', desc: 'Произвольный Python-код',          desc_en: 'Custom Python code',              color: '#6366f1' },
  { type: 'db_create_table', label: 'БД: Создать таблицу', label_en: 'DB: Create Table', icon: '🗄️', desc: 'CREATE TABLE',                   desc_en: 'CREATE TABLE',                    color: '#9c27b0' },
  { type: 'db_write',        label: 'БД: Записать',        label_en: 'DB: Write',       icon: '✏️', desc: 'INSERT / UPDATE',                  desc_en: 'INSERT / UPDATE',                 color: '#9c27b0' },
  { type: 'db_read',         label: 'БД: Прочитать',       label_en: 'DB: Read',        icon: '📖', desc: 'SELECT',                           desc_en: 'SELECT',                          color: '#9c27b0' },
  { type: 'db_delete',       label: 'БД: Удалить',         label_en: 'DB: Delete',      icon: '🗑️', desc: 'DELETE',                           desc_en: 'DELETE',                          color: '#e53935' },
  { type: 'comment',         label: 'Заметка',             label_en: 'Note',            icon: '📝', desc: 'Текстовая заметка на холсте',      desc_en: 'Text note on canvas',             color: '#f59e0b' },
];

export const PALETTE_GROUPS = [
  { key: 'group.triggers',     types: ['command', 'message_handler', 'deep_link', 'schedule'] },
  { key: 'group.messages',     types: ['text', 'media', 'buttons', 'edit_message'] },
  { key: 'group.logic',        types: ['condition', 'loop_for', 'wait_input', 'dynamic_step', 'timer', 'rate_limit'] },
  { key: 'group.users',        types: ['get_user_info', 'save_user', 'contact_request', 'broadcast', 'admin_notify'] },
  { key: 'group.data',         types: ['variable', 'list_op'] },
  { key: 'group.database',     types: ['db_create_table', 'db_write', 'db_read', 'db_delete'] },
  { key: 'group.integrations', types: ['http_request', 'webhook', 'google_sheets', 'code_block'] },
  { key: 'group.extra',        types: ['comment'] },
];

export const GROUP_COLORS = {
  'group.triggers':     '#2563eb',
  'group.messages':     '#0891b2',
  'group.logic':        '#d97706',
  'group.users':        '#7c3aed',
  'group.data':         '#0d9488',
  'group.database':     '#4f46e5',
  'group.integrations': '#db2777',
  'group.extra':        '#64748b',
  'group.custom':       '#64748b',
};

export const TYPE_GROUP = Object.fromEntries(
  PALETTE_GROUPS.flatMap((g) => g.types.map((t) => [t, g.key])),
);

export function blockColor(type) {
  return GROUP_COLORS[TYPE_GROUP[type]] || GROUP_COLORS['group.custom'];
}

export const ROOT_TYPES = new Set(['command', 'message_handler', 'deep_link', 'schedule']);
