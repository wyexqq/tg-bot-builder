import { Handle, Position } from 'reactflow';
import BaseNode from './BaseNode';
import { BLOCK_DEFS } from '../blockDefinitions';

function TextNode({ id, data, selected, isConnectable }) {
  const def = BLOCK_DEFS.text;
  const preview = (data.message_text || '').slice(0, 400);

  return (
    <BaseNode nodeId={id} icon={def.icon} label={def.label} selected={selected} preview={preview}>
      <Handle type="target" position={Position.Top}    id="in"  isConnectable={isConnectable} />
      <Handle type="source" position={Position.Bottom} id="out" isConnectable={isConnectable} />
    </BaseNode>
  );
}

export default TextNode;
