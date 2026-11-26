import { useState, useRef, useLayoutEffect } from 'react';
import useStore from '../store/useStore';
import useCustomBlockStore from '../customBlocks/customBlockStore';
import { getCodeBlockInspector } from '../customBlocks/dynamicNodeRegistry';
import { BLOCK_DEFS } from '../blockDefinitions';
import { useT } from '../i18n';
import './NodeInspector.css';


function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="ins-section">
      <button className="ins-section__head" onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <span className={`ins-section__arrow${open ? ' open' : ''}`}>▾</span>
      </button>
      {open && <div className="ins-section__body">{children}</div>}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="ins-field">
      <label className="ins-label">{label}</label>
      {children}
    </div>
  );
}

function Inp({ value, onChange, placeholder, mono, type = 'text' }) {
  return (
    <input
      className={`ins-input${mono ? ' ins-input--mono' : ''}`}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      spellCheck={false}
    />
  );
}

function Sel({ value, onChange, options }) {
  return (
    <select className="ins-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map(({ value: v, label: l }) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}

function TableSelect({ value, onChange }) {
  const nodes = useStore((s) => s.nodes);
  const tables = [...new Set(
    nodes.filter((n) => n.type === 'db_create_table' && n.data?.table_name)
         .map((n) => n.data.table_name.trim())
         .filter(Boolean)
  )];
  const listId = 'tbl-list';
  return (
    <>
      <input
        className="ins-input ins-input--mono"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="table_name"
        list={tables.length ? listId : undefined}
        spellCheck={false}
      />
      {tables.length > 0 && (
        <datalist id={listId}>
          {tables.map((t) => <option key={t} value={t} />)}
        </datalist>
      )}
    </>
  );
}

function Txt({ value, onChange, placeholder, rows = 2 }) {
  const ref = useRef(null);
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  useLayoutEffect(fit, [value]);
  return (
    <textarea
      ref={ref}
      className="ins-textarea ins-textarea--auto"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      onInput={fit}
      placeholder={placeholder}
      rows={rows}
    />
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <label className="ins-toggle">
      <input
        type="checkbox"
        className="ins-toggle__cb"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="ins-toggle__track">
        <span className="ins-toggle__thumb" />
      </span>
      <span className="ins-toggle__label">{label}</span>
    </label>
  );
}

function RemoveBtn({ onClick }) {
  return <button className="ins-remove-btn" onClick={onClick}>×</button>;
}

function AddBtn({ onClick, label = '+ Добавить' }) {
  return <button className="ins-add-btn" onClick={onClick}>{label}</button>;
}

const NL = {
  'Основные':              'General',
  'Фильтры':               'Filters',
  'Сообщение':             'Message',
  'Параметры отправки':    'Send Options',
  'Клавиатура':            'Keyboard',
  'Параметры Inline':      'Inline Options',
  'Параметры Reply':       'Reply Options',
  'Условие':               'Condition',
  'Метки выходов':         'Output Labels',
  'Таблица':               'Table',
  'Столбцы':               'Columns',
  'Запись':                'Write',
  'Значения':              'Values',
  'Условие UPDATE':        'UPDATE Condition',
  'Запрос':                'Query',
  'Сортировка и лимит':    'Sort & Limit',
  'Результат':             'Result',
  'Удаление':              'Delete',
  'Медиа':                 'Media',
  'Параметры':             'Options',
  'Подсказка':             'Hint',
  'Операция':              'Operation',
  'Список':                'List',
  'Таймер':                'Timer',
  'Уведомление':           'Notification',
  'Доступные переменные':  'Available Variables',
  'Запрос ввода':          'Input Request',
  'Код':                   'Code',
  'Цикл':                  'Loop',
  'Поля':                  'Fields',
  'Фильтр':                'Filter',
  'Имя обработчика':       'Handler Name',
  'Рассылка':              'Broadcast',
  'Deep Link':             'Deep Link',
  'Дополнительные поля':   'Extra Fields',
  'Запрос контакта':       'Contact Request',
  'Данные':                'Data',
  'Ограничение частоты':   'Rate Limit',
  'Команда':                        'Command',
  'Описание (BotFather)':           'Description (BotFather)',
  'Имя функции-обработчика':        'Handler function name',
  'Parse mode ответа':              'Response parse mode',
  'Только приватные чаты':          'Private chats only',
  'Только администраторы':          'Admins only',
  'Только группы':                  'Groups only',
  'Текст':                          'Text',
  'Parse mode':                     'Parse mode',
  'Скрыть превью ссылок':           'Disable link preview',
  'Тихое уведомление':              'Silent notification',
  'Тип':                            'Type',
  'Кнопки':                         'Buttons',
  'Кнопок в строке':                'Buttons per row',
  'Одноразовая клавиатура':         'One-time keyboard',
  'Подстраивать размер':            'Resize keyboard',
  'Selective (только упомянутым)':  'Selective (mentioned only)',
  'Режим':                          'Mode',
  'Выражение Python':               'Python expression',
  'Поле':                           'Field',
  'Оператор':                       'Operator',
  'Значение':                       'Value',
  'Ветка True':                     'True branch',
  'Ветка False':                    'False branch',
  'Имя таблицы':                    'Table name',
  'Столбцы (SELECT)':               'Columns (SELECT)',
  'Переменная':                     'Variable',
  'Режим выборки':                  'Fetch mode',
  'WHERE':                          'WHERE',
  'ORDER BY':                       'ORDER BY',
  'LIMIT':                          'LIMIT',
  'Подпись (caption)':              'Caption',
  'Действие':                       'Action',
  'Область':                        'Scope',
  'Имя переменной':                 'Variable name',
  'Сохранить в переменную':         'Save to variable',
  'Имя списка':                     'List name',
  'Индекс':                         'Index',
  'Задержка':                       'Delay',
  'Единица':                        'Unit',
  'Chat ID администратора':         'Admin Chat ID',
  'Шаблон сообщения':               'Message template',
  'Подсказка (отправить перед ожиданием)': 'Prompt (send before waiting)',
  'Валидация':                      'Validation',
  'Метод':                          'Method',
  'Тело запроса (JSON)':            'Request body (JSON)',
  'Таймаут (сек)':                  'Timeout (sec)',
  'Сохранить ответ в переменную':   'Save response to variable',
  'Описание (необязательно)':       'Description (optional)',
  'Python-код':                     'Python code',
  'Количество итераций':            'Iteration count',
  'Переменная счётчика':            'Counter variable',
  'Список / переменная':            'List / variable',
  'Переменная элемента':            'Item variable',
  'URL вебхука':                    'Webhook URL',
  'JSON-тело':                      'JSON body',
  'Сохранить статус в переменную':  'Save status to variable',
  'Тип фильтра':                    'Filter type',
  'Текст сообщения':                'Message text',
  'Задержка между отправками (сек)':'Delay between sends (sec)',
  'Переменная payload':             'Payload variable',
  'Сохранять реферера':             'Save referrer',
  'Переменная реферера':            'Referrer variable',
  'Сообщение-запрос':               'Request message',
  'Текст кнопки':                   'Button text',
  'Переменная телефона':            'Phone variable',
  'Переменная контакта':            'Contact variable',
  'Лист (Sheet name)':              'Sheet name',
  'Данные строки (через запятую)':  'Row data (comma-separated)',
  'Переменная результата':          'Result variable',
  'Перем. учётных данных (env var)':'Credentials var (env var)',
  'Макс. запросов':                 'Max requests',
  'Окно (секунд)':                  'Window (seconds)',
  'Сообщение при блокировке':       'Blocked message',
  'File ID или URL':                'File ID or URL',
  'handler_name':                   'handler_name',
  'Spreadsheet ID':                 'Spreadsheet ID',
  'Конструктор':            'Visual',
  'Python-выражение':       'Python expression',
  'Любой текст':            'Any text',
  'Только цифры':           'Numbers only',
  'Телефон (+...)':         'Phone (+...)',
  'Пользователь':           'User',
  'Глобально':              'Global',
  'Установить (set)':       'Set',
  'Получить (get)':         'Get',
  'Создать список':         'Create list',
  'Добавить элемент':       'Add element',
  'Удалить элемент':        'Remove element',
  'Очистить список':        'Clear list',
  'Получить элемент':       'Get element',
  'Длина списка':           'List length',
  'Секунды':                'Seconds',
  'Минуты':                 'Minutes',
  'Часы':                   'Hours',
  'Дни':                    'Days',
  'Одна строка (fetchone)': 'One row (fetchone)',
  'Все строки (fetchall)':  'All rows (fetchall)',
  'N раз (range)':          'N times (range)',
  'По списку/переменной':   'Over list/variable',
  'Содержит':               'Contains',
  'Равно':                  'Equals',
  'Append (добавить строку)':'Append (add row)',
  'Read (прочитать)':       'Read',
  '+ Кнопка':             '+ Button',
  'Добавить разрыв строки': 'Add row break',
  'Убрать разрыв строки':   'Remove row break',
  '— новая строка —':       '— new row —',
  '+ Столбец':            '+ Column',
  '+ Поле':               '+ Field',
  '+ добавить поле':      '+ add field',
  '+ поле':               '+ field',
};

function tr(s, lang) {
  if (lang !== 'en') return s;
  return NL[s] || s;
}

function trOpts(opts, lang) {
  if (lang !== 'en') return opts;
  return opts.map((o) => ({ ...o, label: NL[o.label] || o.label }));
}


const PARSE_MODES = [
  { value: 'HTML',        label: 'HTML'               },
  { value: 'Markdown',    label: 'Markdown'            },
  { value: 'MarkdownV2',  label: 'MarkdownV2'          },
  { value: 'None',        label: 'Без форматирования'  },
];


function CommandSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  return (
    <>
      <Section title={t('Основные')}>
        <Field label={t('Команда')}>
          <Inp value={data.command_name} onChange={(v) => upd('command_name', v)} placeholder="/start" mono />
        </Field>
        <Field label={t('Описание (BotFather)')}>
          <Inp value={data.description} onChange={(v) => upd('description', v)} placeholder={lang === 'en' ? 'Command description' : 'Описание команды'} />
        </Field>
        <Field label={t('Имя функции-обработчика')}>
          <Inp value={data.handler_name} onChange={(v) => upd('handler_name', v)} placeholder="cmd_start" mono />
        </Field>
        <Field label={t('Parse mode ответа')}>
          <Sel value={data.parse_mode} onChange={(v) => upd('parse_mode', v)} options={PARSE_MODES} />
        </Field>
      </Section>
      <Section title={t('Фильтры')} defaultOpen={false}>
        <Toggle label={t('Только приватные чаты')} value={data.only_private} onChange={(v) => upd('only_private', v)} />
        <Toggle label={t('Только администраторы')}  value={data.only_admins}   onChange={(v) => upd('only_admins', v)} />
        <Toggle label={t('Только группы')}          value={data.only_groups}   onChange={(v) => upd('only_groups', v)} />
      </Section>
    </>
  );
}

function TextSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  return (
    <>
      <Section title={t('Сообщение')}>
        <Field label={t('Текст')}>
          <Txt value={data.message_text} onChange={(v) => upd('message_text', v)} placeholder={lang === 'en' ? 'Message text...' : 'Текст сообщения...'} rows={5} />
        </Field>
        <Field label={t('Parse mode')}>
          <Sel value={data.parse_mode} onChange={(v) => upd('parse_mode', v)} options={PARSE_MODES} />
        </Field>
      </Section>
      <Section title={t('Параметры отправки')} defaultOpen={false}>
        <Toggle label={t('Скрыть превью ссылок')}  value={data.disable_web_page_preview} onChange={(v) => upd('disable_web_page_preview', v)} />
        <Toggle label={t('Тихое уведомление')}     value={data.disable_notification}     onChange={(v) => upd('disable_notification', v)} />
      </Section>
    </>
  );
}

const BTN_STYLES = [
  { v: '',        c: '',        ru: 'Стандарт', en: 'Default' },
  { v: 'primary', c: '#3b82f6', ru: 'Синий',    en: 'Primary' },
  { v: 'success', c: '#22c55e', ru: 'Зелёный',  en: 'Success' },
  { v: 'danger',  c: '#ef4444', ru: 'Красный',  en: 'Danger'  },
];
const btnStyleColor = (style) => BTN_STYLES.find((s) => s.v === (style || ''))?.c || '';

function ButtonStylePicker({ value, onChange, lang }) {
  return (
    <div className="ins-btn-styles">
      {BTN_STYLES.map((s) => (
        <button
          key={s.v || 'default'}
          type="button"
          className={`ins-style-dot${(value || '') === s.v ? ' active' : ''}${!s.c ? ' ins-style-dot--default' : ''}`}
          title={lang === 'en' ? s.en : s.ru}
          style={s.c ? { background: s.c } : undefined}
          onClick={() => onChange(s.v)}
        />
      ))}
    </div>
  );
}

function ButtonsPreview({ buttons, type, onChange, lang }) {
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);

  const rows = [];
  let cur = [];
  buttons.forEach((b, i) => {
    cur.push({ ...b, _i: i });
    if (b.row_break && i < buttons.length - 1) { rows.push(cur); cur = []; }
  });
  if (cur.length) rows.push(cur);

  const commit = (rows2) => {
    const cleaned = rows2.filter((r) => r.length);
    const flat = [];
    cleaned.forEach((row, ri) =>
      row.forEach((btn, bi) => {
        const { _i, ...rest } = btn;
        flat.push({ ...rest, row_break: bi === row.length - 1 && ri < cleaned.length - 1 });
      })
    );
    onChange(flat);
  };

  const clone = () => rows.map((r) => r.map((b) => ({ ...b })));
  const removeKey = (rs, key) => {
    for (const r of rs) {
      const idx = r.findIndex((b) => b._i === key);
      if (idx !== -1) return r.splice(idx, 1)[0];
    }
    return null;
  };

  const clear = () => { setDrag(null); setOver(null); };

  const dropChip = (targetKey) => {
    if (drag == null || targetKey === drag) { clear(); return; }
    const rs = clone();
    const moved = removeKey(rs, drag);
    if (moved) for (const r of rs) {
      const idx = r.findIndex((b) => b._i === targetKey);
      if (idx !== -1) { r.splice(idx, 0, moved); break; }
    }
    commit(rs); clear();
  };

  const dropGap = (i) => {
    if (drag == null) { clear(); return; }
    const rs = clone();
    const origRow = rs.findIndex((r) => r.some((b) => b._i === drag));
    const moved = removeKey(rs, drag);
    let insAt = i;
    if (origRow !== -1 && rs[origRow] && rs[origRow].length === 0) { rs.splice(origRow, 1); if (origRow < insAt) insAt--; }
    insAt = Math.max(0, Math.min(rs.length, insAt));
    if (moved) rs.splice(insAt, 0, [moved]);
    commit(rs); clear();
  };

  if (!buttons.length) {
    return <div className="ins-kbd-empty">{lang === 'en' ? 'No buttons yet' : 'Пока нет кнопок'}</div>;
  }

  const Gap = ({ i }) => (
    <div
      className={`ins-kbd-gap${over?.kind === 'gap' && over.i === i ? ' active' : ''}${drag != null ? ' armed' : ''}`}
      onDragOver={(e) => { e.preventDefault(); if (over?.kind !== 'gap' || over.i !== i) setOver({ kind: 'gap', i }); }}
      onDrop={(e) => { e.preventDefault(); dropGap(i); }}
    />
  );

  return (
    <div className={`ins-kbd-preview ins-kbd-preview--${type}`} onDragEnd={clear}>
      {rows.map((row, ri) => (
        <div key={ri}>
          <Gap i={ri} />
          <div className="ins-kbd-row">
            {row.map((btn) => (
              <div
                key={btn._i}
                className={`ins-kbd-btn${drag === btn._i ? ' dragging' : ''}${over?.kind === 'chip' && over.key === btn._i ? ' insbefore' : ''}`}
                draggable
                onDragStart={() => setDrag(btn._i)}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (over?.kind !== 'chip' || over.key !== btn._i) setOver({ kind: 'chip', key: btn._i }); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); dropChip(btn._i); }}
                title={btn.callback_data}
                style={btnStyleColor(btn.style) ? { background: btnStyleColor(btn.style), borderColor: btnStyleColor(btn.style), color: '#fff' } : undefined}
              >
                {btn.text || '—'}
              </div>
            ))}
          </div>
        </div>
      ))}
      <Gap i={rows.length} />
    </div>
  );
}

const ATTACHABLE_TYPES = { text: { ru: 'Текст', en: 'Text' }, media: { ru: 'Медиа', en: 'Media' } };

function ButtonsSettings({ data, upd, lang, nodeId }) {
  const t = (s) => tr(s, lang);
  const buttons = data.buttons ?? [];

  const edges = useStore((s) => s.edges);
  const allNodes = useStore((s) => s.nodes);
  const incoming = nodeId ? edges.find((e) => e.target === nodeId) : null;
  const prevNode = incoming ? allNodes.find((n) => n.id === incoming.source) : null;
  const attachableLabel = prevNode ? ATTACHABLE_TYPES[prevNode.type] : null;
  const canAttach = !!attachableLabel;

  const updateBtn = (i, field, val) =>
    upd('buttons', buttons.map((b, idx) => (idx === i ? { ...b, [field]: val } : b)));
  const addBtn = () =>
    upd('buttons', [...buttons, { text: lang === 'en' ? `Button ${buttons.length + 1}` : `Кнопка ${buttons.length + 1}`, callback_data: `btn_${buttons.length + 1}`, row_break: false }]);
  const removeBtn = (i) =>
    upd('buttons', buttons.filter((_, idx) => idx !== i));
  const toggleRowBreak = (i) =>
    upd('buttons', buttons.map((b, idx) => (idx === i ? { ...b, row_break: !b.row_break } : b)));

  return (
    <>
      <Section title={t('Клавиатура')}>
        <Field label={t('Тип')}>
          <Sel
            value={data.button_type}
            onChange={(v) => upd('button_type', v)}
            options={[{ value: 'inline', label: 'Inline' }, { value: 'reply', label: 'Reply' }]}
          />
        </Field>
        {data.button_type === 'inline' && (
          <Toggle
            label={lang === 'en' ? 'Dynamic (build from a runtime list)' : 'Динамические (строить из списка в рантайме)'}
            value={!!data.dynamic_enabled}
            onChange={(v) => upd('dynamic_enabled', v)}
          />
        )}
        {!data.dynamic_enabled && (
          <Field label={t('Кнопки')}>
            {buttons.map((btn, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 4 }}>
                <div className="ins-btn-row">
                  <Inp value={btn.text}          onChange={(v) => updateBtn(i, 'text', v)}          placeholder={lang === 'en' ? 'Button text' : 'Текст кнопки'} />
                  <Inp value={btn.callback_data} onChange={(v) => updateBtn(i, 'callback_data', v)} placeholder="callback_data" mono />
                  <RemoveBtn onClick={() => removeBtn(i)} />
                </div>
                <ButtonStylePicker value={btn.style} onChange={(v) => updateBtn(i, 'style', v)} lang={lang} />
                {i < buttons.length - 1 && (
                  <button
                    onClick={() => toggleRowBreak(i)}
                    title={btn.row_break ? t('Убрать разрыв строки') : t('Добавить разрыв строки')}
                    style={{
                      alignSelf: 'center',
                      fontSize: 10,
                      padding: '1px 8px',
                      borderRadius: 3,
                      border: '1px dashed',
                      cursor: 'pointer',
                      background: btn.row_break ? 'var(--c-surface-2)' : 'transparent',
                      color: 'var(--c-text-muted)',
                      borderColor: 'var(--c-border)',
                      lineHeight: 1.6,
                    }}
                  >
                    {btn.row_break ? t('— новая строка —') : '· · ·'}
                  </button>
                )}
              </div>
            ))}
            <AddBtn onClick={addBtn} label={t('+ Кнопка')} />
          </Field>
        )}
      </Section>

      {data.dynamic_enabled && (
        <Section title={lang === 'en' ? 'Dynamic source' : 'Динамический источник'}>
          <Field label={lang === 'en' ? 'Iterable (Python expr)' : 'Список (Python-выражение)'}>
            <Inp value={data.dynamic_source} onChange={(v) => upd('dynamic_source', v)} placeholder="items" mono />
          </Field>
          <Field label={lang === 'en' ? 'Button text (expr, item = one entry)' : 'Текст кнопки (выраж., item = элемент)'}>
            <Inp value={data.dynamic_text_expr} onChange={(v) => upd('dynamic_text_expr', v)} placeholder="str(item)" mono />
          </Field>
          <Field label={lang === 'en' ? 'Callback value (expr)' : 'Значение колбэка (выраж.)'}>
            <Inp value={data.dynamic_callback_expr} onChange={(v) => upd('dynamic_callback_expr', v)} placeholder="str(item)" mono />
          </Field>
          <Field label={lang === 'en' ? 'Columns' : 'Кнопок в строке'}>
            <Inp type="number" value={data.dynamic_columns} onChange={(v) => upd('dynamic_columns', v)} />
          </Field>
          <Field label={lang === 'en' ? 'Clicked value → variable' : 'Значение клика → переменная'}>
            <Inp value={data.dynamic_result_var} onChange={(v) => upd('dynamic_result_var', v)} placeholder="dyn_arg" mono />
          </Field>
          <div className="ins-attach-hint ins-attach-hint--ok">
            {lang === 'en'
              ? 'Every button routes to the single "on click" output — read the clicked value from the variable above.'
              : 'Все кнопки ведут в один выход «по клику» — значение нажатой кнопки доступно через переменную выше.'}
          </div>
        </Section>
      )}

      <Section title={t('Отправка')}>
        {data.button_type !== 'reply' && (
          <Toggle
            label={t('Прикрепить к предыдущему сообщению')}
            value={!!data.attach_to_previous}
            onChange={(v) => upd('attach_to_previous', v)}
          />
        )}
        {(data.button_type === 'reply' || !data.attach_to_previous) ? (
          <Field label={t('Текст сообщения')}>
            <Inp value={data.message_text} onChange={(v) => upd('message_text', v)} placeholder="Выберите:" />
          </Field>
        ) : (
          <div className={`ins-attach-hint${canAttach ? ' ins-attach-hint--ok' : ' ins-attach-hint--warn'}`}>
            {canAttach
              ? (lang === 'en' ? `Will attach to the previous «${attachableLabel.en}» block` : `Прикрепится к предыдущему блоку «${attachableLabel.ru}»`)
              : (lang === 'en' ? '⚠ No Text/Media block right before this one — a separate message will be sent' : '⚠ Перед этим блоком нет Текста/Медиа — кнопки уйдут отдельным сообщением')}
          </div>
        )}
      </Section>

      {!data.dynamic_enabled && (
        <Section title={lang === 'en' ? 'Preview (drag to arrange)' : 'Предпросмотр (тащите для порядка)'}>
          <ButtonsPreview
            buttons={buttons}
            type={data.button_type || 'inline'}
            onChange={(next) => upd('buttons', next)}
            lang={lang}
          />
        </Section>
      )}

      {data.button_type === 'reply' && (
        <Section title={t('Параметры Reply')} defaultOpen={false}>
          <Toggle label={t('Одноразовая клавиатура')}        value={data.one_time_keyboard} onChange={(v) => upd('one_time_keyboard', v)} />
          <Toggle label={t('Подстраивать размер')}           value={data.resize_keyboard}   onChange={(v) => upd('resize_keyboard', v)} />
          <Toggle label={t('Selective (только упомянутым)')} value={data.selective}         onChange={(v) => upd('selective', v)} />
        </Section>
      )}
    </>
  );
}

const OPERATORS = ['==', '!=', '>', '<', '>=', '<=', 'contains', 'startswith', 'endswith'];

function ConditionSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  return (
    <>
      <Section title={t('Условие')}>
        <Field label={t('Режим')}>
          <Sel
            value={data.condition_mode}
            onChange={(v) => upd('condition_mode', v)}
            options={[
              { value: 'preset', label: t('Конструктор') },
              { value: 'code',   label: t('Python-выражение') },
            ]}
          />
        </Field>
        {data.condition_mode === 'code' ? (
          <Field label={t('Выражение Python')}>
            <Txt value={data.condition_expression} onChange={(v) => upd('condition_expression', v)} placeholder="message.text == 'да'" rows={3} />
          </Field>
        ) : (
          <>
            <Field label={t('Поле')}>
              <Inp value={data.field}    onChange={(v) => upd('field', v)}    placeholder="message.text" mono />
            </Field>
            <Field label={t('Оператор')}>
              <Sel value={data.operator} onChange={(v) => upd('operator', v)} options={OPERATORS.map((o) => ({ value: o, label: o }))} />
            </Field>
            <Field label={t('Значение')}>
              <Inp value={data.value}    onChange={(v) => upd('value', v)}    placeholder={lang === 'en' ? 'value' : 'значение'} />
            </Field>
          </>
        )}
      </Section>
      <Section title={t('Метки выходов')} defaultOpen={false}>
        <Field label={t('Ветка True')}>
          <Inp value={data.true_label}  onChange={(v) => upd('true_label', v)}  placeholder="Да" />
        </Field>
        <Field label={t('Ветка False')}>
          <Inp value={data.false_label} onChange={(v) => upd('false_label', v)} placeholder="Нет" />
        </Field>
      </Section>
    </>
  );
}

const COL_TYPES = ['TEXT', 'INTEGER', 'REAL', 'BLOB', 'NUMERIC'];

function DbCreateSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  const cols = data.columns ?? [];
  const updCol = (i, field, val) =>
    upd('columns', cols.map((c, idx) => (idx === i ? { ...c, [field]: val } : c)));
  const addCol = () =>
    upd('columns', [...cols, { name: '', type: 'TEXT', primary_key: false, not_null: false, unique: false, autoincrement: false }]);
  const removeCol = (i) =>
    upd('columns', cols.filter((_, idx) => idx !== i));

  return (
    <>
      <Section title={t('Таблица')}>
        <Field label={t('Имя таблицы')}>
          <Inp value={data.table_name} onChange={(v) => upd('table_name', v)} placeholder="table_name" mono />
        </Field>
        <Toggle label="IF NOT EXISTS" value={data.if_not_exists} onChange={(v) => upd('if_not_exists', v)} />
      </Section>
      <Section title={t('Столбцы')}>
        {cols.map((col, i) => (
          <div key={i} className="ins-col-block">
            <div className="ins-col-main">
              <Inp value={col.name} onChange={(v) => updCol(i, 'name', v)} placeholder="column_name" mono />
              <Sel value={col.type} onChange={(v) => updCol(i, 'type', v)} options={COL_TYPES.map((ct) => ({ value: ct, label: ct }))} />
              <RemoveBtn onClick={() => removeCol(i)} />
            </div>
            <div className="ins-col-flags">
              <Toggle label="PK" value={col.primary_key}   onChange={(v) => updCol(i, 'primary_key', v)} />
              <Toggle label="NN" value={col.not_null}       onChange={(v) => updCol(i, 'not_null', v)} />
              <Toggle label="UQ" value={col.unique}         onChange={(v) => updCol(i, 'unique', v)} />
              <Toggle label="AI" value={col.autoincrement}  onChange={(v) => updCol(i, 'autoincrement', v)} />
            </div>
          </div>
        ))}
        <AddBtn onClick={addCol} label={t('+ Столбец')} />
      </Section>
    </>
  );
}

const WRITE_MODES = [
  { value: 'INSERT',            label: 'INSERT'            },
  { value: 'INSERT OR REPLACE', label: 'INSERT OR REPLACE' },
  { value: 'INSERT OR IGNORE',  label: 'INSERT OR IGNORE'  },
  { value: 'UPDATE',            label: 'UPDATE'            },
];

function DbWriteSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  const vals = data.values ?? [];
  const updVal = (i, field, val) =>
    upd('values', vals.map((v, idx) => (idx === i ? { ...v, [field]: val } : v)));
  const addVal   = () => upd('values', [...vals, { column: '', value: '' }]);
  const removeVal = (i) => upd('values', vals.filter((_, idx) => idx !== i));

  return (
    <>
      <Section title={t('Запись')}>
        <Field label={t('Таблица')}>
          <TableSelect value={data.table_name} onChange={(v) => upd('table_name', v)} />
        </Field>
        <Field label={t('Режим')}>
          <Sel value={data.mode} onChange={(v) => upd('mode', v)} options={WRITE_MODES} />
        </Field>
      </Section>
      <Section title={t('Значения')}>
        {vals.map((v, i) => (
          <div key={i} className="ins-kv-row">
            <Inp value={v.column} onChange={(val) => updVal(i, 'column', val)} placeholder="column" mono />
            <span className="ins-kv-eq">=</span>
            <Inp value={v.value}  onChange={(val) => updVal(i, 'value', val)}  placeholder={lang === 'en' ? 'value' : 'значение'} />
            <RemoveBtn onClick={() => removeVal(i)} />
          </div>
        ))}
        <AddBtn onClick={addVal} label={t('+ Поле')} />
      </Section>
      {data.mode === 'UPDATE' && (
        <Section title={t('Условие UPDATE')}>
          <Field label={t('WHERE')}>
            <Inp value={data.where_clause} onChange={(v) => upd('where_clause', v)} placeholder="id = 1" mono />
          </Field>
        </Section>
      )}
    </>
  );
}

function DbReadSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  return (
    <>
      <Section title={t('Запрос')}>
        <Field label={t('Таблица')}>
          <TableSelect value={data.table_name} onChange={(v) => upd('table_name', v)} />
        </Field>
        <Field label={t('Столбцы (SELECT)')}>
          <Inp value={data.columns_to_select} onChange={(v) => upd('columns_to_select', v)} placeholder="* или col1, col2" mono />
        </Field>
        <Field label={t('WHERE')}>
          <Inp value={data.where_clause}      onChange={(v) => upd('where_clause', v)}      placeholder="user_id = {message.from.id}" mono />
        </Field>
      </Section>
      <Section title={t('Сортировка и лимит')} defaultOpen={false}>
        <Field label={t('ORDER BY')}>
          <Inp value={data.order_by} onChange={(v) => upd('order_by', v)} placeholder="created_at DESC" mono />
        </Field>
        <Field label={t('LIMIT')}>
          <Inp value={data.limit}    onChange={(v) => upd('limit', v)}    placeholder="10" />
        </Field>
      </Section>
      <Section title={t('Результат')}>
        <Field label={t('Переменная')}>
          <Inp value={data.result_variable} onChange={(v) => upd('result_variable', v)} placeholder="result" mono />
        </Field>
        <Field label={t('Режим выборки')}>
          <Sel
            value={data.fetch_mode}
            onChange={(v) => upd('fetch_mode', v)}
            options={[
              { value: 'one', label: t('Одна строка (fetchone)') },
              { value: 'all', label: t('Все строки (fetchall)')  },
            ]}
          />
        </Field>
      </Section>
    </>
  );
}

function DbDeleteSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  return (
    <Section title={t('Удаление')}>
      <Field label={t('Таблица')}>
        <TableSelect value={data.table_name} onChange={(v) => upd('table_name', v)} />
      </Field>
      <Field label={t('WHERE')}>
        <Inp value={data.where_clause} onChange={(v) => upd('where_clause', v)} placeholder="user_id = {message.from.id}" mono />
      </Field>
      <Toggle label={lang === 'en' ? 'Add confirmation check' : 'Добавить проверку перед удалением'} value={data.confirm} onChange={(v) => upd('confirm', v)} />
    </Section>
  );
}

const MEDIA_TYPES = [
  { value: 'photo',    label: '🖼️ Фото'     },
  { value: 'video',    label: '🎬 Видео'    },
  { value: 'gif',      label: '🎞️ GIF / Анимация' },
  { value: 'sticker',  label: '🎭 Стикер'  },
  { value: 'audio',    label: '🎵 Аудио'    },
  { value: 'document', label: '📎 Документ' },
];

function MediaSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  return (
    <>
      <Section title={t('Медиа')}>
        <Field label={t('Тип')}>
          <Sel value={data.media_type} onChange={(v) => upd('media_type', v)} options={MEDIA_TYPES} />
        </Field>
        <Field label={t('File ID или URL')}>
          <Inp value={data.file_id} onChange={(v) => upd('file_id', v)} placeholder="AgACAgIAAxkB..." mono />
        </Field>
        {data.media_type !== 'sticker' && (
          <>
            <Field label={t('Подпись (caption)')}>
              <Txt value={data.caption} onChange={(v) => upd('caption', v)} placeholder={lang === 'en' ? 'Media caption...' : 'Подпись к медиа...'} rows={3} />
            </Field>
            <Field label={t('Parse mode')}>
              <Sel value={data.parse_mode} onChange={(v) => upd('parse_mode', v)} options={PARSE_MODES} />
            </Field>
          </>
        )}
      </Section>
      <Section title={t('Параметры')} defaultOpen={false}>
        <Toggle label={t('Тихое уведомление')} value={data.disable_notification} onChange={(v) => upd('disable_notification', v)} />
      </Section>
      <Section title="Подсказка" defaultOpen={false}>
        <div style={{ fontSize: 11, color: 'var(--c-text-3)', lineHeight: 1.6 }}>
          Используйте <b>File ID</b> из Telegram или загрузите файл боту через @userinfobot.<br/>
          Поддерживается синтаксис <code style={{fontFamily:'monospace'}}>{'{'+'variable'+'}'}</code> в подписи.
        </div>
      </Section>
    </>
  );
}

const SCOPES = [
  { value: 'user',   label: '👤 На пользователя (сессия)' },
  { value: 'global', label: '🌐 Глобальная (общая)' },
];

function VariableSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  return (
    <>
      <Section title={t('Операция')}>
        <Field label={t('Действие')}>
          <Sel
            value={data.operation}
            onChange={(v) => upd('operation', v)}
            options={[{ value: 'set', label: t('Установить (set)') }, { value: 'get', label: t('Получить (get)') }]}
          />
        </Field>
        <Field label={t('Область')}>
          <Sel value={data.scope} onChange={(v) => upd('scope', v)} options={trOpts(SCOPES, lang)} />
        </Field>
        <Field label={t('Имя переменной')}>
          <Inp value={data.var_name} onChange={(v) => upd('var_name', v)} placeholder="my_var" mono />
        </Field>
        {data.operation === 'set' ? (
          <Field label={t('Значение')}>
            <Inp value={data.var_value} onChange={(v) => upd('var_value', v)} placeholder={lang === 'en' ? 'value or {message.text}' : 'значение или {message.text}'} mono />
          </Field>
        ) : (
          <Field label={t('Сохранить в переменную')}>
            <Inp value={data.result_variable} onChange={(v) => upd('result_variable', v)} placeholder="result" mono />
          </Field>
        )}
      </Section>
      <Section title="Подсказка" defaultOpen={false}>
        <div style={{ fontSize: 11.5, color: 'var(--c-text-2)', lineHeight: 1.6 }}>
          Используйте <code style={{fontFamily:'monospace'}}>{'{'+'my_var'+'}'}</code> в блоках «Текст» и «Медиа» для подстановки значения.
          <br/>Пример: <code style={{fontFamily:'monospace'}}>Привет, {'{'+'username'+'}'}</code>
        </div>
      </Section>
    </>
  );
}

const LIST_OPS = [
  { value: 'create', label: 'Создать список'      },
  { value: 'append', label: 'Добавить элемент'    },
  { value: 'remove', label: 'Удалить элемент'     },
  { value: 'clear',  label: 'Очистить список'     },
  { value: 'get',    label: 'Получить элемент'    },
  { value: 'length', label: 'Длина списка'        },
];

function ListSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  return (
    <>
      <Section title={t('Список')}>
        <Field label={t('Имя списка')}>
          <Inp value={data.list_name} onChange={(v) => upd('list_name', v)} placeholder="my_list" mono />
        </Field>
        <Field label={t('Область')}>
          <Sel value={data.scope} onChange={(v) => upd('scope', v)} options={trOpts(SCOPES, lang)} />
        </Field>
        <Field label={t('Операция')}>
          <Sel value={data.operation} onChange={(v) => upd('operation', v)} options={trOpts(LIST_OPS, lang)} />
        </Field>
        {['append', 'remove'].includes(data.operation) && (
          <Field label={t('Значение')}>
            <Inp value={data.value} onChange={(v) => upd('value', v)} placeholder={lang === 'en' ? 'value or {var}' : 'значение или {var}'} mono />
          </Field>
        )}
        {data.operation === 'get' && (
          <Field label={t('Индекс')}>
            <Inp value={data.index} onChange={(v) => upd('index', v)} placeholder="0" />
          </Field>
        )}
        {['get', 'length'].includes(data.operation) && (
          <Field label={t('Сохранить в переменную')}>
            <Inp value={data.result_variable} onChange={(v) => upd('result_variable', v)} placeholder="result" mono />
          </Field>
        )}
      </Section>
    </>
  );
}

const UNITS = [
  { value: 'seconds', label: 'Секунды' },
  { value: 'minutes', label: 'Минуты'  },
  { value: 'hours',   label: 'Часы'    },
  { value: 'days',    label: 'Дни'     },
];

function TimerSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  return (
    <Section title={t('Таймер')}>
      <Field label={t('Задержка')}>
        <Inp value={String(data.delay)} onChange={(v) => upd('delay', parseFloat(v) || 1)} type="number" placeholder="5" />
      </Field>
      <Field label={t('Единица')}>
        <Sel value={data.unit} onChange={(v) => upd('unit', v)} options={trOpts(UNITS, lang)} />
      </Field>
      <div style={{ fontSize: 11.5, color: 'var(--c-text-2)', padding: '4px 0' }}>
        Бот будет ждать {data.delay} {UNITS.find(u=>u.value===data.unit)?.label?.toLowerCase() || ''} перед следующим шагом.
      </div>
    </Section>
  );
}

function AdminNotifySettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  const en = lang === 'en';
  const mode = data.admin_mode || 'id';
  const admins = data.admins && data.admins.length ? data.admins : [''];
  const updAdmin = (i, v) => upd('admins', admins.map((a, idx) => idx === i ? v : a));
  const addAdmin = () => upd('admins', [...admins, '']);
  const removeAdmin = (i) => upd('admins', admins.filter((_, idx) => idx !== i));
  return (
    <>
      <Section title={en ? 'Who is the admin?' : 'Кого считать админом?'}>
        <Field label={en ? 'Identify admins by' : 'Определять админов по'}>
          <Sel value={mode} onChange={(v) => upd('admin_mode', v)} options={[
            { value: 'id',       label: en ? 'Chat ID'   : 'ID (Chat ID)' },
            { value: 'username', label: en ? 'Username'  : 'Юзернейму (@)' },
            { value: 'tag',      label: en ? 'Tag/role'  : 'Тегу (роли)' },
          ]} />
        </Field>
        {mode === 'tag' ? (
          <>
            <Field label={en ? 'Tag (role)' : 'Тег (роль)'}>
              <Inp value={data.admin_tag} onChange={(v) => upd('admin_tag', v)} placeholder="admin" mono />
            </Field>
            <div style={{ fontSize: 11, color: 'var(--c-text-3)', lineHeight: 1.5 }}>
              {en ? 'Sends to users whose "tags" column contains this value (save it via Save User).'
                  : 'Отправит тем, у кого в колонке «tags» есть это значение (сохраняйте через «Сохранить юзера»).'}
            </div>
          </>
        ) : (
          <Field label={mode === 'username' ? (en ? 'Usernames' : 'Юзернеймы') : (en ? 'Chat IDs' : 'Chat ID')}>
            {admins.map((a, i) => (
              <div key={i} className="ins-kv-row">
                <Inp value={a} onChange={(v) => updAdmin(i, v)} placeholder={mode === 'username' ? '@admin' : '123456789'} mono />
                <RemoveBtn onClick={() => removeAdmin(i)} />
              </div>
            ))}
            <AddBtn onClick={addAdmin} label={en ? '+ add' : '+ добавить'} />
            {mode === 'username' && (
              <div style={{ fontSize: 11, color: 'var(--c-text-3)', lineHeight: 1.5, marginTop: 2 }}>
                {en ? 'Resolved from saved users (Save User must run first).'
                    : 'Берётся из сохранённых юзеров (нужен блок «Сохранить юзера»).'}
              </div>
            )}
          </Field>
        )}
        <Field label={t('Шаблон сообщения')}>
          <Txt value={data.message_template} onChange={(v) => upd('message_template', v)} placeholder="Действие от @{username}..." rows={3} />
        </Field>
      </Section>
      <Section title={t('Доступные переменные')} defaultOpen={false}>
        <div style={{ fontSize: 12, color: 'var(--c-text-2)', lineHeight: 1.8, fontFamily: 'monospace' }}>
          {[
            '{user_id}',
            '{username}',
            '{first_name}',
            '{last_name}',
            '{text}',
            '{chat_id}',
          ].map(v => <div key={v}>{v}</div>)}
        </div>
      </Section>
    </>
  );
}

const VALIDATIONS = [
  { value: 'none',   label: 'Любой текст'    },
  { value: 'number', label: 'Только цифры'   },
  { value: 'phone',  label: 'Телефон (+...)'  },
];

const SCOPES_WAIT = [
  { value: 'user',   label: 'Пользователь' },
  { value: 'global', label: 'Глобально'    },
];

function WaitInputSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  return (
    <>
      <Section title={t('Запрос ввода')}>
        <Toggle
          label={lang === 'en' ? 'Send a prompt before waiting' : 'Отправить подсказку перед ожиданием'}
          value={data.prompt_enabled !== false}
          onChange={(v) => upd('prompt_enabled', v)}
        />
        {data.prompt_enabled !== false && (
          <Field label={t('Подсказка (отправить перед ожиданием)')}>
            <Txt value={data.prompt} onChange={(v) => upd('prompt', v)} placeholder={lang === 'en' ? 'Enter a value:' : 'Введите значение:'} rows={2} />
          </Field>
        )}
        <Field label={t('Сохранить в переменную')}>
          <Inp value={data.var_name} onChange={(v) => upd('var_name', v)} placeholder="user_input" mono />
        </Field>
        <Field label={t('Область')}>
          <Sel value={data.var_scope} onChange={(v) => upd('var_scope', v)} options={trOpts(SCOPES_WAIT, lang)} />
        </Field>
        <Field label={t('Валидация')}>
          <Sel value={data.validation} onChange={(v) => upd('validation', v)} options={trOpts(VALIDATIONS, lang)} />
        </Field>
        {data.validation !== 'none' && (
          <div style={{ fontSize: 11.5, color: 'var(--c-text-2)', lineHeight: 1.5 }}>
            При неверном вводе бот повторно запросит значение.
          </div>
        )}
      </Section>
    </>
  );
}

const HTTP_METHODS = [
  { value: 'GET',  label: 'GET'  },
  { value: 'POST', label: 'POST' },
  { value: 'PUT',  label: 'PUT'  },
  { value: 'DELETE', label: 'DELETE' },
];

function HttpRequestSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  return (
    <>
      <Section title={t('Запрос')}>
        <Field label={t('Метод')}>
          <Sel value={data.method} onChange={(v) => upd('method', v)} options={HTTP_METHODS} />
        </Field>
        <Field label="URL">
          <Inp value={data.url} onChange={(v) => upd('url', v)} placeholder="https://api.example.com/data" mono />
        </Field>
        <Field label={lang === 'en' ? 'Headers (one per line: Key: Value)' : 'Заголовки (по строке: Ключ: Значение)'}>
          <Txt value={data.headers} onChange={(v) => upd('headers', v)} placeholder={'Authorization: Bearer ...\nContent-Type: application/json'} rows={2} />
        </Field>
        {['POST', 'PUT'].includes(data.method) && (
          <Field label={t('Тело запроса (JSON)')}>
            <Txt value={data.body} onChange={(v) => upd('body', v)} placeholder='{"key": "value"}' rows={3} />
          </Field>
        )}
        <Field label={t('Таймаут (сек)')}>
          <Inp value={String(data.timeout ?? 10)} onChange={(v) => upd('timeout', parseInt(v) || 10)} type="number" placeholder="10" />
        </Field>
      </Section>
      <Section title={t('Результат')}>
        <Field label={t('Сохранить ответ в переменную')}>
          <Inp value={data.result_variable} onChange={(v) => upd('result_variable', v)} placeholder="response" mono />
        </Field>
        <div style={{ fontSize: 11.5, color: 'var(--c-text-2)', lineHeight: 1.5 }}>
          Ответ сохраняется как текст. Для JSON используйте Python-код блок для разбора.
        </div>
      </Section>
    </>
  );
}

function CodeBlockSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  return (
    <>
      <Section title={t('Код')}>
        <Field label={t('Описание (необязательно)')}>
          <Inp value={data.description} onChange={(v) => upd('description', v)} placeholder={lang === 'en' ? 'What this block does' : 'Что делает этот блок'} />
        </Field>
        <Field label={t('Python-код')}>
          <Txt value={data.code} onChange={(v) => upd('code', v)} rows={10} />
        </Field>
        <div style={{ fontSize: 11.5, color: 'var(--c-text-2)', lineHeight: 1.5 }}>
          Код вставляется в тело обработчика. Доступны: <code style={{fontFamily:'monospace'}}>message</code>, <code style={{fontFamily:'monospace'}}>bot</code>, а также все переменные определённые выше.
        </div>
      </Section>
    </>
  );
}

function LoopSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  const en = lang === 'en';
  return (
    <Section title={t('Цикл')}>
      <Field label={t('Тип')}>
        <Sel
          value={data.loop_type}
          onChange={(v) => upd('loop_type', v)}
          options={[
            { value: 'count', label: en ? 'N times (range)' : 'N раз (range)' },
            { value: 'list',  label: en ? 'Over list/variable' : 'По списку/переменной' },
            { value: 'range', label: en ? 'Range (start..stop, step)' : 'Диапазон (от..до, шаг)' },
            { value: 'while', label: en ? 'While condition' : 'Пока условие (while)' },
          ]}
        />
      </Field>
      {data.loop_type === 'count' && (
        <>
          <Field label={t('Количество итераций')}>
            <Inp value={data.count} onChange={(v) => upd('count', v)} placeholder="10" mono />
          </Field>
          <Field label={t('Переменная счётчика')}>
            <Inp value={data.iter_var} onChange={(v) => upd('iter_var', v)} placeholder="i" mono />
          </Field>
        </>
      )}
      {data.loop_type === 'list' && (
        <>
          <Field label={t('Список / переменная')}>
            <Inp value={data.list_var} onChange={(v) => upd('list_var', v)} placeholder="my_list" mono />
          </Field>
          <Field label={t('Переменная элемента')}>
            <Inp value={data.item_var} onChange={(v) => upd('item_var', v)} placeholder="item" mono />
          </Field>
        </>
      )}
      {data.loop_type === 'range' && (
        <>
          <div style={{ display: 'flex', gap: 4 }}>
            <Field label={en ? 'Start' : 'От'}><Inp value={data.range_start} onChange={(v) => upd('range_start', v)} placeholder="0" mono /></Field>
            <Field label={en ? 'Stop' : 'До'}><Inp value={data.range_stop} onChange={(v) => upd('range_stop', v)} placeholder="10" mono /></Field>
            <Field label={en ? 'Step' : 'Шаг'}><Inp value={data.range_step} onChange={(v) => upd('range_step', v)} placeholder="1" mono /></Field>
          </div>
          <Field label={t('Переменная счётчика')}>
            <Inp value={data.iter_var} onChange={(v) => upd('iter_var', v)} placeholder="i" mono />
          </Field>
        </>
      )}
      {data.loop_type === 'while' && (
        <>
          <Field label={en ? 'Condition (Python)' : 'Условие (Python)'}>
            <Inp value={data.while_condition} onChange={(v) => upd('while_condition', v)} placeholder="counter < 10" mono />
          </Field>
          <Field label={en ? 'Safety limit (max iterations)' : 'Защита (макс. итераций)'}>
            <Inp value={data.max_iterations} onChange={(v) => upd('max_iterations', v)} placeholder="1000" mono />
          </Field>
        </>
      )}
      <div style={{ fontSize: 11.5, color: 'var(--c-text-2)', lineHeight: 1.5 }}>
        {en ? 'Left output — loop body, right — continue after loop.' : 'Левый выход — тело цикла, правый — продолжение после цикла.'}
        {data.loop_type === 'while' && (en ? ' The safety limit prevents infinite loops.' : ' Защита предотвращает бесконечный цикл.')}
      </div>
    </Section>
  );
}

function WebhookSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  return (
    <>
      <Section title={t('Запрос')}>
        <Field label={t('Метод')}>
          <Sel value={data.method || 'POST'} onChange={(v) => upd('method', v)} options={HTTP_METHODS} />
        </Field>
        <Field label={t('URL вебхука')}>
          <Inp value={data.url} onChange={(v) => upd('url', v)} placeholder="https://discord.com/api/webhooks/..." mono />
        </Field>
        <Field label={lang === 'en' ? 'Headers (one per line: Key: Value)' : 'Заголовки (по строке: Ключ: Значение)'}>
          <Txt value={data.headers} onChange={(v) => upd('headers', v)} placeholder={'Authorization: Bearer ...'} rows={2} />
        </Field>
        <Field label={t('JSON-тело')}>
          <Txt value={data.payload} onChange={(v) => upd('payload', v)} placeholder='{"content": "Hello!"}' rows={4} />
        </Field>
        <Field label={t('Таймаут (сек)')}>
          <Inp value={String(data.timeout ?? 10)} onChange={(v) => upd('timeout', parseInt(v) || 10)} type="number" placeholder="10" />
        </Field>
      </Section>
      <Section title={t('Результат')} defaultOpen={false}>
        <Field label={t('Сохранить статус в переменную')}>
          <Inp value={data.result_variable} onChange={(v) => upd('result_variable', v)} placeholder="wh_status" mono />
        </Field>
        <div style={{ fontSize: 11.5, color: 'var(--c-text-2)', lineHeight: 1.5 }}>
          В переменную сохраняется HTTP-статус ответа (200, 204 и т.д.).
          В JSON-теле можно использовать шаблоны: {'{message.text}'}, {'{message.from_user.first_name}'}.
        </div>
      </Section>
    </>
  );
}

const USER_FIELDS = [
  { value: 'id',            label: 'user_id' },
  { value: 'first_name',    label: 'first_name' },
  { value: 'last_name',     label: 'last_name' },
  { value: 'username',      label: 'username' },
  { value: 'language_code', label: 'language_code' },
  { value: 'is_premium',    label: 'is_premium' },
];

function GetUserInfoSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  const fields = data.fields || [];
  const addField = () => upd('fields', [...fields, { field: 'first_name', var_name: 'user_name' }]);
  const removeField = (i) => upd('fields', fields.filter((_, idx) => idx !== i));
  const updField = (i, key, val) => {
    const next = fields.map((f, idx) => idx === i ? { ...f, [key]: val } : f);
    upd('fields', next);
  };
  return (
    <>
    <Section title={t('Поля')}>
      <div className="ins-kv-row ins-kv-row--user" style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        <span style={{ flex: 1 }}>{lang === 'en' ? 'Telegram field' : 'Поле Telegram'}</span>
        <span style={{ width: 14, textAlign: 'center' }} />
        <span style={{ flex: 1 }}>{lang === 'en' ? 'Save to variable' : 'В переменную'}</span>
        <span style={{ width: 18 }} />
      </div>
      {fields.map((f, i) => (
        <div key={i} className="ins-kv-row ins-kv-row--user">
          <select className="ins-select ins-kv-sel" value={f.field} onChange={(e) => updField(i, 'field', e.target.value)}>
            {USER_FIELDS.map(({ value: v, label: l }) => <option key={v} value={v}>{l}</option>)}
          </select>
          <span className="ins-kv-eq">→</span>
          <Inp value={f.var_name} onChange={(v) => updField(i, 'var_name', v)} placeholder="var_name" mono />
          <button className="ins-remove-btn" onClick={() => removeField(i)}>×</button>
        </div>
      ))}
      <button className="ins-add-btn" onClick={addField}>{t('+ добавить поле')}</button>
    </Section>
    <Section title={lang === 'en' ? 'Hint' : 'Подсказка'} defaultOpen={false}>
      <div style={{ fontSize: 11.5, color: 'var(--c-text-2)', lineHeight: 1.6 }}>
        {lang === 'en'
          ? 'Take a Telegram field and save it into a variable you can use in other blocks, e.g. {user_name}.'
          : 'Берём поле из Telegram и сохраняем в переменную, которую потом используешь в других блоках, например {user_name}.'}
      </div>
    </Section>
    </>
  );
}

function MessageHandlerSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  return (
    <>
      <Section title={t('Фильтр')}>
        <Field label={t('Тип фильтра')}>
          <Sel value={data.filter_type || 'any'} onChange={(v) => upd('filter_type', v)} options={[
            { value: 'any',      label: t('Любой текст') },
            { value: 'contains', label: t('Содержит') },
            { value: 'equals',   label: t('Равно') },
            { value: 'regex',    label: 'Regex' },
            { value: 'command',  label: t('Команда') },
          ]} />
        </Field>
        {data.filter_type !== 'any' && (
          <Field label={t('Значение')}>
            <Inp value={data.filter_value} onChange={(v) => upd('filter_value', v)} placeholder={lang === 'en' ? 'text / pattern' : 'текст / паттерн'} mono />
          </Field>
        )}
      </Section>
      <Section title={t('Имя обработчика')} defaultOpen={false}>
        <Field label="handler_name">
          <Inp value={data.handler_name} onChange={(v) => upd('handler_name', v)} placeholder="on_message" mono />
        </Field>
      </Section>
    </>
  );
}

function BroadcastSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  const en = lang === 'en';
  const audience = data.audience || 'all';
  return (
    <Section title={t('Рассылка')}>
      <Field label={t('Текст сообщения')}>
        <Txt value={data.message_text} onChange={(v) => upd('message_text', v)} placeholder={en ? 'Broadcast text...' : 'Текст рассылки...'} />
      </Field>
      <Field label="Parse Mode">
        <Sel value={data.parse_mode || 'HTML'} onChange={(v) => upd('parse_mode', v)} options={[
          { value: 'HTML',       label: 'HTML' },
          { value: 'Markdown',   label: 'Markdown' },
          { value: 'MarkdownV2', label: 'MarkdownV2' },
        ]} />
      </Field>
      <Field label={en ? 'Send to' : 'Кому рассылать'}>
        <Sel value={audience} onChange={(v) => upd('audience', v)} options={[
          { value: 'all',       label: en ? 'Everyone'             : 'Всем' },
          { value: 'condition', label: en ? 'If condition (SQL)'   : 'Если выполняется условие (SQL)' },
          { value: 'tag',       label: en ? 'Users with a tag'     : 'У кого есть тег' },
        ]} />
      </Field>
      {audience === 'condition' && (
        <Field label={en ? 'Condition (SQL WHERE on bot_users)' : 'Условие (SQL WHERE по bot_users)'}>
          <Inp value={data.filter_sql} onChange={(v) => upd('filter_sql', v)} placeholder="score > 10" mono />
        </Field>
      )}
      {audience === 'tag' && (
        <Field label={en ? 'Tag' : 'Тег'}>
          <Inp value={data.tag} onChange={(v) => upd('tag', v)} placeholder="vip" mono />
        </Field>
      )}
      {audience !== 'all' && (
        <div style={{ fontSize: 11, color: 'var(--c-text-3)', lineHeight: 1.5 }}>
          {en ? 'Filters the saved users table (bot_users). Make sure the needed columns are saved via Save User.'
              : 'Фильтрует таблицу сохранённых юзеров (bot_users). Нужные колонки сохраняйте через «Сохранить юзера».'}
        </div>
      )}
      <Field label={t('Задержка между отправками (сек)')}>
        <Inp value={data.delay_between} onChange={(v) => upd('delay_between', parseFloat(v) || 0.05)} type="number" placeholder="0.05" />
      </Field>
    </Section>
  );
}

function DeepLinkSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  return (
    <Section title="Deep Link">
      <Field label={t('Переменная payload')}>
        <Inp value={data.payload_var} onChange={(v) => upd('payload_var', v)} placeholder="start_payload" mono />
      </Field>
      <Toggle label={t('Сохранять реферера')} value={data.save_referrer} onChange={(v) => upd('save_referrer', v)} />
      {data.save_referrer && (
        <Field label={t('Переменная реферера')}>
          <Inp value={data.referrer_var} onChange={(v) => upd('referrer_var', v)} placeholder="referrer_id" mono />
        </Field>
      )}
    </Section>
  );
}

function SaveUserSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  const en = lang === 'en';
  const fields = data.fields || [];
  const addField = () => upd('fields', [...fields, { column: '', value: '' }]);
  const removeField = (i) => upd('fields', fields.filter((_, idx) => idx !== i));
  const updField = (i, key, val) => upd('fields', fields.map((f, idx) => idx === i ? { ...f, [key]: val } : f));
  return (
    <Section title={en ? 'Fields' : 'Поля'}>
      <div className="ins-kv-row" style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        <span style={{ flex: 1 }}>{en ? 'Column' : 'Колонка'}</span>
        <span style={{ width: 10 }} />
        <span style={{ flex: 1 }}>{en ? 'Value' : 'Значение'}</span>
        <span style={{ width: 18 }} />
      </div>
      {fields.map((f, i) => (
        <div key={i} className="ins-kv-row">
          <Inp value={f.column} onChange={(v) => updField(i, 'column', v)} placeholder="column" mono />
          <span className="ins-kv-eq">=</span>
          <Inp value={f.value}  onChange={(v) => updField(i, 'value',  v)} placeholder="message.from_user.id" mono />
          <button className="ins-remove-btn" onClick={() => removeField(i)}>×</button>
        </div>
      ))}
      <button className="ins-add-btn" onClick={addField}>{t('+ поле')}</button>
    </Section>
  );
}

function ContactRequestSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  return (
    <Section title={t('Запрос контакта')}>
      <Field label={t('Сообщение-запрос')}>
        <Txt value={data.prompt} onChange={(v) => upd('prompt', v)} rows={2} placeholder={lang === 'en' ? 'Share your number...' : 'Поделитесь номером...'} />
      </Field>
      <Field label={t('Текст кнопки')}>
        <Inp value={data.button_text} onChange={(v) => upd('button_text', v)} placeholder="Поделиться номером" />
      </Field>
      <Field label={t('Переменная телефона')}>
        <Inp value={data.phone_var} onChange={(v) => upd('phone_var', v)} placeholder="user_phone" mono />
      </Field>
      <Field label={t('Переменная контакта')}>
        <Inp value={data.contact_var} onChange={(v) => upd('contact_var', v)} placeholder="user_contact" mono />
      </Field>
    </Section>
  );
}

function GoogleSheetsSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  return (
    <>
      <Section title={lang === 'en' ? 'Spreadsheet' : 'Таблица'}>
        <Field label={t('Действие')}>
          <Sel value={data.action || 'append'} onChange={(v) => upd('action', v)} options={[
            { value: 'append', label: t('Append (добавить строку)') },
            { value: 'read',   label: t('Read (прочитать)') },
          ]} />
        </Field>
        <Field label="Spreadsheet ID">
          <Inp value={data.spreadsheet_id} onChange={(v) => upd('spreadsheet_id', v)} placeholder="1BxiMVs0XRA5..." mono />
        </Field>
        <Field label={t('Лист (Sheet name)')}>
          <Inp value={data.sheet_name} onChange={(v) => upd('sheet_name', v)} placeholder="Sheet1" mono />
        </Field>
      </Section>
      <Section title={t('Данные')}>
        {data.action !== 'read' ? (
          <Field label={t('Данные строки (через запятую)')}>
            <Txt value={data.row_data} onChange={(v) => upd('row_data', v)} rows={2}
              placeholder="{user_id},{user_name},{user_phone}" />
          </Field>
        ) : (
          <Field label={t('Переменная результата')}>
            <Inp value={data.result_variable} onChange={(v) => upd('result_variable', v)} placeholder="sheets_result" mono />
          </Field>
        )}
        <Field label={t('Перем. учётных данных (env var)')}>
          <Inp value={data.credentials_var} onChange={(v) => upd('credentials_var', v)} placeholder="GOOGLE_CREDS_JSON" mono />
        </Field>
      </Section>
    </>
  );
}

function RateLimitSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  const en = lang === 'en';
  const w = data.window_seconds ?? 60;
  const n = data.max_calls ?? 3;
  const whatLabel = { any: en ? 'messages' : 'сообщений', command: en ? 'commands' : 'команд', callback: en ? 'button taps' : 'нажатий кнопок' }[data.count_what || 'any'];
  return (
    <Section title={t('Ограничение частоты')}>
      <Field label={en ? 'What counts as a request' : 'Что считать запросом'}>
        <Sel value={data.count_what || 'any'} onChange={(v) => upd('count_what', v)} options={[
          { value: 'any',      label: en ? 'Any message'        : 'Любое сообщение' },
          { value: 'command',  label: en ? 'Commands (/...)'    : 'Команды (/...)' },
          { value: 'callback', label: en ? 'Button taps'        : 'Нажатия кнопок' },
        ]} />
      </Field>
      <Field label={en ? 'Limit applies to' : 'Лимит считать'}>
        <Sel value={data.scope || 'user'} onChange={(v) => upd('scope', v)} options={[
          { value: 'user',   label: en ? 'Per user'  : 'На каждого пользователя' },
          { value: 'global', label: en ? 'Globally'  : 'На всех вместе (глобально)' },
        ]} />
      </Field>
      <Field label={en ? 'Max requests' : 'Макс. запросов'}>
        <Inp value={data.max_calls} onChange={(v) => upd('max_calls', parseInt(v) || 3)} type="number" placeholder="3" />
      </Field>
      <Field label={en ? 'Window (seconds)' : 'За сколько секунд'}>
        <Inp value={data.window_seconds} onChange={(v) => upd('window_seconds', parseInt(v) || 60)} type="number" placeholder="60" />
      </Field>
      <Field label={t('Сообщение при блокировке')}>
        <Txt value={data.blocked_message} onChange={(v) => upd('blocked_message', v)} rows={2} placeholder="Подождите немного" />
      </Field>
      <div style={{ fontSize: 11.5, color: 'var(--c-text-2)', lineHeight: 1.5 }}>
        {en
          ? `Allow up to ${n} ${whatLabel} per ${w}s ${data.scope === 'global' ? 'across all users' : 'per user'}; the rest get the message above. Right output = allowed, lower = blocked.`
          : `Не больше ${n} ${whatLabel} за ${w} сек ${data.scope === 'global' ? 'на всех' : 'на пользователя'}; остальным — сообщение выше. Выход справа — пропущено, снизу — заблокировано.`}
      </div>
    </Section>
  );
}



function CustomBlockSettings({ data, upd }) {
  const getBlockDef = useCustomBlockStore((s) => s.getBlockDef);
  const def = getBlockDef(data._customBlockId);
  if (!def) return <div style={{ padding: 12, color: '#94a3b8' }}>Block definition not found</div>;

  const grouped = new Map();
  for (const prop of def.properties) {
    const sec = prop.section || '';
    if (!grouped.has(sec)) grouped.set(sec, []);
    grouped.get(sec).push(prop);
  }

  const renderField = (prop) => {
    const val = data[prop.key] ?? prop.default ?? '';
    switch (prop.type) {
      case 'textarea':
        return <Txt value={val} onChange={(v) => upd(prop.key, v)} placeholder={prop.default || ''} rows={4} />;
      case 'number':
        return <Inp type="number" value={val} onChange={(v) => upd(prop.key, v)} placeholder={String(prop.default ?? '')} />;
      case 'toggle':
        return <Toggle label={prop.label} value={!!val} onChange={(v) => upd(prop.key, v)} />;
      case 'select':
        return (
          <Sel
            value={val}
            onChange={(v) => upd(prop.key, v)}
            options={(prop.options || []).map((o) => ({ value: o.value, label: o.label || o.value }))}
          />
        );
      case 'color':
        return <Inp type="color" value={val} onChange={(v) => upd(prop.key, v)} />;
      case 'code':
        return <Txt value={val} onChange={(v) => upd(prop.key, v)} placeholder="# code..." rows={6} />;
      default:
        return <Inp value={val} onChange={(v) => upd(prop.key, v)} placeholder={prop.default || ''} mono={prop.key.includes('url') || prop.key.includes('code')} />;
    }
  };

  return (
    <>
      {[...grouped.entries()].map(([sectionName, props]) => (
        <Section key={sectionName} title={sectionName || def.name}>
          {props.map((prop) => (
            <Field key={prop.key} label={prop.label}>
              {renderField(prop)}
            </Field>
          ))}
        </Section>
      ))}
    </>
  );
}

const PRESET_BG = [
  { value: 'rgba(255,255,255,0.04)', label: 'Прозрачный' },
  { value: 'rgba(100,116,139,0.18)', label: 'Серый' },
  { value: '#fde68a', label: 'Жёлтый' },
  { value: '#86efac', label: 'Зелёный' },
  { value: '#93c5fd', label: 'Синий' },
];
const PRESET_TEXT = [
  { value: '#d4d4d4', label: 'Светлый' },
  { value: '#1f1f1f', label: 'Тёмный' },
  { value: '#ef4444', label: 'Красный' },
  { value: '#22c55e', label: 'Зелёный' },
  { value: '#3b82f6', label: 'Синий' },
];

function ColorSwatches({ presets, value, onChange }) {
  const isPreset = presets.some((c) => c.value === value);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
      {presets.map((c) => (
        <button
          key={c.value}
          title={c.label}
          onClick={() => onChange(c.value)}
          style={{
            width: 16, height: 16, borderRadius: '50%', border: c.value === value ? '2px solid #0078d4' : '1.5px solid rgba(128,128,128,0.35)',
            background: c.value, cursor: 'pointer', padding: 0, flexShrink: 0,
            boxSizing: 'border-box', transition: 'transform 0.1s',
          }}
        />
      ))}
      <input
        type="color"
        value={isPreset ? '#ffffff' : value}
        onChange={(e) => onChange(e.target.value)}
        title="Свой цвет"
        style={{ width: 16, height: 16, border: 'none', borderRadius: 3, padding: 0, cursor: 'pointer', background: 'transparent' }}
      />
    </div>
  );
}

function CommentSettings({ data, upd }) {
  return (
    <>
      <Section title="Текст заметки">
        <Field label="Сообщение">
          <Txt value={data.text || ''} onChange={(v) => upd('text', v)} placeholder="Введите заметку..." rows={5} />
        </Field>
      </Section>
      <Section title="Оформление">
        <Field label="Цвет фона">
          <ColorSwatches presets={PRESET_BG} value={data.color || 'rgba(255,255,255,0.04)'} onChange={(v) => upd('color', v)} />
        </Field>
        <Field label="Цвет текста">
          <ColorSwatches presets={PRESET_TEXT} value={data.textColor || '#d4d4d4'} onChange={(v) => upd('textColor', v)} />
        </Field>
      </Section>
    </>
  );
}

function GroupSettings({ data, upd, nodeId }) {
  const nodes          = useStore((s) => s.nodes);
  const selectionIds   = useStore((s) => s.selectionIds);
  const removeFromGroup = useStore((s) => s.removeFromGroup);
  const addToGroup     = useStore((s) => s.addToGroup);

  const childIds = data._childIds || [];
  const childNodes = childIds
    .map((cid) => nodes.find((n) => n.id === cid))
    .filter(Boolean)
    .filter((n) => n.type !== 'group_frame');

  const selectableToAdd = selectionIds.filter(
    (id) => id !== nodeId && !childIds.includes(id) &&
    nodes.find((n) => n.id === id && n.type !== 'group_frame')
  );

  return (
    <>
      <Section title="Группа">
        <Field label="Название">
          <Inp value={data.label || ''} onChange={(v) => upd('label', v)} placeholder="Группа" />
        </Field>
        <Field label="Размер (ш × в)">
          <div style={{ display: 'flex', gap: 4 }}>
            <Inp value={String(Math.round(data._width  || 320))} onChange={(v) => upd('_width',  Number(v))} placeholder="320" />
            <Inp value={String(Math.round(data._height || 220))} onChange={(v) => upd('_height', Number(v))} placeholder="220" />
          </div>
        </Field>
      </Section>
      <Section title={`Блоки внутри (${childNodes.length})`}>
        {childNodes.length === 0 ? (
          <div style={{ padding: '6px 8px', color: 'var(--c-text-3)', fontSize: 11 }}>Нет блоков</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {childNodes.map((n) => {
              const def = BLOCK_DEFS[n.type];
              return (
                <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px', fontSize: 11, borderRadius: 3, background: 'var(--c-surface-2)' }}>
                  <span style={{ fontSize: 13 }}>{def?.icon || '⬡'}</span>
                  <span style={{ flex: 1, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{def?.label || n.type}</span>
                  {n.data?.command_name && <span style={{ color: 'var(--c-text-3)', fontFamily: 'monospace', fontSize: 10 }}>{n.data.command_name}</span>}
                  <button
                    onClick={() => removeFromGroup(nodeId, n.id)}
                    title="Удалить из группы"
                    style={{ flexShrink: 0, width: 16, height: 16, border: 'none', background: 'transparent', color: 'var(--c-text-3)', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1, borderRadius: '50%' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--c-text-3)'; }}
                  >×</button>
                </div>
              );
            })}
          </div>
        )}
        <button
          className="ins-add-btn"
          style={{ marginTop: 6 }}
          onClick={() => { if (selectableToAdd.length) addToGroup(nodeId, selectableToAdd); }}
          disabled={selectableToAdd.length === 0}
          title={selectableToAdd.length ? `Добавить ${selectableToAdd.length} выделенных блока` : 'Выделите блоки на холсте чтобы добавить'}
        >
          {selectableToAdd.length ? `+ Добавить ${selectableToAdd.length} выделенных` : '+ Добавить выделенные'}
        </button>
      </Section>
    </>
  );
}

function ScheduleSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  const isDaily = data.schedule_type !== 'interval';
  return (
    <>
      <Section title={t('Когда запускать')}>
        <Field label={t('Тип')}>
          <Sel
            value={data.schedule_type || 'daily'}
            onChange={(v) => upd('schedule_type', v)}
            options={trOpts([
              { value: 'daily', label: 'Ежедневно, в определённое время' },
              { value: 'interval', label: 'Через интервал' },
            ], lang)}
          />
        </Field>
        {isDaily ? (
          <Field label={t('Время (ЧЧ:ММ)')}>
            <Inp value={data.time_of_day} onChange={(v) => upd('time_of_day', v)} placeholder="09:00" mono />
          </Field>
        ) : (
          <Field label={t('Интервал')}>
            <div style={{ display: 'flex', gap: 6 }}>
              <Inp type="number" value={data.interval_value} onChange={(v) => upd('interval_value', v)} placeholder="30" />
              <Sel
                value={data.interval_unit || 'minutes'}
                onChange={(v) => upd('interval_unit', v)}
                options={trOpts([
                  { value: 'seconds', label: 'секунд' },
                  { value: 'minutes', label: 'минут' },
                  { value: 'hours',   label: 'часов' },
                ], lang)}
              />
            </div>
          </Field>
        )}
      </Section>
      <Section title={t('Для кого')}>
        <Field label={t('Аудитория')}>
          <Sel
            value={data.audience || 'all'}
            onChange={(v) => upd('audience', v)}
            options={trOpts([
              { value: 'all',       label: 'Все зарегистрированные юзеры' },
              { value: 'condition', label: 'По условию (SQL WHERE)' },
              { value: 'tag',       label: 'С определённым тегом' },
              { value: 'once',      label: 'Без пользователей — один раз' },
            ], lang)}
          />
        </Field>
        {data.audience === 'condition' && (
          <Field label="WHERE">
            <Inp value={data.filter_sql} onChange={(v) => upd('filter_sql', v)} placeholder="score > 10" mono />
          </Field>
        )}
        {data.audience === 'tag' && (
          <Field label={t('Тег')}>
            <Inp value={data.tag} onChange={(v) => upd('tag', v)} placeholder="vip" mono />
          </Field>
        )}
      </Section>
      <div style={{ padding: '0 8px', fontSize: 11, color: 'var(--c-text-3)', lineHeight: 1.5 }}>
        {lang === 'en'
          ? 'This starts a background loop — the chain connected below runs without a real incoming message. It gets a stand-in "message" per user (from_user/chat/text), so Text/Buttons/Save User/etc. blocks work as usual.'
          : 'Это фоновый цикл — подключённая ниже цепочка выполняется без настоящего входящего сообщения. Ей подставляется "message"-заглушка на каждого юзера (from_user/chat/text), поэтому блоки Текст/Кнопки/Сохранить юзера и т.д. работают как обычно.'}
      </div>
    </>
  );
}

function EditMessageSettings({ data, upd, lang, nodeId }) {
  const t = (s) => tr(s, lang);
  const buttons = data.buttons ?? [];

  const edges = useStore((s) => s.edges);
  const allNodes = useStore((s) => s.nodes);
  const incoming = nodeId ? edges.find((e) => e.target === nodeId) : null;
  const prevNode = incoming ? allNodes.find((n) => n.id === incoming.source) : null;
  const fromButtonClick = incoming?.sourceHandle?.startsWith('btn_') || prevNode?.type === 'edit_message';

  const updateBtn = (i, field, val) =>
    upd('buttons', buttons.map((b, idx) => (idx === i ? { ...b, [field]: val } : b)));
  const addBtn = () =>
    upd('buttons', [...buttons, { text: lang === 'en' ? `Button ${buttons.length + 1}` : `Кнопка ${buttons.length + 1}`, callback_data: `ebtn_${buttons.length + 1}`, row_break: false }]);
  const removeBtn = (i) => upd('buttons', buttons.filter((_, idx) => idx !== i));

  return (
    <>
      <div className={`ins-attach-hint${fromButtonClick ? ' ins-attach-hint--ok' : ' ins-attach-hint--warn'}`}>
        {fromButtonClick
          ? (lang === 'en' ? 'OK — reached from a button click, this message can be edited.' : 'ОК — блок достигнут по нажатию кнопки, сообщение можно редактировать.')
          : (lang === 'en' ? '⚠ Works only right after an inline button click — otherwise Telegram rejects the edit.' : '⚠ Работает только сразу после нажатия inline-кнопки — иначе Telegram вернёт ошибку.')}
      </div>
      <Section title={t('Текст')}>
        <Toggle label={lang === 'en' ? 'Change text' : 'Менять текст'} value={data.edit_text !== false} onChange={(v) => upd('edit_text', v)} />
        {data.edit_text !== false && (
          <>
            <Txt value={data.new_text} onChange={(v) => upd('new_text', v)} placeholder={lang === 'en' ? 'New text' : 'Новый текст'} />
            <Field label={t('Parse mode')}>
              <Sel value={data.parse_mode} onChange={(v) => upd('parse_mode', v)} options={PARSE_MODES} />
            </Field>
          </>
        )}
      </Section>
      <Section title={t('Кнопки')}>
        <Toggle label={lang === 'en' ? 'Replace buttons' : 'Менять кнопки'} value={!!data.edit_markup} onChange={(v) => upd('edit_markup', v)} />
        {data.edit_markup && (
          <Field label={t('Кнопки')}>
            {buttons.map((btn, i) => (
              <div key={i} className="ins-btn-row" style={{ marginBottom: 4 }}>
                <Inp value={btn.text}          onChange={(v) => updateBtn(i, 'text', v)}          placeholder={lang === 'en' ? 'Button text' : 'Текст кнопки'} />
                <Inp value={btn.callback_data} onChange={(v) => updateBtn(i, 'callback_data', v)} placeholder="callback_data" mono />
                <RemoveBtn onClick={() => removeBtn(i)} />
              </div>
            ))}
            <AddBtn onClick={addBtn} label={t('+ Кнопка')} />
          </Field>
        )}
      </Section>
    </>
  );
}

function DynamicStepSettings({ data, upd, lang }) {
  const t = (s) => tr(s, lang);
  return (
    <>
      <Section title={lang === 'en' ? 'Questions' : 'Вопросы'}>
        <Field label={lang === 'en' ? 'List of prompts (Python expr)' : 'Список вопросов (Python-выражение)'}>
          <Inp value={data.steps_source} onChange={(v) => upd('steps_source', v)} placeholder="question_list" mono />
        </Field>
      </Section>
      <Section title={t('Ответы')}>
        <Field label={t('Область видимости')}>
          <Sel
            value={data.answers_scope || 'user'}
            onChange={(v) => upd('answers_scope', v)}
            options={trOpts([
              { value: 'user',   label: 'На пользователя (личная анкета)' },
              { value: 'global', label: 'Общий список (анонимно, без ID)' },
            ], lang)}
          />
        </Field>
        <Field label={lang === 'en' ? 'List name' : 'Имя списка'}>
          <Inp value={data.answers_list_name} onChange={(v) => upd('answers_list_name', v)} placeholder="survey_answers" mono />
        </Field>
        <Field label={lang === 'en' ? 'Finish message' : 'Сообщение по завершении'}>
          <Inp value={data.finish_message} onChange={(v) => upd('finish_message', v)} />
        </Field>
      </Section>
      <div style={{ padding: '0 8px', fontSize: 11, color: 'var(--c-text-3)', lineHeight: 1.5 }}>
        {lang === 'en'
          ? 'Shows each prompt from the list, one at a time, waiting for a reply between each — the number of questions is decided at runtime, not at design time.'
          : 'Показывает вопросы из списка по одному, ожидая ответ после каждого — количество вопросов решается в момент выполнения, а не при проектировании.'}
      </div>
    </>
  );
}

const SETTINGS_MAP = {
  command:         CommandSettings,
  text:            TextSettings,
  buttons:         ButtonsSettings,
  condition:       ConditionSettings,
  db_create_table: DbCreateSettings,
  db_write:        DbWriteSettings,
  db_read:         DbReadSettings,
  db_delete:       DbDeleteSettings,
  media:           MediaSettings,
  variable:        VariableSettings,
  list_op:         ListSettings,
  timer:           TimerSettings,
  admin_notify:    AdminNotifySettings,
  wait_input:      WaitInputSettings,
  http_request:    HttpRequestSettings,
  code_block:      CodeBlockSettings,
  loop_for:        LoopSettings,
  webhook:         WebhookSettings,
  get_user_info:   GetUserInfoSettings,
  message_handler: MessageHandlerSettings,
  broadcast:       BroadcastSettings,
  deep_link:       DeepLinkSettings,
  save_user:       SaveUserSettings,
  contact_request: ContactRequestSettings,
  google_sheets:   GoogleSheetsSettings,
  rate_limit:      RateLimitSettings,
  custom_block:    CustomBlockSettings,
  group_frame:     GroupSettings,
  comment:         CommentSettings,
  schedule:        ScheduleSettings,
  edit_message:    EditMessageSettings,
  dynamic_step:    DynamicStepSettings,
};


function NodeInspector() {
  const nodes          = useStore((s) => s.nodes);
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useStore((s) => s.setSelectedNodeId);
  const updateNodeData = useStore((s) => s.updateNodeData);
  const lang           = useStore((s) => s.lang);
  const T              = useT();

  const getBlockDef = useCustomBlockStore((s) => s.getBlockDef);
  const node     = nodes.find((n) => n.id === selectedNodeId) ?? null;

  let def = node ? BLOCK_DEFS[node.type] : null;
  if (node?.type === 'custom_block' && node.data._customBlockId) {
    const cbDef = getBlockDef(node.data._customBlockId);
    if (cbDef) def = { label: cbDef.name, icon: cbDef.icon, color: cbDef.color };
  }

  const isCodeBlock = node?.type?.startsWith('codeblock_');
  const codeBlockDefId = isCodeBlock ? node.data._codeBlockId : null;
  if (isCodeBlock && codeBlockDefId) {
    const cbDef = getBlockDef(codeBlockDefId);
    if (cbDef) def = { label: cbDef.name, icon: cbDef.icon, color: cbDef.color };
  }
  const CodeInspector = codeBlockDefId ? getCodeBlockInspector(codeBlockDefId) : null;

  const Settings = node && !isCodeBlock ? SETTINGS_MAP[node.type] : null;

  const upd = (field, value) => {
    if (node) updateNodeData(node.id, { [field]: value });
  };

  return (
    <div
      className={`node-inspector${selectedNodeId ? ' node-inspector--open' : ''}`}
      style={{ '--node-color': def?.color ?? '#2196f3' }}
    >
      <div className="ins-header">
        <div className="ins-header__stripe" />
        {node ? (
          <span className="ins-header__icon">{def?.icon ?? '⚙'}</span>
        ) : null}
        <span className="ins-header__title">
          {node
            ? (lang === 'en' ? (def?.label_en || def?.label || 'Block') : (def?.label || 'Block'))
            : T('panel.properties')}
        </span>
        {node && (
          <button className="ins-header__close" onClick={() => setSelectedNodeId(null)} title="Deselect">×</button>
        )}
      </div>

      <div className="ins-body">
        {Settings && node ? (
          <Settings data={node.data} upd={upd} lang={lang} nodeId={node.id} />
        ) : CodeInspector && node ? (
          <CodeInspector
            nodeId={node.id}
            data={node.data}
            onChange={(patch) => updateNodeData(node.id, patch)}
          />
        ) : (
          <div className="ins-empty">{T('ins.selectBlock')}</div>
        )}
      </div>
    </div>
  );
}

export default NodeInspector;
