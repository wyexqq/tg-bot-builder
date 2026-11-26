import { useState, useCallback, useMemo, useRef, Component } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  Background,
  useNodesState,
  useEdgesState,
  ConnectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getCodeBlockComponent, getCodeBlockInspector } from '../../customBlocks/dynamicNodeRegistry';

const PREVIEW_NODE_ID = 'preview_node';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch() {}
  reset() { this.setState({ error: null }); }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '10px 12px',
          background: 'rgba(248,81,73,0.08)',
          border: '1px solid #f85149',
          borderRadius: 3,
          fontFamily: "'Cascadia Code','Consolas',monospace",
          fontSize: 11,
          color: '#ffa198',
          wordBreak: 'break-all',
          lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: '#f85149' }}>
            ✗ Runtime error in {this.props.label}
          </div>
          {String(this.state.error)}
        </div>
      );
    }
    return this.props.children;
  }
}

function makeInitialNode(blockId, definition) {
  return {
    id: PREVIEW_NODE_ID,
    type: `codeblock_${blockId}`,
    position: { x: 60, y: 60 },
    data: {
      _codeBlockId: blockId,
      label: definition?.name  || 'Блок',
      icon:  definition?.icon  || '🧩',
      color: definition?.color || '#6366f1',
    },
    selected: false,
  };
}

function PreviewCanvas({ blockId, definition, nodeTypes, onNodeClick }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([makeInitialNode(blockId, definition)]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const rfRef = useRef(null);

  const handleReset = useCallback(() => {
    setNodes([makeInitialNode(blockId, definition)]);
    setEdges([]);
  }, [blockId, definition, setNodes, setEdges]);

  const onInit = useCallback((instance) => {
    rfRef.current = instance;
    setTimeout(() => instance.fitView({ padding: 0.4, duration: 200 }), 50);
  }, []);

  const currentNode = nodes.find((n) => n.id === PREVIEW_NODE_ID);

  return (
    <>
      <div className="bide__preview-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => onNodeClick(node, currentNode?.data, setNodes)}
          onPaneClick={() => onNodeClick(null, null, null)}
          onInit={onInit}
          connectionMode={ConnectionMode.Loose}
          fitView
          deleteKeyCode={null}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} color="#1e2535" />
        </ReactFlow>

        <div className="bide__preview-toolbar">
          <button className="bide__btn" onClick={handleReset} title="Сбросить данные блока">
            ↺ Сбросить
          </button>
        </div>
      </div>
    </>
  );
}

function PreviewPane({ blockId, definition, onClose }) {
  const [selectedData, setSelectedData]     = useState(null);
  const [setNodesRef, setSetNodesRef]       = useState(null);

  const NodeComponent     = getCodeBlockComponent(blockId);
  const InspectorComponent = getCodeBlockInspector(blockId);

  const nodeTypes = useMemo(() => {
    if (!NodeComponent) return {};
    return { [`codeblock_${blockId}`]: NodeComponent };
  }, [blockId, NodeComponent]);

  const handleNodeClick = useCallback((node, data, setNodes) => {
    if (!node) { setSelectedData(null); setSetNodesRef(null); return; }
    setSelectedData(data);
    setSetNodesRef(() => setNodes);
  }, []);

  const handleInspectorChange = useCallback((patch) => {
    if (!setNodesRef) return;
    setSelectedData((prev) => ({ ...prev, ...patch }));
    setNodesRef((nds) =>
      nds.map((n) =>
        n.id === PREVIEW_NODE_ID ? { ...n, data: { ...n.data, ...patch } } : n
      )
    );
  }, [setNodesRef]);

  if (!NodeComponent) {
    return (
      <div className="bide__preview-pane">
        <div className="bide__preview-empty">
          Нажмите «⚡ Проверить» чтобы скомпилировать блок
        </div>
      </div>
    );
  }

  return (
    <div className="bide__preview-pane">
      <div className="bide__preview-canvas">
        <div className="bide__preview-header">
          <span className="bide__preview-header-title">👁 ПРЕВЬЮ</span>
          <button className="bide__preview-header-close" onClick={onClose} title="Закрыть превью">×</button>
        </div>

        <ErrorBoundary label="Node.jsx">
          <ReactFlowProvider>
            <PreviewCanvas
              blockId={blockId}
              definition={definition}
              nodeTypes={nodeTypes}
              onNodeClick={handleNodeClick}
            />
          </ReactFlowProvider>
        </ErrorBoundary>
      </div>

      <div className={`bide__preview-inspector${selectedData ? ' bide__preview-inspector--open' : ''}`}>
        {selectedData ? (
          <>
            <div className="bide__preview-inspector-header">
              <span>НАСТРОЙКИ</span>
              <button
                className="bide__btn"
                style={{ padding: '0 6px', fontSize: 14 }}
                onClick={() => { setSelectedData(null); setSetNodesRef(null); }}
              >×</button>
            </div>
            <div className="bide__preview-inspector-body">
              {InspectorComponent ? (
                <ErrorBoundary label="Inspector.jsx">
                  <InspectorComponent
                    nodeId={PREVIEW_NODE_ID}
                    data={selectedData}
                    onChange={handleInspectorChange}
                  />
                </ErrorBoundary>
              ) : (
                <div style={{ color: '#484f58', fontSize: 11, padding: 8 }}>
                  Inspector.jsx not defined
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="bide__preview-inspector-hint">
            Нажмите на блок<br />для настройки
          </div>
        )}
      </div>
    </div>
  );
}

export default PreviewPane;
