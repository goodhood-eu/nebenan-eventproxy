import debounce from 'lodash/debounce';
import throttle from 'lodash/throttle';

const RESIZE_RATE = 300;
const SCROLL_RATE = 100;
const HANDLER_CALL_DELAY = 100;

// ========================================================================================
// Initialization
// ========================================================================================
const isDOMAvailable = typeof window !== 'undefined';

const settingsMap = {};
const eventMap = {};
const noop = () => {};
const defaultSettings = {};


const createEventSettings = () => {
  settingsMap.resize = {
    emitter: global,
    wrapper(callback) { return debounce(callback, RESIZE_RATE); },
  };

  settingsMap.scroll = {
    emitter: global,
    wrapper(callback) { return throttle(callback, SCROLL_RATE); },
  };

  // React 17 changed where it attaches it's event listeners.
  // React 16 attached all event listeners to document. React 17 attaches all event
  // listeners to the react root node.
  // Given an event handler of type 'click' attaches a global click handler onto
  // document, the click event would bubble up to the newly attached document click
  // handler (which is, in most cases, an unexpected bahvior). We can prevent this
  // from attaching specific events to the react root node instead.
  settingsMap.click = {
    emitter: global.document.querySelector('#main') || global.document,
  };

  defaultSettings.emitter = global.document;
};

// ========================================================================================
// Utility functions
// ========================================================================================
const getEventData = (event) => {
  if (!eventMap[event]) eventMap[event] = { listeners: {}, lastIndex: 0, listenersLength: 0 };
  return eventMap[event];
};

const getEventSettings = (event) => settingsMap[event] || defaultSettings;

// # This is a very dirty fix to a bad problem.
// When attaching listeners of a given event type DURING the execution of an event handler
// of this type, it needs to be prevented that the newly attached listener gets called immediately.
// It is not a trivial task to get some code to execute after all event handlers for a
// DOM element have been called. Some browser engines schedule tasks differently. Checking
// for time is the most simple fix to the problem.
//
// How to prevent: Do not attach event listeners in event handlers.
// https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/
const isReadyForExecution = (handler) => (
  handler && Date.now() - handler._attachedAt > HANDLER_CALL_DELAY
);

const handleEmitterEvent = (event) => {
  const eventData = getEventData(event.type);
  // Item may have been deleted during iteration cycle
  Object.keys(eventData.listeners).forEach((id) => {
    const handler = eventData.listeners[id];
    if (isReadyForExecution(handler)) handler(event);
  });
};

const attachEmitterHandler = (event, eventData, eventSettings) => {
  if (eventData.listenersLength === 1) {
    eventSettings.emitter.addEventListener(event, handleEmitterEvent, { passive: true });
  }
};

const detachEmitterHandler = (event, eventData, eventSettings) => {
  if (eventData.listenersLength === 0) {
    eventSettings.emitter.removeEventListener(event, handleEmitterEvent, { passive: true });
  }
};

// ========================================================================================
// Public api
// ========================================================================================
const removeListener = (event, id) => {
  const eventData = getEventData(event);
  const eventSettings = getEventSettings(event);
  // protect from being called twice
  if (!eventData.listeners[id]) return;

  delete eventData.listeners[id];
  eventData.listenersLength -= 1;

  detachEmitterHandler(event, eventData, eventSettings);
};

/**
 * @function
 * @param {string} event
 * @param {function} callback
 * @return {removeEventListener|noop}
 */
const addListener = (event, callback) => {
  if (typeof event !== 'string') throw new Error('Event name required');
  if (typeof callback !== 'function') throw new Error('Listener function required');
  if (!isDOMAvailable) return noop;

  const eventData = getEventData(event);
  const eventSettings = getEventSettings(event);

  eventData.lastIndex += 1;
  const id = eventData.lastIndex;
  const handler = eventSettings.wrapper ? eventSettings.wrapper(callback) : callback;
  handler._attachedAt = Date.now();

  eventData.listeners[id] = handler;
  eventData.listenersLength += 1;

  attachEmitterHandler(event, eventData, eventSettings);

  const removeEventListener = () => {
    if (typeof handler.cancel === 'function') {
      handler.cancel();
    }

    removeListener(event, id);
  };
  // Allow to empty the calls queue
  removeEventListener.cancel = handler.cancel;

  return removeEventListener;
};

if (isDOMAvailable) createEventSettings();

export default addListener;
