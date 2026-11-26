import './CloseDialog.css';

function IconUnsaved() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <circle cx="12" cy="15" r="1" fill="currentColor" stroke="none"/>
      <line x1="12" y1="11" x2="12" y2="13"/>
    </svg>
  );
}

export default function CloseDialog({ onSave, onDiscard, onCancel }) {
  return (
    <div className="close-dlg-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="close-dlg">
        <div className="close-dlg__icon">
          <IconUnsaved />
        </div>
        <h3 className="close-dlg__title">Несохранённые изменения</h3>
        <p className="close-dlg__desc">Сохранить проект перед выходом?</p>

        <div className="close-dlg__actions">
          <button className="close-dlg-btn close-dlg-btn--primary" onClick={onSave}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            Сохранить
          </button>
          <button className="close-dlg-btn" onClick={onDiscard}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6M14 11v6"/>
            </svg>
            Не сохранять
          </button>
        </div>

        <button className="close-dlg-cancel" onClick={onCancel}>Отмена</button>
      </div>
    </div>
  );
}
