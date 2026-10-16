'use strict';

const BitField = require('./BitField');

/**
 * Data structure that makes it easy to interact with the gateway capabilities sent when identifying.
 * @extends {BitField}
 */
class GatewayCapabilities extends BitField {}

/**
 * @name GatewayCapabilities
 * @kind constructor
 * @memberof GatewayCapabilities
 * @param {GatewayCapabilitiesResolvable} [bits=0] Bit(s) to read from
 */

/**
 * Data that can be resolved to give a gateway capabilities bitfield. This can be:
 * * A string (see {@link GatewayCapabilities.FLAGS})
 * * A gateway capability
 * * An instance of GatewayCapabilities
 * * An Array of GatewayCapabilitiesResolvable
 * @typedef {string|number|GatewayCapabilities|GatewayCapabilitiesResolvable[]} GatewayCapabilitiesResolvable
 */

/**
 * Numeric gateway capabilities. All available properties:
 * * `LAZY_USER_NOTES`
 * * `NO_AFFINE_USER_IDS`
 * * `VERSIONED_READ_STATES`
 * * `VERSIONED_USER_GUILD_SETTINGS`
 * * `DEDUPE_USER_OBJECTS`
 * * `PRIORITIZED_READY_PAYLOAD`
 * * `MULTIPLE_GUILD_EXPERIMENT_POPULATIONS`
 * * `NON_CHANNEL_READ_STATES`
 * * `AUTH_TOKEN_REFRESH`
 * * `USER_SETTINGS_PROTO`
 * * `CLIENT_STATE_V2`
 * * `PASSIVE_GUILD_UPDATE`
 * * `AUTO_CALL_CONNECT`
 * * `DEBOUNCE_MESSAGE_REACTIONS`
 * * `PASSIVE_GUILD_UPDATE_V2`
 * * `CHANNEL_OBFUSCATION`
 * * `AUTO_LOBBY_CONNECT`
 * @type {Object}
 * @see {@link https://docs.discord.food/gateway/using-gateway#gateway-capabilities}
 */
GatewayCapabilities.FLAGS = {
  LAZY_USER_NOTES: 1 << 0,
  NO_AFFINE_USER_IDS: 1 << 1,
  VERSIONED_READ_STATES: 1 << 2,
  VERSIONED_USER_GUILD_SETTINGS: 1 << 3,
  DEDUPE_USER_OBJECTS: 1 << 4,
  PRIORITIZED_READY_PAYLOAD: 1 << 5,
  MULTIPLE_GUILD_EXPERIMENT_POPULATIONS: 1 << 6,
  NON_CHANNEL_READ_STATES: 1 << 7,
  AUTH_TOKEN_REFRESH: 1 << 8,
  USER_SETTINGS_PROTO: 1 << 9,
  CLIENT_STATE_V2: 1 << 10,
  PASSIVE_GUILD_UPDATE: 1 << 11,
  AUTO_CALL_CONNECT: 1 << 12,
  DEBOUNCE_MESSAGE_REACTIONS: 1 << 13,
  PASSIVE_GUILD_UPDATE_V2: 1 << 14,
  CHANNEL_OBFUSCATION: 1 << 15,
  AUTO_LOBBY_CONNECT: 1 << 16,
};

module.exports = GatewayCapabilities;
