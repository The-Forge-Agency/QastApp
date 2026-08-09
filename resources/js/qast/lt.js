// Luby transform fountain codes: any k' >= k received packets (systematic or
// XOR-combined) rebuild the payload, whatever the frame order or losses.

export function mulberry32(seed) {
    let a = seed >>> 0;

    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Robust soliton distribution, returned as a cumulative table of length k.
export function robustSolitonCdf(k, c = 0.05, delta = 0.05) {
    if (k <= 1) return [1];

    const rho = new Array(k + 1).fill(0);
    rho[1] = 1 / k;
    for (let i = 2; i <= k; i++) rho[i] = 1 / (i * (i - 1));

    const r = c * Math.log(k / delta) * Math.sqrt(k);
    const tau = new Array(k + 1).fill(0);
    const pivot = Math.max(1, Math.floor(k / Math.max(r, 1)));

    if (r > 1) {
        for (let i = 1; i < pivot; i++) tau[i] = r / (i * k);
        tau[pivot] = (r * Math.log(r / delta)) / k;
    }

    let total = 0;
    for (let i = 1; i <= k; i++) total += rho[i] + tau[i];

    const cdf = new Array(k);
    let acc = 0;
    for (let i = 1; i <= k; i++) {
        acc += (rho[i] + tau[i]) / total;
        cdf[i - 1] = acc;
    }
    cdf[k - 1] = 1;

    return cdf;
}

// Deterministic packet composition: same seed on both sides selects the
// same degree and the same set of source blocks.
export function packetIndices(seed, k, cdf) {
    const rng = mulberry32(seed);
    const roll = rng();

    let degree = 1;
    while (degree < k && cdf[degree - 1] < roll) degree++;

    const picked = new Set();
    while (picked.size < degree) {
        picked.add(Math.floor(rng() * k));
    }

    return [...picked];
}

function xorInto(target, source) {
    for (let i = 0; i < target.length; i++) target[i] ^= source[i];
}

export class LTEncoder {
    constructor(payload, blockSize) {
        this.blockSize = blockSize;
        this.totalLen = payload.length;
        this.k = Math.max(1, Math.ceil(payload.length / blockSize));
        this.cdf = robustSolitonCdf(this.k);

        this.blocks = new Array(this.k);
        for (let i = 0; i < this.k; i++) {
            const block = new Uint8Array(blockSize);
            block.set(payload.subarray(i * blockSize, (i + 1) * blockSize));
            this.blocks[i] = block;
        }
    }

    systematic(index) {
        return this.blocks[index].slice();
    }

    encode(seed) {
        const indices = packetIndices(seed, this.k, this.cdf);
        const out = this.blocks[indices[0]].slice();
        for (let i = 1; i < indices.length; i++) {
            xorInto(out, this.blocks[indices[i]]);
        }

        return out;
    }
}

export class LTDecoder {
    constructor({ k, blockSize, totalLen }) {
        this.k = k;
        this.blockSize = blockSize;
        this.totalLen = totalLen;
        this.cdf = robustSolitonCdf(k);
        this.decoded = new Array(k).fill(null);
        this.decodedCount = 0;
        this.pending = [];
        this.seenSeeds = new Set();
        this.packetsReceived = 0;
    }

    get progress() {
        return this.decodedCount / this.k;
    }

    get isComplete() {
        return this.decodedCount === this.k;
    }

    // Returns true when the packet carried new information.
    addPacket(ptype, seed, data) {
        const key = ptype + ':' + seed;
        if (this.isComplete || this.seenSeeds.has(key)) return false;
        this.seenSeeds.add(key);
        this.packetsReceived++;

        const indices = ptype === 0 ? [seed] : packetIndices(seed, this.k, this.cdf);
        const remaining = new Set();
        const payload = data.slice();

        for (const idx of indices) {
            if (this.decoded[idx]) {
                xorInto(payload, this.decoded[idx]);
            } else {
                remaining.add(idx);
            }
        }

        if (remaining.size === 0) return false;

        if (remaining.size === 1) {
            this.#solve([...remaining][0], payload);
        } else {
            this.pending.push({ indices: remaining, data: payload });
        }

        return true;
    }

    // Peeling propagation: each newly solved block may reduce pending
    // packets down to degree one, solving further blocks in cascade.
    #solve(index, data) {
        const queue = [[index, data]];

        while (queue.length > 0) {
            const [idx, block] = queue.pop();
            if (this.decoded[idx]) continue;

            this.decoded[idx] = block;
            this.decodedCount++;

            for (const packet of this.pending) {
                if (!packet.indices.has(idx)) continue;
                xorInto(packet.data, block);
                packet.indices.delete(idx);
                if (packet.indices.size === 1) {
                    queue.push([[...packet.indices][0], packet.data]);
                    packet.indices.clear();
                }
            }

            this.pending = this.pending.filter((packet) => packet.indices.size > 0);
        }
    }

    payload() {
        if (!this.isComplete) return null;

        const out = new Uint8Array(this.k * this.blockSize);
        for (let i = 0; i < this.k; i++) out.set(this.decoded[i], i * this.blockSize);

        return out.subarray(0, this.totalLen);
    }
}
