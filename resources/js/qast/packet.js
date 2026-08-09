// Wire format of one QR frame: binary header + block bytes, base64-encoded.
//
//  0  2  magic "QT"        10  4  totalLen (uint32)
//  2  1  format version    14  4  seed — systematic: block index, LT: PRNG seed
//  3  1  ptype 0|1         18  2  blockSize (uint16)
//  4  4  transferId        20  …  block data
//  8  2  k (uint16)

export const PACKET_VERSION = 1;
export const HEADER_SIZE = 20;
export const PTYPE_SYSTEMATIC = 0;
export const PTYPE_LT = 1;

export function toBase64(bytes) {
    if (typeof globalThis.Buffer !== 'undefined') {
        return globalThis.Buffer.from(bytes).toString('base64');
    }

    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }

    return btoa(binary);
}

export function fromBase64(text) {
    if (typeof globalThis.Buffer !== 'undefined') {
        return new Uint8Array(globalThis.Buffer.from(text, 'base64'));
    }

    const binary = atob(text);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);

    return out;
}

export function encodePacket({ ptype, transferId, k, totalLen, seed, blockSize, data }) {
    const bytes = new Uint8Array(HEADER_SIZE + data.length);
    const view = new DataView(bytes.buffer);

    bytes[0] = 0x51; // Q
    bytes[1] = 0x54; // T
    bytes[2] = PACKET_VERSION;
    bytes[3] = ptype;
    view.setUint32(4, transferId >>> 0);
    view.setUint16(8, k);
    view.setUint32(10, totalLen);
    view.setUint32(14, seed >>> 0);
    view.setUint16(18, blockSize);
    bytes.set(data, HEADER_SIZE);

    return toBase64(bytes);
}

export function decodePacket(text) {
    let bytes;
    try {
        bytes = fromBase64(text);
    } catch {
        return null;
    }

    if (bytes.length <= HEADER_SIZE) return null;
    if (bytes[0] !== 0x51 || bytes[1] !== 0x54 || bytes[2] !== PACKET_VERSION) return null;

    const view = new DataView(bytes.buffer, bytes.byteOffset);
    const blockSize = view.getUint16(18);
    if (bytes.length !== HEADER_SIZE + blockSize) return null;

    return {
        ptype: bytes[3],
        transferId: view.getUint32(4),
        k: view.getUint16(8),
        totalLen: view.getUint32(10),
        seed: view.getUint32(14),
        blockSize,
        data: bytes.subarray(HEADER_SIZE),
    };
}

// Payload layout: [metaLen uint16][meta JSON utf8][content bytes].
// Meta carries { t: link|text|md|image|file, n: name, m: mime }.
export function buildPayload(meta, content) {
    const metaBytes = new TextEncoder().encode(JSON.stringify(meta));
    const out = new Uint8Array(2 + metaBytes.length + content.length);
    const view = new DataView(out.buffer);

    view.setUint16(0, metaBytes.length);
    out.set(metaBytes, 2);
    out.set(content, 2 + metaBytes.length);

    return out;
}

export function parsePayload(bytes) {
    if (bytes.length < 2) return null;

    const view = new DataView(bytes.buffer, bytes.byteOffset);
    const metaLen = view.getUint16(0);
    if (bytes.length < 2 + metaLen) return null;

    let meta;
    try {
        meta = JSON.parse(new TextDecoder().decode(bytes.subarray(2, 2 + metaLen)));
    } catch {
        return null;
    }

    return { meta, content: bytes.subarray(2 + metaLen) };
}
