import { Handle, Position } from 'reactflow';
import BaseNode from './BaseNode';
import { BLOCK_DEFS } from '../blockDefinitions';

function DeepLinkNode({ id, data, selected, isConnectable }) {
  const def = BLOCK_DEFS.deep_link;
  const preview = `/start → ${data.payload_var || 'start_payload'}`;

  return (
    <BaseNode nodeId={id} color={def.color} icon={def.icon} label={def.label} selected={selected} preview={preview}>
      <Handle type="source" position={Position.Bottom} id="out" isConnectable={isConnectable} style={{ '--node-color': def.color }} />
    </BaseNode>
  );
}

export default DeepLinkNode;
