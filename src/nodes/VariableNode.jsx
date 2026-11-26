import { Handle, Position } from 'reactflow';
import BaseNode from './BaseNode';
import { BLOCK_DEFS } from '../blockDefinitions';

function VariableNode({ id, data, selected, isConnectable }) {
  const def = BLOCK_DEFS.variable;
  const preview = data.operation === 'set'
    ? `${data.var_name} = ${data.var_value || '?'}`
    : `${data.result_variable || data.var_name} ← ${data.var_name}`;

  return (
    <BaseNode nodeId={id} icon={def.icon} label={def.label} selected={selected} preview={preview}
              tag={data.scope === 'global' ? 'общая' : null}>
      <Handle type="target" position={Position.Top}    id="in"  isConnectable={isConnectable} />
      <Handle type="source" position={Position.Bottom} id="out" isConnectable={isConnectable} />
    </BaseNode>
  );
}

export default VariableNode;
