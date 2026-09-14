/**
 * Reviza@Changes 14-09-26
 * Verified reply (fake verified badge) support.
 *
 * Membuat balasan bot tampil seolah mengutip pesan dari saluran terverifikasi
 * WhatsApp (centang biru), Meta AI, atau saluran custom milikmu sendiri.
 *
 * Ditulis dari nol di atas protokol Baileys (contextInfo.forwardedNewsletterMessageInfo).
 *
 * If you use or copy this code, please credit my name or project. AND DO NOT CHANGE THIS NOTE
 */
import { randomBytes } from 'crypto';
import { proto } from '../../WAProto/index.js';
import { OFFICIAL_BIZ_JID, STORIES_JID } from '../WABinary/jid-utils.js';

/**
 * Tipe konten yang ditampilkan pada label kutipan saluran.
 */
export const VerifiedContentType = {
    UPDATE: 1,
    UPDATE_CARD: 2,
    LINK_CARD: 3,
};

/**
 * Preset identitas terverifikasi bawaan.
 *
 * `jid` memakai format @newsletter karena hanya saluran (newsletter) yang
 * dirender WhatsApp dengan lencana terverifikasi pada kutipan.
 */
export const VERIFIED_PRESETS = {
    whatsapp: {
        name: 'WhatsApp',
        jid: '120363024512399490@newsletter',
    },
    meta: {
        name: 'Meta AI',
        jid: '120363286858032117@newsletter',
    },
    metaai: {
        name: 'Meta AI',
        jid: '120363286858032117@newsletter',
    },
};

const randomServerMessageId = () => Math.floor(Math.random() * 1_000_000) + 1;

const randomStanzaId = () => randomBytes(16).toString('hex').toUpperCase();

/**
 * Susun objek forwardedNewsletterMessageInfo.
 *
 * @param {object} options
 * @param {'whatsapp'|'meta'|'metaai'|string} [options.preset] nama preset bawaan
 * @param {string} [options.name] nama yang tampil (menimpa preset)
 * @param {string} [options.jid] JID saluran (menimpa preset)
 * @param {number} [options.serverMessageId] id pesan pada saluran
 * @param {number} [options.contentType] lihat VerifiedContentType
 * @returns {proto.ContextInfo.IForwardedNewsletterMessageInfo}
 */
export const buildVerifiedNewsletterInfo = (options = {}) => {
    const {
        preset = 'whatsapp',
        name,
        jid,
        serverMessageId,
        contentType = VerifiedContentType.UPDATE,
    } = options;

    const base = VERIFIED_PRESETS[String(preset).toLowerCase()] || VERIFIED_PRESETS.whatsapp;
    const resolvedJid = jid || base.jid;
    const resolvedName = name || base.name;

    if (typeof resolvedJid !== 'string' || !resolvedJid.endsWith('@newsletter')) {
        throw new TypeError('jid saluran harus string dan berakhiran @newsletter');
    }

    return {
        newsletterJid: resolvedJid,
        newsletterName: resolvedName,
        serverMessageId: serverMessageId ?? randomServerMessageId(),
        contentType,
    };
};

/**
 * Bangun contextInfo lengkap berisi kutipan palsu bercentang biru.
 *
 * @param {object} options
 * @param {string} [options.text] isi pesan yang seolah dikutip
 * @param {string} [options.participant] pengirim kutipan
 * @param {object} [options.quotedMessage] pesan kutipan custom (menimpa `text`)
 * @param {object} [options.contextInfo] contextInfo tambahan yang digabungkan
 * @returns {proto.IContextInfo}
 */
export const buildVerifiedContextInfo = (options = {}) => {
    const {
        text = '',
        participant = '0@s.whatsapp.net',
        quotedMessage,
        stanzaId,
        contextInfo = {},
        ...rest
    } = options;

    const info = buildVerifiedNewsletterInfo(rest);

    return {
        ...contextInfo,
        stanzaId: stanzaId || randomStanzaId(),
        participant,
        remoteJid: info.newsletterJid,
        quotedMessage: quotedMessage || { conversation: text || info.newsletterName },
        forwardedNewsletterMessageInfo: info,
        isForwarded: contextInfo.isForwarded ?? false,
    };
};

/**
 * Bungkus isi pesan apa pun agar dikirim dengan kutipan bercentang biru.
 *
 * Contoh:
 *   await sock.sendMessage(jid, withVerifiedReply(
 *     { text: 'Halo!' },
 *     { preset: 'whatsapp', text: 'Pesan resmi' }
 *   ))
 *
 * @param {object} content isi pesan (text/image/video/dll)
 * @param {object} [options] opsi verified, lihat buildVerifiedContextInfo
 * @returns {object} isi pesan yang sudah disisipi contextInfo
 */
export const withVerifiedReply = (content, options = {}) => {
    if (!content || typeof content !== 'object') {
        throw new TypeError('content harus berupa object isi pesan');
    }

    return {
        ...content,
        contextInfo: buildVerifiedContextInfo({
            ...options,
            contextInfo: { ...(content.contextInfo || {}), ...(options.contextInfo || {}) },
        }),
    };
};

/**
 * Buat objek `quoted` palsu yang bisa dipakai pada opsi pengiriman biasa.
 *
 * Contoh:
 *   await sock.sendMessage(jid, { text: 'Halo' }, { quoted: createVerifiedQuote({ preset: 'meta' }) })
 *
 * @param {object} [options] opsi verified, lihat buildVerifiedContextInfo
 * @returns {proto.IWebMessageInfo}
 */
export const createVerifiedQuote = (options = {}) => {
    const { text = '', participant = '0@s.whatsapp.net', quotedMessage, ...rest } = options;
    const info = buildVerifiedNewsletterInfo(rest);

    return {
        key: {
            fromMe: false,
            id: randomStanzaId(),
            remoteJid: info.newsletterJid,
            participant,
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: info.newsletterName,
        message: quotedMessage || { conversation: text || info.newsletterName },
        verifiedBizName: info.newsletterName,
    };
};

/**
 * Pasang helper `sendVerifiedReply` ke instance socket.
 *
 * Dipanggil otomatis oleh makeWASocket, sehingga cukup:
 *   await sock.sendVerifiedReply(jid, { text: 'Halo' }, { preset: 'meta' })
 *
 * @param {object} sock instance socket Baileys
 * @returns {object} sock yang sama
 */
/**
 * Reviza@Changes 14-09-26
 * Kutipan bercentang biru tanpa akun terverifikasi.
 *
 * Klien WhatsApp selalu menggambar lencana terverifikasi untuk JID resmi
 * `16505361212` (akun "WhatsApp Business"). Lencana itu digambar dari daftar
 * bawaan aplikasi, bukan hasil pengecekan sertifikat ke server, sehingga
 * kutipan yang mengaku berasal dari JID tersebut ikut tampil bercentang.
 *
 * Hasilnya sama seperti header "WhatsApp Business (centang) - Status".
 */
const OFFICIAL_BIZ_SENDER = OFFICIAL_BIZ_JID.replace('@c.us', '@s.whatsapp.net');

/**
 * Buat objek `quoted` bercentang biru bergaya Status akun resmi.
 *
 * @param {object} [options]
 * @param {string} [options.name] nama pada baris "Kontak:"
 * @param {string} [options.text] teks kutipan, dipakai bila `contact` false
 * @param {boolean} [options.contact=true] tampilkan sebagai kartu kontak
 * @param {string} [options.participant] JID pengirim kutipan
 * @returns {proto.IWebMessageInfo}
 */
export const createOfficialQuote = (options = {}) => {
    const {
        name = 'WhatsApp',
        text = '',
        contact = true,
        participant = OFFICIAL_BIZ_SENDER,
    } = options;

    const quotedMessage = contact
        ? {
            contactMessage: {
                displayName: name,
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;${name};;;\nFN:${name}\nitem1.TEL;waid=16505361212:+1 (650) 536-1212\nitem1.X-ABLabel:Mobile\nEND:VCARD`,
            },
        }
        : { conversation: text || name };

    return {
        key: {
            fromMe: false,
            id: randomBytes(16).toString('hex').toUpperCase(),
            remoteJid: STORIES_JID,
            participant,
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: name,
        message: quotedMessage,
        status: 2,
        broadcast: true,
        verifiedBizName: 'WhatsApp Business',
    };
};

/**
 * Bungkus isi pesan agar dibalas dengan kutipan bercentang biru resmi,
 * sekaligus tetap mempertahankan tombol saluran dan externalAdReply milikmu.
 *
 * @param {object} content isi pesan
 * @param {object} [options] lihat createOfficialQuote
 */
export const withOfficialQuote = (content, options = {}) => {
    if (!content || typeof content !== 'object') {
        throw new TypeError('content harus berupa object isi pesan');
    }
    const quote = createOfficialQuote(options);
    return {
        ...content,
        contextInfo: {
            ...(content.contextInfo || {}),
            ...(options.contextInfo || {}),
            stanzaId: quote.key.id,
            participant: quote.key.participant,
            remoteJid: quote.key.remoteJid,
            quotedMessage: quote.message,
        },
    };
};

export const bindVerifiedReply = (sock) => {
    if (!sock || typeof sock.sendMessage !== 'function' || sock.sendVerifiedReply) {
        return sock;
    }

    sock.sendVerifiedReply = async (jid, content, options = {}, sendOptions = {}) =>
        sock.sendMessage(jid, withVerifiedReply(content, options), sendOptions);

    sock.sendOfficialReply = async (jid, content, options = {}, sendOptions = {}) =>
        sock.sendMessage(jid, withOfficialQuote(content, options), sendOptions);

    return sock;
};
