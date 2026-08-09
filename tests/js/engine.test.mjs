import test from 'node:test';
import assert from 'node:assert/strict';
import { LTEncoder, LTDecoder, packetIndices, robustSolitonCdf } from '../../resources/js/qast/lt.js';
import {
    encodePacket,
    decodePacket,
    buildPayload,
    parsePayload,
    PTYPE_LT,
    PTYPE_SYSTEMATIC,
} from '../../resources/js/qast/packet.js';

function randomBytes(length, seed = 42) {
    const out = new Uint8Array(length);
    let state = seed;
    for (let i = 0; i < length; i++) {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        out[i] = state & 0xff;
    }
    return out;
}

test('systematic packets alone rebuild the payload, in any order', () => {
    const payload = randomBytes(5000);
    const encoder = new LTEncoder(payload, 220);
    const decoder = new LTDecoder({ k: encoder.k, blockSize: 220, totalLen: payload.length });

    const order = [...Array(encoder.k).keys()].sort(() => Math.random() - 0.5);
    for (const index of order) {
        decoder.addPacket(PTYPE_SYSTEMATIC, index, encoder.systematic(index));
    }

    assert.ok(decoder.isComplete);
    assert.deepEqual([...decoder.payload()], [...payload]);
});

test('LT packets recover heavy losses without any systematic packet', () => {
    const payload = randomBytes(8000, 7);
    const encoder = new LTEncoder(payload, 96);
    const decoder = new LTDecoder({ k: encoder.k, blockSize: 96, totalLen: payload.length });

    let seed = 1000;
    let guard = 0;
    while (!decoder.isComplete && guard < encoder.k * 30) {
        guard++;
        seed++;
        if (seed % 3 === 0) continue; // a third of the frames are "missed"
        decoder.addPacket(PTYPE_LT, seed, encoder.encode(seed));
    }

    assert.ok(decoder.isComplete, `stuck at ${decoder.decodedCount}/${decoder.k}`);
    assert.deepEqual([...decoder.payload()], [...payload]);
});

test('mixed systematic + LT flow with drops, duplicates and disorder', () => {
    const payload = randomBytes(3100, 99);
    const blockSize = 128;
    const encoder = new LTEncoder(payload, blockSize);
    const decoder = new LTDecoder({ k: encoder.k, blockSize, totalLen: payload.length });

    const frames = [];
    for (let i = 0; i < encoder.k; i++) {
        if (i % 4 !== 1) frames.push([PTYPE_SYSTEMATIC, i, encoder.systematic(i)]);
    }
    for (let seed = 500; seed < 500 + encoder.k * 4; seed++) {
        frames.push([PTYPE_LT, seed, encoder.encode(seed)]);
    }
    frames.push(...frames.slice(0, 5)); // duplicates
    frames.sort(() => Math.random() - 0.5);

    for (const [ptype, seed, data] of frames) {
        decoder.addPacket(ptype, seed, data);
        if (decoder.isComplete) break;
    }

    assert.ok(decoder.isComplete);
    assert.deepEqual([...decoder.payload()], [...payload]);
});

test('packet header survives the QR wire format', () => {
    const data = randomBytes(220, 3);
    const encoded = encodePacket({
        ptype: PTYPE_LT,
        transferId: 0xdeadbeef,
        k: 137,
        totalLen: 30000,
        seed: 424242,
        blockSize: 220,
        data,
    });

    assert.equal(typeof encoded, 'string');

    const packet = decodePacket(encoded);
    assert.ok(packet);
    assert.equal(packet.ptype, PTYPE_LT);
    assert.equal(packet.transferId, 0xdeadbeef);
    assert.equal(packet.k, 137);
    assert.equal(packet.totalLen, 30000);
    assert.equal(packet.seed, 424242);
    assert.equal(packet.blockSize, 220);
    assert.deepEqual([...packet.data], [...data]);
});

test('decodePacket rejects anything that is not a Qast frame', () => {
    assert.equal(decodePacket('https://exemple.com/un-lien'), null);
    assert.equal(decodePacket('bonjour tout le monde'), null);
    assert.equal(decodePacket(''), null);
    assert.equal(decodePacket('QQQQ=====!!!'), null);
});

test('payload meta roundtrip keeps type, name and content', () => {
    const content = new TextEncoder().encode('# Ma note\n\nAvec du **markdown**.');
    const payload = buildPayload({ t: 'md', n: 'note.md', m: 'text/markdown' }, content);
    const parsed = parsePayload(payload);

    assert.ok(parsed);
    assert.deepEqual(parsed.meta, { t: 'md', n: 'note.md', m: 'text/markdown' });
    assert.equal(new TextDecoder().decode(parsed.content), '# Ma note\n\nAvec du **markdown**.');
});

test('same seed derives the same block set on both sides', () => {
    const k = 200;
    const cdf = robustSolitonCdf(k);
    for (let seed = 1; seed < 50; seed++) {
        const a = packetIndices(seed, k, cdf);
        const b = packetIndices(seed, k, cdf);
        assert.deepEqual(a, b);
        assert.ok(a.length >= 1 && a.length <= k);
        assert.equal(new Set(a).size, a.length);
    }
});

test('single-byte payload still works (k = 1)', () => {
    const payload = new TextEncoder().encode('x');
    const encoder = new LTEncoder(payload, 220);
    assert.equal(encoder.k, 1);

    const decoder = new LTDecoder({ k: 1, blockSize: 220, totalLen: 1 });
    decoder.addPacket(PTYPE_LT, 777, encoder.encode(777));

    assert.ok(decoder.isComplete);
    assert.deepEqual([...decoder.payload()], [...payload]);
});
