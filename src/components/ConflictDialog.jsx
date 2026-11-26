import './ConflictDialog.css';

function ConflictDialog({ onApplyUML, onKeepBoth, onApplyCode, onCancel }) {
  return (
    <div className="conflict-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="conflict-dialog">
        <div className="conflict-dialog__icon">⚠️</div>
        <h3 className="conflict-dialog__title">Конфликт изменений</h3>
        <p className="conflict-dialog__desc">
          Схема изменилась, но код был отредактирован вручную.<br />
          Что сделать?
        </p>
        <div className="conflict-dialog__actions">
          <button className="conflict-btn conflict-btn--primary" onClick={onApplyUML}>
            <span className="conflict-btn__icon">🔄</span>
            <span>
              <strong>Пересчитать из схемы</strong>
              <small>Код будет перегенерирован, ручные правки потеряны</small>
            </span>
          </button>
          <button className="conflict-btn" onClick={onApplyCode}>
            <span className="conflict-btn__icon">📥</span>
            <span>
              <strong>Применить код к схеме</strong>
              <small>Схема будет обновлена по коду</small>
            </span>
          </button>
          <button className="conflict-btn" onClick={onKeepBoth}>
            <span className="conflict-btn__icon">🔒</span>
            <span>
              <strong>Оставить как есть</strong>
              <small>Синхронизация временно приостановлена</small>
            </span>
          </button>
        </div>
        <button className="conflict-cancel" onClick={onCancel}>Отмена</button>
      </div>
    </div>
  );
}

export default ConflictDialog;
