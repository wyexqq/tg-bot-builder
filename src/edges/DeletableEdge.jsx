import { BaseEdge, EdgeLabelRenderer, getBezierPath } from 'reactflow';
import useStore from '../store/useStore';
import { useT } from '../i18n';
import { edgeEnter, edgeLeave } from '../edgeHover';
import './DeletableEdge.css';

function DeletableEdge({
  id,
  source,
  target,
  selected,
  sourceX, sourceY, sourcePosition,
  targetX, targetY, targetPosition,
  sourceHandleId,
  style,
  markerEnd,
}) {
  const onEdgesChange    = useStore((s) => s.onEdgesChange);
  const T                = useT();
  const hoveredEdgeId    = useStore((s) => s.hoveredEdgeId);
  const setHoveredEdgeId = useStore((s) => s.setHoveredEdgeId);
  const hoveredNodeId    = useStore((s) => s.hoveredNodeId);
  const traced = useStore((s) => {
    const p = s.tracePath;
    for (let i = 0; i + 1 < p.length; i++) if (p[i] === source && p[i + 1] === target) return true;
    return false;
  });

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    curvature: 0.5,
  });

  const nodeHovered = hoveredNodeId === source || hoveredNodeId === target;
  const active = hoveredEdgeId === id || nodeHovered;

  const hot = hoveredEdgeId === id;
  const color = hot ? 'var(--err)'
    : nodeHovered ? 'var(--accent-2)'
    : traced ? 'var(--accent)'
    : (selected ? 'var(--accent)' : 'var(--edge)');
  const marker = hot ? 'url(#tgb-arrow-hot)'
    : nodeHovered ? 'url(#tgb-arrow-hover)'
    : (traced || selected) ? 'url(#tgb-arrow-accent)'
    : 'url(#tgb-arrow)';

  const showDeleteBtn = hoveredEdgeId === id;

  const deleteEdge = (e) => {
    e.stopPropagation();
    onEdgesChange([{ type: 'remove', id }]);
  };

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={marker}
        style={{
          ...style,
          stroke:      color,
          strokeWidth: active || traced ? 2.5 : 2,
          transition:  'stroke 0.15s, stroke-width 0.15s',
        }}
      />
      {traced && <path d={edgePath} className="edge-trace-flow" />}


      <EdgeLabelRenderer>
        <div
          className={`nodrag nopan edge-delete-wrap${showDeleteBtn ? ' edge-delete-wrap--visible' : ''}`}
          style={{ transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)` }}
          onMouseEnter={() => edgeEnter(setHoveredEdgeId, id)}
          onMouseLeave={() => edgeLeave(setHoveredEdgeId)}
        >
          <button className="edge-delete-btn" onClick={deleteEdge} title={T('edge.delete')}>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default DeletableEdge;
