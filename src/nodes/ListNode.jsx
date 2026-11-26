import { Handle, Position } from 'reactflow';
import BaseNode from './BaseNode';
import { BLOCK_DEFS } from '../blockDefinitions';

const OP_LABELS = { create: 'создать', append: 'добавить', remove: 'удалить', clear: 'очистить', get: 'получить', length: 'длина' };

function ListNode({ id, data, selected, isConnectable }) {
  const def = BLOCK_DEFS.list_op;
  const op = OP_LABELS[data.operation] || data.operation;
  const preview = `${data.list_name}${data.value ? ` ← ${data.value}` : ''}`;

  return (
    <BaseNode nodeId={id} icon={def.icon} label={def.label} selected={selected} preview={preview}
              tag={data.scope === 'global' ? `${op} · общий` : op}>
      <Handle type="target" position={Position.Top}    id="in"  isConnectable={isConnectable} />
      <Handle type="source" position={Position.Bottom} id="out" isConnectable={isConnectable} />
    </BaseNode>
  );
}

export default ListNode;
