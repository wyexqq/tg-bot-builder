import { Handle, Position } from 'reactflow';
import BaseNode from './BaseNode';
import { BLOCK_DEFS } from '../blockDefinitions';

function GetUserInfoNode({ id, data, selected, isConnectable }) {
  const def = BLOCK_DEFS.get_user_info;
  const fields = data.fields || [];
  const preview = fields.length > 0
    ? fields.map(f => `${f.field}→${f.var_name}`).join(', ')
    : 'нет полей';

  return (
    <BaseNode nodeId={id} color={def.color} icon={def.icon} label={def.label} selected={selected} preview={preview}>
      <Handle type="target" position={Position.Top}    id="in"  isConnectable={isConnectable} style={{ '--node-color': def.color }} />
      <Handle type="source" position={Position.Bottom} id="out" isConnectable={isConnectable} style={{ '--node-color': def.color }} />
    </BaseNode>
  );
}

export default GetUserInfoNode;
