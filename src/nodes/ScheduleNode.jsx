import { Handle, Position } from 'reactflow';
import BaseNode from './BaseNode';
import { BLOCK_DEFS } from '../blockDefinitions';

function ScheduleNode({ id, data, selected, isConnectable }) {
  const def = BLOCK_DEFS.schedule;
  const when = data.schedule_type === 'interval'
    ? `каждые ${data.interval_value || 30} ${data.interval_unit === 'seconds' ? 'сек' : data.interval_unit === 'hours' ? 'ч' : 'мин'}`
    : `ежедневно в ${data.time_of_day || '09:00'}`;
  const who = data.audience === 'condition' ? 'по условию'
    : data.audience === 'tag' ? `тег «${data.tag || '?'}»`
    : data.audience === 'once' ? 'без пользователей'
    : 'все юзеры';
  const preview = `${when} · ${who}`;

  return (
    <BaseNode nodeId={id} color={def.color} icon={def.icon} label={def.label} selected={selected} preview={preview}>
      <Handle type="source" position={Position.Bottom} id="out" isConnectable={isConnectable} style={{ '--node-color': def.color }} />
    </BaseNode>
  );
}

export default ScheduleNode;
