import { Message } from '../../types';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';

interface Props { message: Message; }

export function MessageItem({ message }: Props) {
  if (message.role === 'user') return <UserMessage message={message} />;
  if (message.role === 'assistant') return <AssistantMessage message={message} />;
  return null; // skip system messages in view
}
