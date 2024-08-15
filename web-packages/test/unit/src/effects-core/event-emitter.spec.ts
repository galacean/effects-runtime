import { EventEmitter } from '@galacean/effects';

const { expect } = chai;

describe('event emitter api', () => {
  it('event on', async () => {
    const event = new EventEmitter();
    const spy = chai.spy();
    const func = () => {
      spy();
    };

    event?.on('test', func);
    const listeners = event?.getListeners('test');

    expect(listeners).to.be.an.instanceOf(Array);
    expect(listeners?.length).to.be.equal(1);

    expect(listeners?.[0]).to.be.equal(func);
    expect(spy).to.not.have.been.called();
    event?.off('test', func);
  });

  it('event once', async () => {
    const event = new EventEmitter();
    const spy = chai.spy();
    const func = () => {
      spy();
    };

    event?.once('test', func);
    const listeners = event?.getListeners('test');

    expect(listeners).to.be.an.instanceOf(Array);
    expect(listeners?.length).to.be.equal(1);

    expect(listeners?.[0]).to.be.equal(func);
    event?.emit('test', 'test', 1);
    event?.emit('test', 'test', 1);
    expect(spy).to.have.been.called();
    expect(spy).to.have.been.called.exactly(1);
    const listeners2 = event?.getListeners('test');

    expect(listeners2).to.be.an.instanceOf(Array);
    expect(listeners2?.length).to.be.equal(0);

  });

  it('event emit', async () => {
    const event = new EventEmitter();
    const spy = chai.spy();
    const func = () => {
      spy();
    };

    event?.on('test', func);
    const listeners = event?.getListeners('test');

    expect(listeners).to.be.an.instanceOf(Array);
    expect(listeners?.length).to.be.equal(1);

    expect(listeners?.[0]).to.be.equal(func);
    expect(spy).to.not.have.been.called();

    event?.emit('test', 'test', 1);
    event?.emit('test', 'test', 1);
    expect(spy).to.have.been.called();
    expect(spy).to.have.been.called.exactly(2);
    const listeners2 = event?.getListeners('test');

    expect(listeners2).to.be.an.instanceOf(Array);
    expect(listeners2?.length).to.be.equal(1);
  });

  it('event off', async () => {
    const event = new EventEmitter();
    const spy = chai.spy();
    const func = () => {
      spy();
    };

    event?.on('test', func);
    const listeners = event?.getListeners('test');

    expect(listeners).to.be.an.instanceOf(Array);
    expect(listeners?.length).to.be.equal(1);

    expect(listeners?.[0]).to.be.equal(func);
    expect(spy).to.not.have.been.called();

    event?.emit('test', 'test', 1);
    expect(spy).to.have.been.called();
    expect(spy).to.have.been.called.exactly(1);
    const listeners2 = event?.getListeners('test');

    expect(listeners2).to.be.an.instanceOf(Array);
    expect(listeners2?.length).to.be.equal(1);

    event?.off('test', func);

    const listeners3 = event?.getListeners('test');

    expect(listeners3).to.be.an.instanceOf(Array);
    expect(listeners3?.length).to.be.equal(0);
  });
});
