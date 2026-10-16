'use strict';

const { withRecipients, withUser } = require('./READY');
const { ShardEvents } = require('../../../util/Constants');

module.exports = (client, { d: data }, shard) => {
  const {
    guilds = [],
    merged_members = [],
    merged_presences: { friends = [], guilds: guildPresences = [] } = {},
    lazy_private_channels = [],
  } = data;

  for (const channel of lazy_private_channels) client.channels._add(withRecipients(channel));

  guilds.forEach((supplementalGuild, index) => {
    const guild = client.guilds.cache.get(supplementalGuild.id);
    if (!guild) return;

    for (const member of merged_members[index] ?? []) guild.members._add(withUser(member));

    for (const presence of guildPresences[index] ?? []) {
      guild.presences._add({ ...withUser(presence), guild });
    }

    if (supplementalGuild.voice_states) {
      guild.voiceStates.cache.clear();
      for (const voiceState of supplementalGuild.voice_states) guild.voiceStates._add(voiceState);
    }
  });

  for (const presence of friends) client.presences._add(withUser(presence));

  /**
   * Emitted when the shard has received the READY_SUPPLEMENTAL payload that completes READY
   * @event WebSocketShard#readySupplemental
   * @private
   */
  shard.emit(ShardEvents.READY_SUPPLEMENTAL);
};
