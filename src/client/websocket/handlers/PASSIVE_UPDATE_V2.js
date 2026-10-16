'use strict';

module.exports = (client, { d: data }) => {
  const guild = client.guilds.cache.get(data.guild_id);
  if (!guild) return;

  const { updated_channels = [], updated_members = [], updated_voice_states = [], removed_voice_states = [] } = data;

  for (const unread of updated_channels) {
    const channel = guild.channels.cache.get(unread.id);
    if (!channel || !('lastMessageId' in channel)) continue;

    channel.lastMessageId = unread.last_message_id;
    if ('last_pin_timestamp' in unread) {
      channel.lastPinTimestamp = unread.last_pin_timestamp ? Date.parse(unread.last_pin_timestamp) : null;
    }
  }

  for (const member of updated_members) guild.members._add(member);

  for (const voiceState of updated_voice_states) {
    client.actions.VoiceStateUpdate.handle({ ...voiceState, guild_id: guild.id });
  }

  for (const userId of removed_voice_states) {
    client.actions.VoiceStateUpdate.handle({ guild_id: guild.id, user_id: userId, channel_id: null });
  }
};
