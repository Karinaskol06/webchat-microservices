/** @typedef {{ id: string, text: string, done: boolean }} TodoTask */
/** @typedef {{ tasks: TodoTask[] }} TodoPayload */
/** @typedef {{ text: string, color?: string, x?: number, y?: number }} StickyPayload */
/** @typedef {{ icon?: string, text: string }} CalloutPayload */
/** @typedef {{ label?: string }} DividerPayload */

export const RICH_MESSAGE_TYPES = new Set(['TODO', 'STICKY_NOTE', 'CALLOUT']);

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

export const richPreviewLabel = (message) => {
  const type = String(message?.messageType || message?.message_type || '').toUpperCase();
  switch (type) {
    case 'TODO':
      return 'To-do list';
    case 'STICKY_NOTE':
      return 'Sticky note';
    case 'CALLOUT':
      return 'Reminder';
    default:
      return 'Message';
  }
};

export const STICKY_NOTE_COLORS = [
  '#FFE082',
  '#FFCCBC',
  '#C8E6C9',
  '#B3E5FC',
  '#E1BEE7',
  '#F8BBD0',
];
