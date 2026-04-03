'use strict';

const CachedManager = require('./CachedManager');
const { Presence } = require('../structures/Presence');

/**
 * Manages API methods for Presences and holds their cache.
 * @extends {CachedManager}
 */
class PresenceManager extends CachedManager {
  constructor(client, iterable) {
    super(client, Presence, iterable);

    this._interceptCache(presence => this._releaseUserReference(presence));
  }

  /**
   * The cache of Presences
   * @type {Collection<Snowflake, Presence>}
   * @name PresenceManager#cache
   */

  _add(data, cache) {
    const existing = cache ? this.cache.get(data.user.id) : null;
    const presence = super._add(data, cache, { id: data.user.id });

    if (cache && !existing) {
      this.client.users.retainPresence(data.user.id);
    }

    return presence;
  }

  _releaseUserReference(presence) {
    this.client.users.releasePresence(presence?.userId);
  }

  _releaseUserReferences() {
    for (const presence of this.cache.values()) {
      this._releaseUserReference(presence);
    }
  }

  /**
   * Data that can be resolved to a Presence object. This can be:
   * * A Presence
   * * A UserResolvable
   * * A Snowflake
   * @typedef {Presence|UserResolvable|Snowflake} PresenceResolvable
   */

  /**
   * Resolves a {@link PresenceResolvable} to a {@link Presence} object.
   * @param {PresenceResolvable} presence The presence resolvable to resolve
   * @returns {?Presence}
   */
  resolve(presence) {
    const presenceResolvable = super.resolve(presence);
    if (presenceResolvable) return presenceResolvable;
    const userId = this.client.users.resolveId(presence);
    return this.cache.get(userId) ?? null;
  }

  /**
   * Resolves a {@link PresenceResolvable} to a {@link Presence} id.
   * @param {PresenceResolvable} presence The presence resolvable to resolve
   * @returns {?Snowflake}
   */
  resolveId(presence) {
    const presenceResolvable = super.resolveId(presence);
    if (presenceResolvable) return presenceResolvable;
    const userId = this.client.users.resolveId(presence);
    return this.cache.has(userId) ? userId : null;
  }

  /**
   * Fetches the overall user presence for all of the user's non-offline friends and implicit relationships.
   * @returns {Promise<Collection<Snowflake, Presence>>}
   */
  async fetch() {
    const data = await this.client.api.presences.get();
    // https://docs.discord.food/resources/presence#endpoints
    data.presences.forEach(presence => {
      this._add(presence, true);
    });
    return this.cache;
  }
}

module.exports = PresenceManager;
