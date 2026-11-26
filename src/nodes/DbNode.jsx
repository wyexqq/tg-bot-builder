import { Handle, Position } from 'reactflow';
import BaseNode from './BaseNode';
import { BLOCK_DEFS } from '../blockDefinitions';

const PREVIEWS = {
  db_create_table: (d) => `${d.table_name} · ${(d.columns || []).length} столбцов`,
  db_write:        (d) => `${d.mode || 'INSERT'} → ${d.table_name}`,
  db_read:         (d) => `SELECT ${d.columns_to_select || '*'} FROM ${d.table_name}`,
  db_delete:       (d) => `DELETE FROM ${d.table_name}`,
};

function DbNode({ id, data, type, selected, isConnectable }) {
  const def = BLOCK_DEFS[type];
  const preview = PREVIEWS[type]?.(data) ?? def.label;

  return (
    <BaseNode nodeId={id} color={def.color} icon={def.icon} label={def.label} selected={selected} preview={preview}>
      <Handle type="target" position={Position.Top}    id="in"  isConnectable={isConnectable} style={{ '--node-color': def.color }} />
      <Handle type="source" position={Position.Bottom} id="out" isConnectable={isConnectable} style={{ '--node-color': def.color }} />
    </BaseNode>
  );
}

export default DbNode;
