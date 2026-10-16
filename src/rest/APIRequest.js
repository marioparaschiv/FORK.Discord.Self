'use strict';

const Buffer = require('node:buffer').Buffer;
const { setTimeout } = require('node:timers');
const { FormData, buildConnector, Client, ProxyAgent } = require('undici');
const { ciphers } = require('../util/Constants');
const Util = require('../util/Util');

let agent = null;

function lowercaseHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
}

class APIRequest {
  constructor(rest, method, path, options) {
    this.rest = rest;
    this.client = rest.client;
    this.method = method;
    this.route = options.route;
    this.options = options;
    this.retries = 0;

    this.fullUserAgent = this.client.options.http.headers['User-Agent'];

    let queryString = '';
    if (options.query) {
      const query = Object.entries(options.query)
        .filter(([, value]) => value !== null && typeof value !== 'undefined')
        .flatMap(([key, value]) => (Array.isArray(value) ? value.map(v => [key, v]) : [[key, value]]));
      queryString = new URLSearchParams(query).toString();
    }
    this.path = `${path}${queryString && `?${queryString}`}`;
  }

  make(captchaKey, captchaRqToken) {
    const customFetch = this.client.options.http.fetch;

    if (!customFetch && !agent) {
      const r_ = Util.checkUndiciProxyAgent(this.client.options.http.agent);
      if (!r_) {
        agent = new Client('https://discord.com', {
          connect: buildConnector({ ciphers: ciphers.join(':') }),
        });
      } else {
        agent = new ProxyAgent({
          ...r_,
          ciphers: ciphers.join(':'),
        });
      }
    }

    const API =
      this.options.versioned === false
        ? this.client.options.http.api
        : `${this.client.options.http.api}/v${this.client.options.http.version}`;
    const url = API + this.path;

    // Header names are lowercased so a per-request header replaces a base one instead of being joined with it.
    let headers = lowercaseHeaders(this.client.options.http.headers);

    if (this.options.auth !== false) headers.authorization = this.rest.getAuth();
    if (this.options.reason) headers['x-audit-log-reason'] = encodeURIComponent(this.options.reason);
    if (this.options.headers) headers = Object.assign(headers, lowercaseHeaders(this.options.headers));

    // Delete all headers if undefined
    for (const [key, value] of Object.entries(headers)) {
      if (value === undefined) delete headers[key];
    }
    if (this.options.webhook === true) {
      headers = {
        'user-agent': this.fullUserAgent,
      };
    }

    // Some options
    if (this.options.DiscordContext) {
      headers['x-context-properties'] = Buffer.from(JSON.stringify(this.options.DiscordContext), 'utf8').toString(
        'base64',
      );
    }

    if (this.options.mfaToken) {
      headers['x-discord-mfa-authorization'] = this.options.mfaToken;
    }

    // Captcha
    if (captchaKey && typeof captchaKey == 'string') headers['x-captcha-key'] = captchaKey;
    if (captchaRqToken && typeof captchaRqToken == 'string') headers['x-captcha-rqtoken'] = captchaRqToken;

    let body;
    if (this.options.files?.length) {
      body = new FormData();
      for (const [index, file] of this.options.files.entries()) {
        // Why undici#FormData doesn't support file stream?
        // Hacky way to support file stream
        if (file?.file) {
          body.set(file.key ?? `files[${index}]`, {
            [Symbol.toStringTag]: 'File',
            name: file.name,
            stream: () => file.file,
          });
        }
      }
      if (typeof this.options.data !== 'undefined') {
        if (this.options.dontUsePayloadJSON) {
          for (const [key, value] of Object.entries(this.options.data)) body.append(key, value);
        } else {
          body.append('payload_json', JSON.stringify(this.options.data));
        }
      }
      // eslint-disable-next-line eqeqeq
    } else if (this.options.data != null) {
      if (this.options.usePayloadJSON) {
        body = new FormData();
        body.append('payload_json', JSON.stringify(this.options.data));
      } else {
        body = JSON.stringify(this.options.data);
        headers['content-type'] = 'application/json';
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.client.options.restRequestTimeout).unref();
    const init = {
      method: this.method.toUpperCase(), // Undici doesn't normalize "patch" into "PATCH" (which surprisingly follows the spec).
      headers,
      body,
      signal: controller.signal,
    };
    return this.rest
      .fetch(url, customFetch ? init : { ...init, redirect: 'follow', dispatcher: agent, credentials: 'include' })
      .finally(() => clearTimeout(timeout));
  }
}

module.exports = APIRequest;
