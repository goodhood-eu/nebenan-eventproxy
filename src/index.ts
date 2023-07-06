import debounce from 'lodash/debounce';
import throttle from 'lodash/throttle';

type EventType = keyof GlobalEventHandlersEventMap;

type EventData = {
  listeners: Record<string, HandlerFunction>;
  lastIndex: number;
  listenersLength: number;
};

type CallbackFunction = (event:Event) => void;

type EventSettings = {
  emitter?: Document | typeof globalThis;
  wrapper?: (callback: CallbackFunction) => Function;
};

type HandlerFunction = CallbackFunction & { _attachedAt: number, cancel?:Function };

const RESIZE_RATE = 300;
const SCROLL_RATE = 100;
const HANDLER_CALL_DELAY = 100;

const isDOMAvailable = typeof window !== 'undefined';

const settingsMap: Record<string, EventSettings> = {};
const eventMap: Record<string, EventData> = {};
const noop = () => {};
const defaultSettings: EventSettings = {};

const createEventSettings = () => {
  settingsMap.resize = {
    emitter: globalThis,
    wrapper(callback) { return debounce(callback, RESIZE_RATE); },
  };

  settingsMap.scroll = {
    emitter: globalThis,
    wrapper(callback) { return throttle(callback, SCROLL_RATE); },
  };

  // React 17 changed where it attaches its event listeners.
  // React 16 attached all event listeners to document. React 17 attaches all event
  // listeners to the React root node.
  // Given an event handler of type 'click' attaches a global click handler onto
  // document, the click event would bubble up to the newly attached document click
  // handler (which is, in most cases, an unexpected behaviour). We can prevent this
  // from attaching specific events to the React root node instead.
  settingsMap.click = {
    // TODO make selector configurable, see
    // https://github.com/good-hood-gmbh/nebenan-frontend/pull/1899#discussion_r1150820056
    // @ts-ignore
    emitter: globalThis.document.querySelector('#main') || globalThis.document,
  };

  defaultSettings.emitter = globalThis.document;
};

// ========================================================================================
// Utility functions
// ========================================================================================
const getEventData = (event:string): EventData => {
  if (!eventMap[event]) eventMap[event] = { listeners: {}, lastIndex: 0, listenersLength: 0 };
  return eventMap[event];
};

const getEventSettings = (event:string): EventSettings => settingsMap[event] || defaultSettings;

// # This is a very dirty fix to a bad problem.
// When attaching listeners of a given event type DURING the execution of an event handler
// of this type, it needs to be prevented that the newly attached listener gets called immediately.
// It is not a trivial task to get some code to execute after all event handlers for a
// DOM element have been called. Some browser engines schedule tasks differently. Checking
// for time is the simplest fix to the problem.
//
// How to prevent: Do not attach event listeners in event handlers.
// https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/
const isReadyForExecution = (handler: Function & { _attachedAt: number }): boolean => (
  handler && Date.now() - handler._attachedAt > HANDLER_CALL_DELAY
);

const handleEmitterEvent = (event: Event) => {
  const eventData = getEventData(event.type);
  // Item may have been deleted during iteration cycle
  Object.keys(eventData.listeners).forEach((id) => {
    const handler = eventData.listeners[id];
    if (isReadyForExecution(handler)) handler(event);
  });
};

// see https://github.com/microsoft/TypeScript/issues/32912#issuecomment-522142969
const DEFAULT_EVENT_OPTIONS: AddEventListenerOptions & EventListenerOptions = { passive: true };

const attachEmitterHandler = (
  event:EventType,
  eventData: EventData,
  eventSettings: EventSettings) => {
  if (eventData.listenersLength === 1) {
    eventSettings.emitter?.addEventListener(event, handleEmitterEvent, DEFAULT_EVENT_OPTIONS);
  }
};

const detachEmitterHandler = (
  event:EventType,
  eventData: EventData,
  eventSettings: EventSettings) => {
  if (eventData.listenersLength === 0) {
    eventSettings.emitter?.removeEventListener(event, handleEmitterEvent, DEFAULT_EVENT_OPTIONS);
  }
};

// ========================================================================================
// Public api
// ========================================================================================
const removeListener = (event:EventType, id: number) => {
  const eventData = getEventData(event);
  const eventSettings = getEventSettings(event);

  // protect from being called twice
  if (!eventData.listeners[id]) return;

  delete eventData.listeners[id];
  eventData.listenersLength -= 1;

  detachEmitterHandler(event, eventData, eventSettings);
};

const addListener = (event:EventType, callback: HandlerFunction) => {
  if (typeof callback !== 'function') throw new Error('Listener function required');
  if (!isDOMAvailable) return noop;

  const eventData = getEventData(event);
  const eventSettings = getEventSettings(event);

  eventData.lastIndex += 1;
  const id = eventData.lastIndex;
  const handler = eventSettings.wrapper
    ? eventSettings.wrapper(callback) as HandlerFunction : callback;
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
