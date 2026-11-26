import { Handle, Position } from 'reactflow';
import BaseNode from './BaseNode';
import { BLOCK_DEFS } from '../blockDefinitions';

function LoopNode({ id, data, selected, isConnectable }) {
  const def = BLOCK_DEFS.loop_for;
  let preview;
  if (data.loop_type === 'list') {
    preview = `for ${data.item_var || 'item'} in ${data.list_var || '…'}`;
  } else if (data.loop_type === 'range') {
    preview = `for ${data.iter_var || 'i'} in range(${data.range_start ?? '0'}, ${data.range_stop ?? '10'}, ${data.range_step ?? '1'})`;
  } else if (data.loop_type === 'while') {
    preview = `while ${data.while_condition || 'True'}`;
  } else {
    preview = `for ${data.iter_var || 'i'} in range(${data.count || '10'})`;
  }

  return (
    <BaseNode nodeId={id} icon={def.icon} label={def.label} selected={selected} preview={preview}>
      <Handle type="target" position={Position.Top} id="in" isConnectable={isConnectable} />
      <div className="condition-footer">
        <span className="condition-footer__label">тело</span>
        <span className="condition-footer__label">после</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="body" isConnectable={isConnectable} style={{ left: '25%' }} />
      <Handle type="source" position={Position.Bottom} id="out"  isConnectable={isConnectable} style={{ left: '75%' }} />
    </BaseNode>
  );
}

export default LoopNode;
