import { Handle, Position } from 'reactflow';
import BaseNode from './BaseNode';
import { BLOCK_DEFS } from '../blockDefinitions';

function CustomCodeNode({ id, data, selected, isConnectable }) {
  const def = BLOCK_DEFS.code_block;

  const firstLine = (data.code || '')
    .split('\n')
    .find((l) => l.trim() && !l.trim().startsWith('#')) || '';
  const preview = data.description || firstLine.slice(0, 38) || 'Пустой блок';

  return (
    <BaseNode nodeId={id} color={def.color} icon={def.icon} label={def.label} selected={selected} preview={preview}>
      <Handle type="target" position={Position.Top}    id="in"  isConnectable={isConnectable} style={{ '--node-color': def.color }} />
      <Handle type="source" position={Position.Bottom} id="out" isConnectable={isConnectable} style={{ '--node-color': def.color }} />
    </BaseNode>
  );
}

export default CustomCodeNode;
