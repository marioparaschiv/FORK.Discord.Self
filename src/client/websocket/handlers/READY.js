'use strict';

const USER_REQUIRED_ACTION = require('./USER_REQUIRED_ACTION_UPDATE');
const { Opcodes, ShardEvents } = require('../../../util/Constants');

let ClientUser;

/**
 * Restores the user object that DEDUPE_USER_OBJECTS replaced with a `user_id`.
 * @param {Object} data The object holding the `user_id`
 * @param {Map<Snowflake, Object>} [users] The deduped users of the payload, else the user is resolved from the cache
 * @returns {Object}
 * @private
 */
function withUser({ user_id, ...data }, users) {
  return { ...data, user: users?.get(user_id) ?? { id: user_id } };
}

/**
 * Restores the recipients that DEDUPE_USER_OBJECTS replaced with `recipient_ids`.
 * @param {Object} channel The private channel
 * @param {Map<Snowflake, Object>} [users] The deduped users of the payload, else the users are resolved from the cache
 * @returns {Object}
 * @private
 */
function withRecipients({ recipient_ids, ...channel }, users) {
  return { ...channel, recipients: recipient_ids.map(id => users?.get(id) ?? { id }) };
}

/**
 * Flattens the `properties` that CLIENT_STATE_V2 nests the guild's own fields under.
 * @param {Object} guild The gateway guild
 * @returns {Object}
 * @private
 */
function withProperties({ properties, ...guild }) {
  return { ...properties, ...guild };
}

/**
 * Fills the client's cache from a READY payload, without sending anything to the gateway or emitting any event.
 * @param {Client} client The client
 * @param {Object} data The READY payload
 * @param {WebSocketShard} shard The shard the payload was received on
 * @private
 */
function patchCache(client, data, shard) {
  const { capabilities } = client.ws;
  const dedupe = capabilities.has('DEDUPE_USER_OBJECTS');
  const users = dedupe ? new Map(data.users.map(user => [user.id, user])) : undefined;

  // Overwrite ClientPresence
  client.presence.userId = data.user.id;

  if (client.user) {
    client.user._patch(data.user);
  } else {
    ClientUser ??= require('../../../structures/ClientUser');
    client.user = new ClientUser(client, data.user);
    client.users.cache.set(client.user.id, client.user);
  }
  client.users.pin(client.user.id);

  if (dedupe) {
    for (const user of data.users) client.users._add(user);
  }

  for (const private_channel of data.private_channels) {
    client.channels._add(dedupe ? withRecipients(private_channel, users) : private_channel);
  }

  data.guilds.forEach((guild, index) => {
    if (capabilities.has('CLIENT_STATE_V2')) guild = withProperties(guild);

    if (dedupe) {
      guild = {
        ...guild,
        members: data.merged_members?.[index]?.map(member => withUser(member, users)),
        presences: data.merged_presences?.guilds?.[index]?.map(presence => withUser(presence, users)),
      };
    }

    guild.shardId = shard.id;
    client.guilds._add(guild);
  });

  if (dedupe) {
    for (const presence of data.merged_presences?.friends ?? []) client.presences._add(withUser(presence, users));
  }

  // User Notes
  if (!capabilities.has('LAZY_USER_NOTES')) client.notes._reload(data.notes);

  // Relationship
  client.relationships._setup(data.relationships);

  // ClientSetting
  client.settings._patch(data.user_settings);

  // GuildSetting
  const userGuildSettings = capabilities.has('VERSIONED_USER_GUILD_SETTINGS')
    ? data.user_guild_settings?.entries
    : data.user_guild_settings;

  for (const gSetting of Array.isArray(userGuildSettings) ? userGuildSettings : []) {
    const guild = client.guilds.cache.get(gSetting.guild_id);
    if (guild) guild.settings._patch(gSetting);
  }
  // Todo: data.auth_session_id_hash
  client.sessions.currentSessionIdHash = data.auth_session_id_hash;
}

module.exports = (client, { d: data }, shard) => {
  const { capabilities } = client.ws;

  // Check
  USER_REQUIRED_ACTION(client, { d: data });

  patchCache(client, data, shard);

  if (capabilities.has('AUTH_TOKEN_REFRESH') && data.auth_token) client.token = data.auth_token;

  // A wait left by an earlier session that closed before its READY_SUPPLEMENTAL must not complete this one
  shard.removeAllListeners(ShardEvents.READY_SUPPLEMENTAL);

  // The gateway ignores PRIORITIZED_READY_PAYLOAD without DEDUPE_USER_OBJECTS
  const supplemental = capabilities.has(['PRIORITIZED_READY_PAYLOAD', 'DEDUPE_USER_OBJECTS'])
    ? new Promise(resolve => shard.once(ShardEvents.READY_SUPPLEMENTAL, resolve))
    : undefined;

  if (client.options.guildSubscriptions && data.guilds.length) {
    if (data.guilds.length > 80) {
      // Split data bc 15kb
      const data1 = data.guilds.slice(0, Math.floor(data.guilds.length / 2));
      const data2 = data.guilds.slice(Math.floor(data.guilds.length / 2));
      client.ws.broadcast({
        op: Opcodes.GUILD_SUBSCRIPTIONS_BULK,
        d: {
          subscriptions: data1.reduce((accumulator, guild) => {
            accumulator[guild.id] = {
              typing: true,
              threads: true,
              activities: true,
              member_updates: true,
              thread_member_lists: [],
              members: [],
              channels: {},
            };
            return accumulator;
          }, {}),
        },
      });
      client.ws.broadcast({
        op: Opcodes.GUILD_SUBSCRIPTIONS_BULK,
        d: {
          subscriptions: data2.reduce((accumulator, guild) => {
            accumulator[guild.id] = {
              typing: true,
              threads: true,
              activities: true,
              member_updates: true,
              thread_member_lists: [],
              members: [],
              channels: {},
            };
            return accumulator;
          }, {}),
        },
      });
    } else {
      client.ws.broadcast({
        op: Opcodes.GUILD_SUBSCRIPTIONS_BULK,
        d: {
          subscriptions: data.guilds.reduce((accumulator, guild) => {
            accumulator[guild.id] = {
              typing: true,
              threads: true,
              activities: true,
              member_updates: true,
              thread_member_lists: [],
              members: [],
              channels: {},
            };
            return accumulator;
          }, {}),
        },
      });
    }
  }

  Promise.all([
    ...data.private_channels.map(async (c, index) => {
      if (client.options.DMChannelVoiceStatusSync < 1) return;
      client.ws.broadcast({
        op: Opcodes.DM_UPDATE,
        d: {
          channel_id: c.id,
        },
      });
      await client.sleep(client.options.DMChannelVoiceStatusSync * index);
    }),
    supplemental,
  ]).then(() => shard.checkReady());
};

module.exports.patchCache = patchCache;
module.exports.withUser = withUser;
module.exports.withRecipients = withRecipients;
module.exports.withProperties = withProperties;
