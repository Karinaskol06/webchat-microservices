/** @typedef {{ id: string, text: string, done: boolean }} TodoTask */
/** @typedef {{ tasks: TodoTask[] }} TodoPayload */
/** @typedef {{ text: string, color?: string, x?: number, y?: number }} StickyPayload */
/** @typedef {{ icon?: string, text: string }} CalloutPayload */
/** @typedef {{ label?: string }} DividerPayload */

export const RICH_MESSAGE_TYPES = new Set(['TODO', 'STICKY_NOTE', 'CALLOUT', 'POLL']);

export const isRichMessageType = (type) =>
  RICH_MESSAGE_TYPES.has(String(type || '').toUpperCase());

const safeParse = (raw) => {
  if (raw == null || raw === '') return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

export const parseRichPayload = (message) => {
  const type = String(message?.messageType || message?.message_type || '').toUpperCase();
  const data = safeParse(message?.content);
  return { type, data };
};

export const serializePayload = (payload) => JSON.stringify(payload ?? {});

export const createTodoPayload = () => ({
  tasks: [{ id: crypto.randomUUID(), text: '', done: false }],
});

export const createStickyPayload = ({ x = 24, y = 24 } = {}) => ({
  text: '',
  color: '#FFE082',
  x,
  y,
});

export const createCalloutPayload = () => ({
  icon: '💡',
  text: '',
});

export const createPollPayload = ({
  question = '',
  mode = 'poll',
  anonymous = false,
  multipleChoice = false,
  maxAttempts = 1,
  showCorrectAfterAnswer = true,
  explanation = '',
  options = [],
} = {}) => ({
  question,
  mode: mode === 'test' ? 'test' : 'poll',
  anonymous: Boolean(anonymous),
  multipleChoice: Boolean(multipleChoice),
  maxAttempts: mode === 'test' ? Math.max(1, Number(maxAttempts) || 1) : 1,
  showCorrectAfterAnswer: mode === 'test' ? Boolean(showCorrectAfterAnswer) : false,
  explanation: explanation || '',
  options: options.map((o) => ({
    id: o.id || crypto.randomUUID(),
    text: o.text || '',
    ...(mode === 'test' ? { correct: Boolean(o.correct) } : {}),
  })),
  pollId: crypto.randomUUID(),
  votes: {},
});

export const inferRichMessageTypeFromPayload = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (Array.isArray(data.tasks)) return 'TODO';
  if (Array.isArray(data.options) && typeof data.question === 'string') return 'POLL';
  if ('icon' in data && typeof data.text === 'string') return 'CALLOUT';
  if (
    typeof data.text === 'string' &&
    ('color' in data || 'x' in data || 'y' in data)
  ) {
    return 'STICKY_NOTE';
  }
  return null;
};

export const inferRichMessageTypeFromContent = (raw) => {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  return inferRichMessageTypeFromPayload(safeParse(trimmed));
};

/** Prefer explicit messageType; fall back to JSON payload shape in content. */
export const resolveMessageType = (message) => {
  const explicit = String(message?.messageType || message?.message_type || '').toUpperCase();
  if (isRichMessageType(explicit)) return explicit;
  const fromContent = inferRichMessageTypeFromContent(message?.content);
  if (fromContent) return fromContent;
  return explicit || 'TEXT';
};

export const richPreviewLabelForType = (type) => {
  switch (String(type || '').toUpperCase()) {
    case 'TODO':
      return 'To-do list';
    case 'STICKY_NOTE':
      return 'Sticky note';
    case 'CALLOUT':
      return 'Callout';
    case 'POLL':
      return 'Poll';
    default:
      return null;
  }
};

export const richPreviewLabel = (message) =>
  richPreviewLabelForType(resolveMessageType(message)) ?? 'Message';

export const getAttachmentsPreview = (attachments) => {
  if (!attachments?.length) return '';
  if (attachments.length === 1) {
    const att = attachments[0];
    if (att.isImage || att.fileType === 'IMAGE') return 'Image';
    if (att.fileType === 'VIDEO') return 'Video';
    return att.filename || 'File';
  }
  return `${attachments.length} files`;
};

/** Human-readable preview for sidebars, WebSocket last line, and stored lastMessage strings. */
export const getMessagePreviewText = (message) => {
  if (message == null) return '';

  const richLabel = richPreviewLabelForType(resolveMessageType(message));
  if (richLabel) return richLabel;

  const content = message.content;
  if (content != null && String(content).trim() !== '') {
    const text = typeof content === 'string' ? content : String(content);
    const inferred = inferRichMessageTypeFromContent(text);
    if (inferred) return richPreviewLabelForType(inferred);
    return text;
  }

  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  if (attachments.length > 0) {
    return getAttachmentsPreview(attachments) || 'Attachment';
  }

  return '';
};

const richPayloadCopyText = (type, data) => {
  const upper = String(type || '').toUpperCase();
  if (upper === 'TODO' && Array.isArray(data?.tasks)) {
    const lines = data.tasks
      .map((task) => {
        const text = String(task?.text ?? '').trim();
        if (!text) return '';
        return `${task?.done ? '✓' : '○'} ${text}`;
      })
      .filter(Boolean);
    return lines.join('\n');
  }
  if (upper === 'STICKY_NOTE' && data?.text != null) {
    return String(data.text).trim();
  }
  if (upper === 'CALLOUT' && data?.text != null) {
    const icon = data.icon ? `${data.icon} ` : '';
    return `${icon}${String(data.text).trim()}`.trim();
  }
  if (upper === 'POLL' && data?.question != null) {
    return String(data.question).trim();
  }
  return '';
};

/** Plain text for clipboard when copying a message from the context menu. */
export const getMessageCopyText = (message) => {
  if (message == null) return '';

  const type = resolveMessageType(message);
  if (isRichMessageType(type)) {
    const { data } = parseRichPayload(message);
    const rich = richPayloadCopyText(type, data);
    if (rich) {
      const attachmentLine = getAttachmentsPreview(
        Array.isArray(message.attachments) ? message.attachments : [],
      );
      return attachmentLine ? `${rich}\n${attachmentLine}` : rich;
    }
  }

  const content = message.content;
  if (content != null && String(content).trim() !== '') {
    const text = typeof content === 'string' ? content : String(content);
    const inferred = inferRichMessageTypeFromContent(text);
    if (inferred) {
      const parsed = safeParse(text);
      const rich = richPayloadCopyText(inferred, parsed);
      if (rich) return rich;
    }
    return text.trim();
  }

  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  if (attachments.length > 0) {
    const names = attachments
      .map((att) => att?.filename)
      .filter((name) => name != null && String(name).trim() !== '');
    if (names.length > 0) return names.join('\n');
    return getAttachmentsPreview(attachments) || '';
  }

  return '';
};

export const STICKY_NOTE_COLORS = [
  '#FFE082',
  '#FFCCBC',
  '#C8E6C9',
  '#B3E5FC',
  '#E1BEE7',
  '#F8BBD0',
];
