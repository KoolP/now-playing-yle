'use strict';

import {MDCToolbar} from '@material/toolbar';
import ChannelGuide from './views/ChannelGuide';
import config from '../../config.json';
import serverConfig from '../../config.server.json';
import CryptoJS from 'crypto-js';
import fetchp from 'fetch-jsonp';
import Player from './views/Player';
import Toolbar from './views/Toolbar';
import PersonalGuide from './views/PersonalGuide';

/**
 * Fetch the current TV shows using JSONP and fetch JSONP polyfill.
 *
 * @param {Array<String>} [services=[]] - a string array of YLE service IDs o use as filter
 * @return {Array<Object>} YLE program metadata in unparsed form
 */
async function fetchCurrentPrograms(services = []) {
  const url = new URL(`${baseUrl}/programs/schedules/now.json`);
  const params = url.searchParams;
  params.set('app_id', config.appId);
  params.set('app_key', config.appKey);
  params.set('service', services.join(','));
  params.set('start', '-1');
  params.set('end', '10');

  // Fix the jsonp callback function name for service worker compatibility
  const options = {jsonpCallbackFunction: 'jsonp_options'};

  const response = await fetchp(url.href, options);
  // TODO Validate response
  const json = await response.json();
  return json.data;
}

/**
 * Fetch the current TV shows using JSONP and fetch JSONP polyfill.
 *
 * @param {Array<String>} [services=[]] - a string array of YLE service IDs o use as filter
 * @return {Array<Object>} YLE program metadata in unparsed form
 */
async function fetchPersonalPrograms(services = []) {
  const url = new URL(`${baseUrl}/programs/items.json`);
  const params = url.searchParams;
  params.set('app_id', config.appId);
  params.set('app_key', config.appKey);
  params.set('service', services.join(','));
  params.set('q', 'Eränkävijät');
  params.set('order', 'publication.starttime:desc');
 // params.set('start', '-1');
 // params.set('end', '10');

  // Fix the jsonp callback function name for service worker compatibility
  const options = {jsonpCallbackFunction: 'jsonp_options'};

  const response = await fetchp(url.href, options);
  // TODO Validate response
  const json = await response.json();
  return json.data.map(createProgram)
    .filter((p) => p !== null)
    .sort((p1,p2) => {
      return new Date (p1.startTime) < new Date (p2.startTime);
    });
}


/**
 * Fetch the YLE services using JSONP and fetch JSONP polyfill.
 *
 * @param {String} [type='TVChannel'] - the type of services to fetch
 * @return {Array<Object>} YLE service metadata in unparsed form
 */
async function fetchServices(type = 'TVChannel') {
  const url = new URL(`${baseUrl}/programs/services.json`);
  const params = url.searchParams;
  params.set('app_id', config.appId);
  params.set('app_key', config.appKey);
  params.set('type', type);

  // Fix the jsonp callback function name for service worker compatibility
  const options = {jsonpCallbackFunction: 'jsonp_services'};

  let response;
  try {
    response = await fetchp(url.href, options);
    const json = await response.json();
    return json.data;
  } catch (error) {
    console.warn('hoi', error);
  }
}

/**
 * Fetch the stream URL and metadata using JSONP and fetch JSONP polyfill.
 *
 * @param {String} programId - the id of the program
 * @param {String} mediaId - the id of the media
 * @return {Object} The streaming metadata, including URL etc.
 */
async function fetchStream(programId, mediaId) {
  const url = new URL(`${baseUrl}/media/playouts.json`);
  const params = url.searchParams;
  params.set('app_id', config.appId);
  params.set('app_key', config.appKey);
  params.set('program_id', programId);
  params.set('media_id', mediaId);
  params.set('protocol', 'HLS');

  // Fix the jsonp callback function name for service worker compatibility
  const options = {jsonpCallbackFunction: 'jsonp_stream'};

  const response = await fetchp(url.href, options);
  // TODO Validate response
  const json = await response.json();
  return json.data[0];
}

/**
 * Fetches the YLE programs and services and maps them into easier to digest array.
 * The values get populated into 'services' and 'programs' globals.
 */
async function fetch() {
  // Fetch the current program of all the services
  const services = await fetchServices();
  const newPrograms = await fetchCurrentPrograms(services.map((s) => s.id));

  channels = services.map((service) => {
      return {
        id: service.id,
        title: service.title.fi || service.title.sv,
      };
    })
    // Only use channels that have a current program available
    .filter((c) => newPrograms.find((p) => c.id === p.service.id));

  programs = newPrograms.map((p) => p.content).map(createProgram).filter((p) => p !== null);
}

function createProgram(program) {
  const publicationEvents = program.publicationEvent
    .sort((p1,p2) => {
      return new Date (p1.startTime) < new Date (p2.startTime);
    })
    .filter((e) => {
      return channels.find((c) => c.id === e.service.id) != null;
    });
  console.log('events', publicationEvents, program.publicationEvent);

  if (publicationEvents.length == 0) return null;

  const publicationEvent = publicationEvents[0];

//  const publicationEvent = program.publicationEvent && program.publicationEvent[0];
  const service = publicationEvent.service;
  const linkedChannel = channels.find((c) => c.id === service.id);

  if (linkedChannel == null) return null;

  const imageId = (program.image && program.image.id) ?
    program.image.id :
    program.partOfSeries && program.partOfSeries.coverImage ?
      program.partOfSeries.coverImage.id : '';

  const mediaId = publicationEvent.id;

  return {
    id: publicationEvent.id,
    contentId: program.id,
    channelId: linkedChannel.id,
    imageId: imageId,
    title: program.title.fi || program.title.sv,
    channel: linkedChannel.title,
    description: program.description.fi || program.description.sv,
    startTime: new Date(publicationEvent.startTime),
    endTime: new Date(publicationEvent.endTime),
    playbackUrl: mediaId ? `#play/${program.id}/${mediaId}` : null,
  };
}

/**
 * Decryption function adopted from YLE API http://developer.yle.fi/static/decrypt-url.js
 *
 * @param {String} url - The encoded URL to decrypt
 * @param {String} secret - The decoding secret
 * @return {String} The decrypted URL
 */
function decrypt(url, secret) {
  const data = CryptoJS.enc.Base64.parse(url).toString(CryptoJS.enc.Hex);
  const key = CryptoJS.enc.Utf8.parse(secret);
  const iv = CryptoJS.enc.Hex.parse(data.substr(0, 32));
  const message = CryptoJS.enc.Hex.parse(data.substr(32));

  const options = {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  };

  const params = CryptoJS.lib.CipherParams.create({ciphertext: message});
  const decryptedMessage = CryptoJS.AES.decrypt(params, key, options);
  return decryptedMessage.toString(CryptoJS.enc.Utf8);
}

/**
 * 
 * Rekisteröidään push worker 
 * 
 */
async function registerPush(serviceWorker) {
  const subscription = await serviceWorker.pushManager.getSubscription()
  const isSubscribed = !(subscription === null);

  if (isSubscribed) {
    // send keys to server always as they will expire after a while
    await userSubscribed(subscription);
  } else {
    // user is not subscribed, display permission dialog
    const newSubscription = await askForNotificationPermission(serviceWorker);
    // if user gave permissions, send keys to server
    if (newSubscription !== null) {
      userSubscribed(newSubscription);
    }
  }
}

/**
   * A helper to transform Base64 encoded string into a Uint8Array.
   *
   * Source: https://github.com/GoogleChromeLabs/web-push-codelab/blob/master/app/scripts/main.js
   *
   * @param {String} base64String - The Base64 encoded string
   * @return {Uint8Array} The converted array in unsigned 8-bit integer
   */
  function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }


/**
 * 
 * Kysytään lupa Push viesteihin
 */
async function askForNotificationPermission(serviceWorker) {
  console.log(serverConfig);
  const applicationServerKey = urlB64ToUint8Array(serverConfig.vapidDetails.publicKey);
  return await serviceWorker.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey
  })
}

/**
 * Initialises this application asynchronously.
 */
async function init() {
  console.log('Initialise the application');

  // Register the service worker
  // [::1] is the IPv6 localhost address; 127.0.0.1/8 is localhos
  const isLocalhost = Boolean(window.location.hostname === 'localhost' ||
        window.location.hostname === '[::1]' || window.location.hostname.match(
        /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
      )
    );

  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || isLocalhost)) {
    // Wait for Service Worker to register, then assign the handle
    try {
      console.log("Registering service worker");
      const swRegistration = await navigator.serviceWorker.register('service-worker.js');
      guide.registerWorker(swRegistration);
      await registerPush(swRegistration);
      console.log("Registered SW Push");
    } catch (error) {
      console.error('Service Worker Error', error);
    }
  }

// install the listener
// document.addEventListener('DOMContentLoaded', installServiceWorker)


  // Fetch the data
  await fetch();

  // Default to the first channel
  location.hash = `#channels/${channels[0].id}`;

  // Manually trigger route change.
  handleRouteChange();
}

/**
 * Handles the URL (hash part) route change and update the application accordingly.
 *
 * @return {undefined} - No actual return value
 */
async function handleRouteChange() {
  // Fetch the current route
  const hashPart = location.hash.replace(/^#/, '');
  console.log(`Handle route change '${hashPart}'`);

  // Perform the routing
  const segments = hashPart.split('/');
  switch (segments[0]) {
    case 'channels':
      // Infer the current channel from the URL hash part
      const channelId = segments[1];
      // Just use the programs that are specific for this channel
      const filtered = programs.filter((p) => p.channelId === channelId );
      const currentProgram = filtered.find((p) => p.channelId === channelId) || filtered[0];

      toolbar.program = currentProgram;
      toolbar.channels = channels;
      toolbar.render();
      guide.programs = filtered;
      guide.render();
      return;
    case 'play':
      const contentId = segments[1];
      const mediaId = segments[2];
      const program = programs.find((p) => p.contentId === contentId);
      const stream = await fetchStream(contentId, mediaId);
      const url = decrypt(stream.url, config.secret);

      player.url = url;
      player.program = program;
      player.render();
      return;
    case 'personal':
    console.log('Personal enter case');
      const personalGuide = await fetchPersonalPrograms();
      console.log('Personal 2');
      // toolbar.program = currentProgram;
      // toolbar.channels = channels;
      // toolbar.render();
      personal.programs = personalGuide;
      personal.render();
    return;

    default:
      console.log(`No route handler found for ${hashPart}`);
      return init();
  }
}

// Attach dynamic behaviour to the MDC toolbar element
const mdcToolbar = MDCToolbar.attachTo(document.querySelector('.mdc-toolbar'));
mdcToolbar.fixedAdjustElement = document.querySelector('.mdc-toolbar-fixed-adjust');

// UI elements we bind to
const header = document.querySelector('header');
const main = document.querySelector('main');

// API configuration
const baseUrl = 'https://external.api.yle.fi/v1';

// Application state data
let channels = [];
let programs = [];

// UI Elements
const toolbar = new Toolbar(header);
const guide = new ChannelGuide(main);
const player = new Player(main);
const personal = new PersonalGuide(main);

// Update for UI state changes
window.addEventListener('hashchange', handleRouteChange);

// Bootstrap the app
init();

