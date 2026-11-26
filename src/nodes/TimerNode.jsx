import { Handle, Position } from 'reactflow';
import BaseNode from './BaseNode';
import { BLOCK_DEFS } from '../blockDefinitions';

const UNIT_LABELS = { seconds: 'сек', minutes: 'мин', hours: 'ч', days: 'дн' };

function TimerNode({ id, data, selected, isConnectable }) {
  const def = BLOCK_DEFS.timer;
  const unit = UNIT_LABELS[data.unit] || data.unit;
  const preview = `${data.delay ?? '?'} ${unit}`;

  return (
    <BaseNode nodeId={id} icon={def.icon} label={def.label} selected={selected} preview={preview}>
      <Handle type="target" position={Position.Top}    id="in"  isConnectable={isConnectable} />
      <Handle type="source" position={Position.Bottom} id="out" isConnectable={isConnectable} />
    </BaseNode>
  );
}

export default TimerNode;
