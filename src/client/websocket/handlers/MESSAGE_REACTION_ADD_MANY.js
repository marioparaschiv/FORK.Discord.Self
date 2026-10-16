'use strict';

module.exports = (client, { d: data }) => {
  const { reactions, ...target } = data;

  // Debounced reactions are always normal reactions, so they carry no type
  for (const { users, emoji } of reactions) {
    for (const userId of users) {
      client.actions.MessageReactionAdd.handle({ ...target, user_id: userId, emoji, type: 0, burst: false });
    }
  }
};
