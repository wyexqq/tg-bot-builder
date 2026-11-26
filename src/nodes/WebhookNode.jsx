import { Handle, Position } from 'reactflow';
import BaseNode from './BaseNode';
import { BLOCK_DEFS } from '../blockDefinitions';

function WebhookNode({ id, data, selected, isConnectable }) {
  const def = BLOCK_DEFS.webhook;
  let domain = '…';
  if (data.url) {
    try { domain = new URL(data.url).hostname; }
    catch { domain = data.url.slice(0, 28); }
  }
  const preview = `POST → ${domain}`;

  return (
    <BaseNode nodeId={id} color={def.color} icon={def.icon} label={def.label} selected={selected} preview={preview}>
      <Handle type="target" position={Position.Top}    id="in"  isConnectable={isConnectable} style={{ '--node-color': def.color }} />
      <Handle type="source" position={Position.Bottom} id="out" isConnectable={isConnectable} style={{ '--node-color': def.color }} />
    </BaseNode>
  );
}

export default WebhookNode;
