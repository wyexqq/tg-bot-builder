import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background, Controls, ControlButton, MiniMap, Panel, ConnectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';
import useStore from '../store/useStore';
import useCustomBlockStore from '../customBlocks/customBlockStore';
import { useT } from '../i18n';
import { BLOCK_DEFS } from '../blockDefinitions';
import { setFlowInstance, getFlowInstance } from '../flowInstance';
import { edgeEnter, edgeLeave } from '../edgeHover';
import nodeTypes from '../nodes';
import edgeTypes from '../edges';
import { subscribeRegistry, getNodeTypesSnapshot } from '../customBlocks/dynamicNodeRegistry';
import SelectionToolbar from './SelectionToolbar';
import ContextMenu from './ContextMenu';
import { Icon } from './Icons';
import './FlowCanvas.css';

const defaultEdgeOptions = {
  type: 'deletable',
  style: { strokeWidth: 2 },
};

function EdgeMarkers() {
  const mk = (id, color) => (
    <marker id={id} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
      <path d="M1 1.2 L8.8 5 L1 8.8 Z" style={{ fill: color }} />
    </marker>
  );
  return (
    <svg className="tgb-markers" width="0" height="0" aria-hidden="true">
      <defs>
        {mk('tgb-arrow', 'var(--edge)')}
        {mk('tgb-arrow-accent', 'var(--accent)')}
        {mk('tgb-arrow-hot', 'var(--err)')}
        {mk('tgb-arrow-hover', 'var(--accent-2)')}
      </defs>
    </svg>
  );
}

function FlowCanvas() {
  const T                   = useT();
  const [dynamicTypes, setDynamicTypes] = useState(() => getNodeTypesSnapshot());
  useEffect(() => subscribeRegistry(() => setDynamicTypes(getNodeTypesSnapshot())), []);
  const mergedNodeTypes = useMemo(() => ({ ...nodeTypes, ...dynamicTypes }), [dynamicTypes]);
  const nodesRaw           = useStore((s) => s.nodes);
  const edges              = useStore((s) => s.edges);
  const nodeErrors         = useStore((s) => s.nodeErrors);

  const nodes = useMemo(() => nodesRaw.map((n) => {
    const cls = [];
    const errs = nodeErrors[n.id];
    if (errs?.length) cls.push(errs.some((e) => e.level === 'error') ? 'rf-node-error' : 'rf-node-warning');
    if (!cls.length) return n;
    const className = [n.className, ...cls].filter(Boolean).join(' ');
    return { ...n, className };
  }), [nodesRaw, nodeErrors]);

  const onNodesChange       = useStore((s) => s.onNodesChange);
  const onEdgesChange       = useStore((s) => s.onEdgesChange);
  const onConnect           = useStore((s) => s.onConnect);
  const addNode             = useStore((s) => s.addNode);
  const isDark              = useStore((s) => s.isDark);
  const setSelectedNodeId   = useStore((s) => s.setSelectedNodeId);
  const setSelectionIds     = useStore((s) => s.setSelectionIds);
  const setHoveredEdgeId    = useStore((s) => s.setHoveredEdgeId);
  const setHoveredNodeId    = useStore((s) => s.setHoveredNodeId);
  const duplicateNodes      = useStore((s) => s.duplicateNodes);
  const deleteNodes         = useStore((s) => s.deleteNodes);
  const toggleNodeDisabled  = useStore((s) => s.toggleNodeDisabled);
  const setIsUserEditingCode = useStore((s) => s.setIsUserEditingCode);
  const undo                = useStore((s) => s.undo);
  const redo                = useStore((s) => s.redo);
  const selectionIds        = useStore((s) => s.selectionIds);
  const selectedNodeId      = useStore((s) => s.selectedNodeId);
  const isUserEditingCode   = useStore((s) => s.isUserEditingCode);

  const panelConfig    = useStore((s) => s.panelConfig);
  const setPanelProp   = useStore((s) => s.setPanelProp);
  const startFloatDrag = useStore((s) => s.startFloatDrag);
  const canvasCfg      = panelConfig.canvas;

  const wrapperRef = useRef(null);
  const [rfInstance, setRfInstanceLocal] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null);

  const [selBox, setSelBox] = useState(null);

  const isUserEditingRef = useRef(false);
  isUserEditingRef.current = isUserEditingCode;

  const onInit = useCallback((inst) => {
    setRfInstanceLocal(inst);
    setFlowInstance(inst);
  }, []);


  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    if (!rfInstance || !wrapperRef.current) return;
    const type = e.dataTransfer.getData('application/reactflow');
    if (!type) return;

    let ox = 125, oy = 17;
    try {
      const raw = e.dataTransfer.getData('application/nodeoffset');
      if (raw) { const p = JSON.parse(raw); ox = p.x ?? 125; oy = p.y ?? 17; }
    } catch {}

    const position = rfInstance.screenToFlowPosition({ x: e.clientX - ox, y: e.clientY - oy });

    if (type === 'custom_block') {
      const cbId = e.dataTransfer.getData('application/customblockid');
      const cbDef = useCustomBlockStore.getState().getBlockDef(cbId);
      if (!cbDef) return;
      const defaultData = { _customBlockId: cbId };
      for (const prop of cbDef.properties) {
        defaultData[prop.key] = prop.default ?? '';
      }
      addNode({ id: `custom_block_${Date.now()}`, type: 'custom_block', position, data: defaultData });
      return;
    }

    const codeCbId = type === 'code_block' ? e.dataTransfer.getData('application/customblockid') : '';
    if (codeCbId) {
      const cbId = codeCbId;
      const cbDef = useCustomBlockStore.getState().getBlockDef(cbId);
      if (!cbDef) return;
      addNode({
        id: `codeblock_${cbId}_${Date.now()}`,
        type: `codeblock_${cbId}`,
        position,
        data: { _codeBlockId: cbId, label: cbDef.name, icon: cbDef.icon, color: cbDef.color },
      });
      return;
    }

    if (!BLOCK_DEFS[type]) return;
    const blockCfg  = useStore.getState().paletteConfig?.blocks?.[type];
    const baseData  = blockCfg?.customDefaultData ?? BLOCK_DEFS[type].defaultData;
    addNode({
      id: `${type}_${Date.now()}`,
      type,
      position,
      data: JSON.parse(JSON.stringify(baseData)),
    });
  }, [rfInstance, addNode]);

  const stateRef = useRef({});
  stateRef.current = { selectionIds, selectedNodeId, duplicateNodes, undo, redo };

  useEffect(() => {
    const off = window.electron?.ipcRenderer.on('shortcut', (name) => {
      if (name === 'duplicate') {
        const { selectionIds: sIds, selectedNodeId: sId, duplicateNodes: dup } = stateRef.current;
        const rf = getFlowInstance();
        const rfIds = rf ? rf.getNodes().filter((n) => n.selected).map((n) => n.id) : [];
        const ids = rfIds.length > 0 ? rfIds : sIds.length > 0 ? sIds : sId ? [sId] : [];
        if (ids.length > 0) dup(ids);
      }
    });
    return () => { if (typeof off === 'function') off(); };
  }, []); // eslint-disable-line

  const onNodeContextMenu = useCallback((e, node) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, nodeId: node.id, nodeType: node.type, disabled: !!node.data.disabled });
  }, []);

  const handleFitView = useCallback(() => {
    const rf = getFlowInstance();
    if (rf) rf.fitView({ padding: 0.15, duration: 300 });
  }, []);

  const onFlowWrapMouseDown = useCallback((e) => {
    const focused = document.activeElement;
    if (focused?.closest?.('.monaco-editor')) {
      focused.blur();
    }

    if (e.button !== 1) return;
    e.preventDefault();
    setSelBox({ sx: e.clientX, sy: e.clientY, ex: e.clientX, ey: e.clientY });
  }, []);

  useEffect(() => {
    if (!selBox) return;

    const onMove = (e) => {
      setSelBox((prev) => prev ? { ...prev, ex: e.clientX, ey: e.clientY } : null);
    };

    const onUp = (e) => {
      if (e.button !== 1) return;
      if (rfInstance && selBox) {
        const minX = Math.min(selBox.sx, selBox.ex);
        const maxX = Math.max(selBox.sx, selBox.ex);
        const minY = Math.min(selBox.sy, selBox.ey);
        const maxY = Math.max(selBox.sy, selBox.ey);

        if (maxX - minX > 4 && maxY - minY > 4) {
          const flowMin = rfInstance.screenToFlowPosition({ x: minX, y: minY });
          const flowMax = rfInstance.screenToFlowPosition({ x: maxX, y: maxY });

          const rfNodes = rfInstance.getNodes();
          const selectedIds = rfNodes
            .filter((n) => {
              const pos = n.positionAbsolute ?? n.position;
              const nw = n.width ?? 200, nh = n.height ?? 80;
              return pos.x < flowMax.x && pos.x + nw > flowMin.x &&
                     pos.y < flowMax.y && pos.y + nh > flowMin.y;
            })
            .map((n) => n.id);

          onNodesChange(rfNodes.map((n) => ({
            type: 'select',
            id: n.id,
            selected: selectedIds.includes(n.id),
          })));
          if (selectedIds.length > 0) {
            setSelectionIds(selectedIds);
            setSelectedNodeId(selectedIds[0]);
          }
        }
      }
      setSelBox(null);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [selBox, rfInstance, onNodesChange, setSelectionIds, setSelectedNodeId]);

  const onPanelHeaderMouseDown = useCallback((e) => {
    if (e.button !== 0 || !canvasCfg.floating) return;
    e.stopPropagation();
    startFloatDrag('canvas', e.clientX, e.clientY);
  }, [canvasCfg.floating, startFloatDrag]);

  return (
    <div className="flow-canvas">
      <EdgeMarkers />
      <div className="canvas-label glass strong" onMouseDown={onPanelHeaderMouseDown}
           style={canvasCfg.floating ? { cursor: 'move' } : undefined}>
        <Icon name="flow" size={13} stroke={1.9} />
        <span>{T('canvas.title')}</span>
        <span className="canvas-label__count">{nodes.length}</span>
      </div>
      <div className="canvas-actions glass strong">
        <button
          className="canvas-act"
          onClick={() => setPanelProp('canvas', 'fullscreen', !canvasCfg.fullscreen)}
          title={canvasCfg.fullscreen ? T('panel.restore') : T('panel.fullscreen')}
        >
          <Icon name={canvasCfg.fullscreen ? 'minimize' : 'maximize'} size={14} />
        </button>
      </div>

      <div className="flow-wrap" ref={wrapperRef} onMouseDown={onFlowWrapMouseDown} tabIndex={-1}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={() => setHoveredEdgeId(null)}
          onConnectEnd={() => setHoveredEdgeId(null)}
          onInit={onInit}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={mergedNodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          connectionLineStyle={{ stroke: 'var(--accent)', strokeWidth: 2, strokeDasharray: '5 4' }}
          connectionMode={ConnectionMode.Strict}
          onNodeClick={(_, node) => { setSelectedNodeId(node.id); setIsUserEditingCode(false); setCtxMenu(null); wrapperRef.current?.focus(); }}
          onPaneClick={() => { setSelectedNodeId(null); setIsUserEditingCode(false); setCtxMenu(null); wrapperRef.current?.focus(); }}
          onSelectionChange={({ nodes: sel }) => {
            setSelectionIds(sel.map((n) => n.id));
            if (sel.length === 0) setSelectedNodeId(null);
          }}
          onEdgeMouseEnter={(_, edge) => edgeEnter(setHoveredEdgeId, edge.id)}
          onEdgeMouseLeave={() => edgeLeave(setHoveredEdgeId)}
          onNodeContextMenu={onNodeContextMenu}
          onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
          onNodeMouseLeave={() => setHoveredNodeId(null)}
          isValidConnection={(c) => c.source !== c.target}
          deleteKeyCode="Delete"
          multiSelectionKeyCode="Shift"
          selectionKeyCode="Shift"
          panOnDrag={[0]}
          minZoom={0.05}
          fitView
          proOptions={{ hideAttribution: true }}
        >

          <Controls showInteractive={false} showFitView={false} position="bottom-left">
            <ControlButton onClick={handleFitView} title="Показать всё">
              <Icon name="fit" size={14} />
            </ControlButton>
          </Controls>

          <MiniMap
            nodeColor={isDark ? 'rgba(255,255,255,.28)' : 'rgba(15,23,42,.22)'}
            nodeBorderRadius={6}
            style={{ width: 150, height: 100 }}
            maskColor={isDark ? 'rgba(0,0,0,.35)' : 'rgba(240,243,248,.6)'}
            zoomable
            pannable
          />

          {nodes.length === 0 && (
            <Panel position="top-center" style={{ pointerEvents: 'none', marginTop: 80 }}>
              <div className="canvas-empty-hint">
                <div className="canvas-empty-hint__icon"><Icon name="blocks" size={22} /></div>
                <div className="canvas-empty-hint__text">{T('canvas.empty')}</div>
                <div className="canvas-empty-hint__sub">{T('canvas.emptySub')}</div>
              </div>
            </Panel>
          )}

          <Panel position="bottom-center" style={{ pointerEvents: 'none', marginBottom: 14 }}>
            <SelectionToolbar />
          </Panel>
        </ReactFlow>

        {selBox && (
          <div
            className="sel-box-overlay"
            style={{
              left:   Math.min(selBox.sx, selBox.ex),
              top:    Math.min(selBox.sy, selBox.ey),
              width:  Math.abs(selBox.ex - selBox.sx),
              height: Math.abs(selBox.ey - selBox.sy),
            }}
          />
        )}
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          nodeId={ctxMenu.nodeId} nodeType={ctxMenu.nodeType} disabled={ctxMenu.disabled}
          onDelete={() => deleteNodes([ctxMenu.nodeId])}
          onDuplicate={() => duplicateNodes([ctxMenu.nodeId])}
          onToggleDisabled={() => toggleNodeDisabled(ctxMenu.nodeId)}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

export default FlowCanvas;
