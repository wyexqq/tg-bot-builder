import { Handle, Position } from 'reactflow';
import BaseNode from './BaseNode';
import { BLOCK_DEFS } from '../blockDefinitions';

const TYPE_LABELS = { photo: 'фото', video: 'видео', gif: 'GIF', sticker: 'стикер', audio: 'аудио', document: 'документ' };

function MediaNode({ id, data, selected, isConnectable }) {
  const def = BLOCK_DEFS.media;
  const typeLabel = TYPE_LABELS[data.media_type] || data.media_type;
  const preview = (data.caption || data.file_id || '').slice(0, 300);

  return (
    <BaseNode nodeId={id} icon={def.icon} label={def.label} selected={selected} preview={preview} tag={typeLabel}
              mono={!data.caption && !!data.file_id}>
      <Handle type="target" position={Position.Top}    id="in"  isConnectable={isConnectable} />
      <Handle type="source" position={Position.Bottom} id="out" isConnectable={isConnectable} />
    </BaseNode>
  );
}

export default MediaNode;
