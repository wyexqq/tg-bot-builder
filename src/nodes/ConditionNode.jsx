import { Handle, Position } from 'reactflow';
import BaseNode from './BaseNode';
import { BLOCK_DEFS } from '../blockDefinitions';

function ConditionNode({ id, data, selected, isConnectable }) {
  const def = BLOCK_DEFS.condition;
  const preview = data.condition_mode === 'code'
    ? (data.condition_expression || '…')
    : `${data.field || '?'} ${data.operator || '=='} "${data.value || ''}"`;

  return (
    <BaseNode nodeId={id} color={def.color} icon={def.icon} label={def.label} selected={selected} preview={preview}>
      <Handle type="target" position={Position.Top} id="in" isConnectable={isConnectable} style={{ '--node-color': def.color }} />
      <div className="condition-footer">
        <span className="condition-footer__label condition-footer__label--true">{data.true_label  || 'Да'}</span>
        <span className="condition-footer__label condition-footer__label--false">{data.false_label || 'Нет'}</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="true"  isConnectable={isConnectable} style={{ '--node-color': '#22c55e', left: '25%' }} />
      <Handle type="source" position={Position.Bottom} id="false" isConnectable={isConnectable} style={{ '--node-color': '#ef4444', left: '75%' }} />
    </BaseNode>
  );
}

export default ConditionNode;
