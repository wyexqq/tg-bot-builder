import { Handle, Position } from 'reactflow';
import BaseNode from './BaseNode';
import { BLOCK_DEFS } from '../blockDefinitions';

function AdminNotifyNode({ id, data, selected, isConnectable }) {
  const def = BLOCK_DEFS.admin_notify;
  const preview = data.admin_chat_id
    ? `→ ${data.admin_chat_id}: ${(data.message_template || '').slice(0, 28)}`
    : `Нет ID администратора`;

  return (
    <BaseNode nodeId={id} icon={def.icon} label={def.label} selected={selected} preview={preview}>
      <Handle type="target" position={Position.Top}    id="in"  isConnectable={isConnectable} />
      <Handle type="source" position={Position.Bottom} id="out" isConnectable={isConnectable} />
    </BaseNode>
  );
}

export default AdminNotifyNode;
