const { assert } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noPreserveCache();

let eventproxy;
let handler;
let mainNodeHandler;
let clock;

const HANDLER_ATTACH_DELAY = 101;

describe('eventproxy', () => {
  beforeEach(() => {
    global.window = true;

    const mainNode = {};
    mainNode.addEventListener = sinon.spy(
      (event, callback) => { mainNodeHandler = callback; },
    );
    mainNode.removeEventListener = sinon.spy();

    global.document = {};
    global.document.addEventListener = sinon.spy((event, callback) => { handler = callback; });
    global.document.removeEventListener = sinon.spy();
    global.document.querySelector = () => mainNode;

    global.addEventListener = sinon.spy((event, callback) => { handler = callback; });
    global.removeEventListener = sinon.spy();

    eventproxy = proxyquire('../lib/index', {});

    clock = sinon.useFakeTimers();
  });

  after(() => {
    delete global.window;
    delete global.document;
    delete global.addEventListener;
    delete global.removeEventListener;
  });

  afterEach(() => {
    clock.restore();
  });

  it('server safe', () => {
    delete global.window;
    global.document.addEventListener = sinon.spy();
    const servereventproxy = require('../lib/index');
    const spy = sinon.spy();

    const unsubscribe = servereventproxy('diceroll', spy);

    assert.isTrue(global.document.addEventListener.notCalled, 'didn\'t initialize on server by default');
    assert.isTrue(spy.notCalled, 'didn\'t call callback');
    assert.isFunction(unsubscribe, 'returns a function');

    unsubscribe();
  });

  it('creates listener', () => {
    const spy = sinon.spy();
    const unsubscribe = eventproxy('diceroll', spy);
    clock.tick(HANDLER_ATTACH_DELAY);
    assert.isTrue(global.document.addEventListener.calledOnce, 'initialized on client');
    assert.isTrue(spy.notCalled, 'didn\'t call callback');
    unsubscribe();
  });

  it('does not fire handler during threshold', () => {
    const spy = sinon.spy();
    const unsubscribe = eventproxy('test', spy);
    handler({ type: 'test' });
    clock.tick(HANDLER_ATTACH_DELAY);
    handler({ type: 'test' });

    assert.isTrue(spy.calledOnce);
    unsubscribe();
  });

  it('handles events correctly', () => {
    const spy = sinon.spy();
    const spy2 = sinon.spy();

    const unsubscribe = eventproxy('test', spy);
    const unsubscribe2 = eventproxy('test2', spy2);
    clock.tick(HANDLER_ATTACH_DELAY);

    handler({ type: 'test' });
    handler({ type: 'test' });
    unsubscribe();

    handler({ type: 'test' });
    handler({ type: 'test2' });
    unsubscribe2();

    assert.isTrue(spy.calledTwice, 'called twice for correct event');
    assert.isTrue(spy2.calledOnce, 'called once for correct event 2');
  });

  it('throttles scroll events', () => {
    const spy = sinon.spy();

    const unsubscribe = eventproxy('scroll', spy);
    clock.tick(HANDLER_ATTACH_DELAY);
    handler({ type: 'scroll' });
    handler({ type: 'scroll' });
    handler({ type: 'scroll' });
    handler({ type: 'scroll' });
    handler({ type: 'scroll' });
    unsubscribe();

    assert.isTrue(spy.calledOnce, 'called once for correct event');
  });

  it('attaches click events to #main', () => {
    const spy = sinon.spy();
    eventproxy('click', spy);
    clock.tick(HANDLER_ATTACH_DELAY);

    mainNodeHandler({ type: 'click' });

    assert.isTrue(spy.calledOnce, 'handler called for event on correct element');
  });

  it('multiple unsubscribes', () => {
    const spy = sinon.spy();

    const unsubscribe = eventproxy('test', spy);
    clock.tick(HANDLER_ATTACH_DELAY);

    handler({ type: 'test' });
    unsubscribe();
    unsubscribe();
    unsubscribe();
    handler({ type: 'test' });

    assert.isTrue(spy.calledOnce, 'called once for correct event');
  });

  it('listener unsubscribes another listener', () => {
    let unsubscribe;
    const spy = sinon.spy(() => unsubscribe && unsubscribe());

    unsubscribe = eventproxy('test', spy);
    unsubscribe = eventproxy('test', spy);
    clock.tick(HANDLER_ATTACH_DELAY);

    handler({ type: 'test' });

    assert.isTrue(spy.calledOnce, 'call count correct');
  });
});
