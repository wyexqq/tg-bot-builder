import { Handle, Position } from 'reactflow';
import BaseNode from './BaseNode';
import { BLOCK_DEFS } from '../blockDefinitions';

function WaitInputNode({ id, data, selected, isConnectable }) {
  const def = BLOCK_DEFS.wait_input;
  const showPrompt = data.prompt_enabled !== false && data.prompt;
  const preview = showPrompt
    ? `"${data.prompt.slice(0, 30)}${data.prompt.length > 30 ? '…' : ''}" → ${data.var_name}`
    : `→ ${data.var_name}`;

  return (
    <BaseNode nodeId={id} color={def.color} icon={def.icon} label={def.label} selected={selected} preview={preview}>
      <Handle type="target" position={Position.Top}    id="in"  isConnectable={isConnectable} style={{ '--node-color': def.color }} />
      <Handle type="source" position={Position.Bottom} id="out" isConnectable={isConnectable} style={{ '--node-color': def.color }} />
    </BaseNode>
  );
}

export default WaitInputNode;
