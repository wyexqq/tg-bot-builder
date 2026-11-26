import { Handle, Position } from 'reactflow';
import BaseNode from './BaseNode';
import { BLOCK_DEFS } from '../blockDefinitions';

function MessageHandlerNode({ id, data, selected, isConnectable }) {
  const def = BLOCK_DEFS.message_handler;
  const typeLabels = { any: 'любой текст', contains: 'содержит', equals: 'равно', regex: 'regex', command: 'команда' };
  const preview = data.filter_type === 'any'
    ? 'любое сообщение'
    : `${typeLabels[data.filter_type] || data.filter_type}: ${data.filter_value || '…'}`;

  return (
    <BaseNode nodeId={id} color={def.color} icon={def.icon} label={def.label} selected={selected} preview={preview}>
      <Handle type="source" position={Position.Bottom} id="out" isConnectable={isConnectable} style={{ '--node-color': def.color }} />
    </BaseNode>
  );
}

export default MessageHandlerNode;
