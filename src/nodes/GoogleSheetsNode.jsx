import { Handle, Position } from 'reactflow';
import BaseNode from './BaseNode';
import { BLOCK_DEFS } from '../blockDefinitions';

function GoogleSheetsNode({ id, data, selected, isConnectable }) {
  const def = BLOCK_DEFS.google_sheets;
  const actionLabels = { append: 'append', read: 'read', update: 'update' };
  const preview = `${actionLabels[data.action] || 'append'} → ${data.sheet_name || 'Sheet1'}`;

  return (
    <BaseNode nodeId={id} color={def.color} icon={def.icon} label={def.label} selected={selected} preview={preview}>
      <Handle type="target" position={Position.Top}    id="in"  isConnectable={isConnectable} style={{ '--node-color': def.color }} />
      <Handle type="source" position={Position.Bottom} id="out" isConnectable={isConnectable} style={{ '--node-color': def.color }} />
    </BaseNode>
  );
}

export default GoogleSheetsNode;
