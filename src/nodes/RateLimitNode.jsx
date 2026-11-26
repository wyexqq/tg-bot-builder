import { Handle, Position } from 'reactflow';
import BaseNode from './BaseNode';
import { BLOCK_DEFS } from '../blockDefinitions';

function RateLimitNode({ id, data, selected, isConnectable }) {
  const def = BLOCK_DEFS.rate_limit;
  const preview = `${data.max_calls || 3} раз / ${data.window_seconds || 60} сек`;

  return (
    <BaseNode nodeId={id} icon={def.icon} label={def.label} selected={selected} preview={preview} mono={false}>
      <Handle type="target" position={Position.Top} id="in" isConnectable={isConnectable} />
      <div className="condition-footer">
        <span className="condition-footer__label condition-footer__label--true">можно</span>
        <span className="condition-footer__label condition-footer__label--false">лимит</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="allowed" isConnectable={isConnectable} style={{ left: '25%' }} />
      <Handle type="source" position={Position.Bottom} id="blocked" isConnectable={isConnectable} style={{ left: '75%' }} />
    </BaseNode>
  );
}

export default RateLimitNode;
