import common from './uk/common.js';
import auth from './uk/auth.js';
import nav from './uk/nav.js';
import settings from './uk/settings.js';
import chat from './uk/chat.js';
import errors from './uk/errors.js';

export default {
  ...common,
  ...auth,
  ...nav,
  ...settings,
  ...chat,
  ...errors,
};
