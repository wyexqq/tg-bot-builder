import { Handle, Position } from 'reactflow';
import BaseNode from './BaseNode';
import { BLOCK_DEFS } from '../blockDefinitions';

function SaveUserNode({ id, data, selected, isConnectable }) {
  const def = BLOCK_DEFS.save_user;
  const rows = (data.fields && data.fields.length)
    ? data.fields
    : [{ column: 'user_id' }, { column: 'username' }, { column: 'first_name' }, { column: 'last_name' }];
  const cols = rows.map((f) => f.column).filter(Boolean);

  let shown = [];
  let len = 0;
  for (const c of cols) {
    if (len + c.length + 2 > 28 && shown.length) break;
    shown.push(c);
    len += c.length + 2;
  }
  const rest = cols.length - shown.length;
  const preview = shown.join(', ') + (rest > 0 ? ` +${rest}` : '');

  return (
    <BaseNode nodeId={id} color={def.color} icon={def.icon} label={def.label} selected={selected} preview={preview}>
      <Handle type="target" position={Position.Top}    id="in"  isConnectable={isConnectable} style={{ '--node-color': def.color }} />
      <Handle type="source" position={Position.Bottom} id="out" isConnectable={isConnectable} style={{ '--node-color': def.color }} />
    </BaseNode>
  );
}

export default SaveUserNode;
