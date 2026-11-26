import CommandNode from './CommandNode';
import TextNode from './TextNode';
import ButtonsNode from './ButtonsNode';
import ConditionNode from './ConditionNode';
import DbNode from './DbNode';
import MediaNode from './MediaNode';
import VariableNode from './VariableNode';
import ListNode from './ListNode';
import TimerNode from './TimerNode';
import AdminNotifyNode from './AdminNotifyNode';
import WaitInputNode from './WaitInputNode';
import HttpRequestNode from './HttpRequestNode';
import CustomCodeNode from './CustomCodeNode';
import LoopNode from './LoopNode';
import WebhookNode from './WebhookNode';
import GetUserInfoNode from './GetUserInfoNode';
import MessageHandlerNode from './MessageHandlerNode';
import BroadcastNode from './BroadcastNode';
import DeepLinkNode from './DeepLinkNode';
import SaveUserNode from './SaveUserNode';
import ContactRequestNode from './ContactRequestNode';
import GoogleSheetsNode from './GoogleSheetsNode';
import RateLimitNode from './RateLimitNode';
import CustomBlockNode from '../customBlocks/CustomBlockNode';
import CommentNode from './CommentNode';
import GroupNode from './GroupNode';
import ScheduleNode from './ScheduleNode';
import EditMessageNode from './EditMessageNode';
import DynamicStepNode from './DynamicStepNode';

const nodeTypes = {
  command:          CommandNode,
  text:             TextNode,
  buttons:          ButtonsNode,
  condition:        ConditionNode,
  db_create_table:  DbNode,
  db_write:         DbNode,
  db_read:          DbNode,
  db_delete:        DbNode,
  media:            MediaNode,
  variable:         VariableNode,
  list_op:          ListNode,
  timer:            TimerNode,
  admin_notify:     AdminNotifyNode,
  wait_input:       WaitInputNode,
  http_request:     HttpRequestNode,
  code_block:       CustomCodeNode,
  loop_for:         LoopNode,
  webhook:          WebhookNode,
  get_user_info:    GetUserInfoNode,
  message_handler:  MessageHandlerNode,
  broadcast:        BroadcastNode,
  deep_link:        DeepLinkNode,
  save_user:        SaveUserNode,
  contact_request:  ContactRequestNode,
  google_sheets:    GoogleSheetsNode,
  rate_limit:       RateLimitNode,
  custom_block:     CustomBlockNode,
  comment:          CommentNode,
  group_frame:      GroupNode,
  schedule:         ScheduleNode,
  edit_message:     EditMessageNode,
  dynamic_step:     DynamicStepNode,

};

export default nodeTypes;
