import { Handle, Position } from 'reactflow';
import BaseNode from './BaseNode';
import { BLOCK_DEFS } from '../blockDefinitions';

function HttpRequestNode({ id, data, selected, isConnectable }) {
  const def = BLOCK_DEFS.http_request;
  const url = data.url || '';
  const short = url.replace(/^https?:\/\//, '').slice(0, 30);
  const preview = `${data.method || 'GET'} ${short}${url.length > 33 ? '…' : ''}`;

  return (
    <BaseNode nodeId={id} color={def.color} icon={def.icon} label={def.label} selected={selected} preview={preview}>
      <Handle type="target" position={Position.Top}    id="in"  isConnectable={isConnectable} style={{ '--node-color': def.color }} />
      <Handle type="source" position={Position.Bottom} id="out" isConnectable={isConnectable} style={{ '--node-color': def.color }} />
    </BaseNode>
  );
}

export default HttpRequestNode;
