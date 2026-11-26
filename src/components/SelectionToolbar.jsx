import useStore from '../store/useStore';
import { useT } from '../i18n';
import './SelectionToolbar.css';

function SelectionToolbar() {
  const selectionIds   = useStore((s) => s.selectionIds);
  const duplicateNodes = useStore((s) => s.duplicateNodes);
  const deleteNodes    = useStore((s) => s.deleteNodes);
  const groupNodes     = useStore((s) => s.groupNodes);
  const lang           = useStore((s) => s.lang);
  const T              = useT();

  if (selectionIds.length === 0) return null;

  const n = selectionIds.length;
  const blockWord = n === 1
    ? T('sel.block')
    : (lang === 'ru' ? (n < 5 ? T('sel.blocks2') : T('sel.blocks5')) : T('sel.blocks5'));
  const label = `${n} ${blockWord}`;

  return (
    <div className="sel-toolbar">
      <span className="sel-toolbar__count">{label}</span>
      <div className="sel-toolbar__sep" />
      {selectionIds.length >= 2 && (
        <button
          className="sel-toolbar__btn"
          onClick={() => groupNodes(selectionIds)}
          title="Сгруппировать блоки (создать визуальный фрейм)"
        >
          ⬡ {lang === 'en' ? 'Group' : 'Группировать'}
        </button>
      )}
      <button
        className="sel-toolbar__btn"
        onClick={() => duplicateNodes(selectionIds)}
        title={T('sel.duplicate.title')}
      >
        {T('sel.duplicate')}
      </button>
      <button
        className="sel-toolbar__btn sel-toolbar__btn--danger"
        onClick={() => deleteNodes(selectionIds)}
        title={T('sel.delete.title')}
      >
        {T('sel.delete')}
      </button>
    </div>
  );
}

export default SelectionToolbar;
