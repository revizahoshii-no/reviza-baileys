import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { generateWAMessageFromContent } from './messages.js';

const NATIVE_FLOW_NODES = [{
    tag: 'biz',
    attrs: {},
    content: [{
        tag: 'interactive',
        attrs: { type: 'native_flow', v: '1' },
        content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
    }],
}];

const assertText = (value, name) => {
    if (typeof value !== 'string') throw new TypeError(`${name} must be a string`);
    return value;
};

const assertObject = (value, name) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be a plain object`);
    return value;
};

const nativeButton = (name, params) => ({
    buttonId: crypto.randomUUID(),
    buttonText: { displayText: params.display_text || params.title || name },
    type: 1,
    nativeFlowInfo: { name, paramsJson: JSON.stringify(params) },
});

class RevizaInteractiveBuilder {
    constructor(socket) {
        if (!socket || typeof socket.relayMessage !== 'function') throw new TypeError('A WhatsApp socket with relayMessage() is required');
        this.socket = socket;
        this.title = '';
        this.subtitle = '';
        this.body = '';
        this.footer = '';
        this.contextInfo = {};
        this.extraPayload = {};
        this.buttons = [];
    }

    setTitle(value) { this.title = assertText(value, 'Title'); return this; }
    setSubtitle(value) { this.subtitle = assertText(value, 'Subtitle'); return this; }
    setBody(value) { this.body = assertText(value, 'Body'); return this; }
    setFooter(value) { this.footer = assertText(value, 'Footer'); return this; }
    setContextInfo(value) { this.contextInfo = assertObject(value, 'ContextInfo'); return this; }
    addPayload(value) { Object.assign(this.extraPayload, assertObject(value, 'Payload')); return this; }
    clearButtons() { this.buttons = []; return this; }

    addButton(displayText, buttonId = crypto.randomUUID()) {
        assertText(displayText, 'Button display text');
        assertText(buttonId, 'Button id');
        if (!displayText.trim() || !buttonId.trim()) throw new TypeError('Button display text and id must not be empty');
        this.buttons.push({ buttonId, buttonText: { displayText }, type: 1 });
        return this;
    }

    addReply(displayText, id = crypto.randomUUID()) { return this.addButton(displayText, id); }

    addCopy(displayText, copyCode) {
        assertText(copyCode, 'Copy code');
        if (!copyCode) throw new TypeError('Copy code must not be empty');
        this.buttons.push(nativeButton('cta_copy', { display_text: assertText(displayText, 'Button display text'), copy_code: copyCode }));
        return this;
    }

    addUrl(displayText, url, options = {}) {
        assertText(url, 'URL');
        this.buttons.push(nativeButton('cta_url', { display_text: assertText(displayText, 'Button display text'), url, merchant_url: options.merchant_url || url, ...options }));
        return this;
    }

    addCall(displayText, phoneNumber) {
        this.buttons.push(nativeButton('cta_call', { display_text: assertText(displayText, 'Button display text'), id: assertText(phoneNumber, 'Phone number') }));
        return this;
    }

    addSelection(title, sections) {
        if (!Array.isArray(sections) || !sections.length) throw new TypeError('Selection sections must be a non-empty array');
        this.buttons.push(nativeButton('single_select', { title: assertText(title, 'Selection title'), sections }));
        return this;
    }

    addRawButton(button) {
        assertObject(button, 'Button');
        if (button.type !== 1) throw new TypeError('Raw buttons must use type: 1');
        if (!button.buttonText?.displayText || !button.buttonId) throw new TypeError('Raw buttons require buttonId and buttonText.displayText');
        this.buttons.push(structuredClone(button));
        return this;
    }

    relayOptions(messageId, options = {}) {
        return { ...options, messageId, additionalNodes: options.additionalNodes || NATIVE_FLOW_NODES };
    }

    requireDestination(jid) {
        if (typeof jid !== 'string' || !jid.trim()) throw new TypeError('A valid destination JID is required');
        if (!this.buttons.length) throw new Error('At least one button is required');
    }
}

export class ButtonV2 extends RevizaInteractiveBuilder {
    constructor(socket) {
        super(socket);
        this.thumbnail = null;
        this.location = {};
    }

    setThumbnail(source, location = {}) {
        if (!Buffer.isBuffer(source) && (typeof source !== 'string' || !source.trim())) throw new TypeError('Thumbnail must be a Buffer, local path, or HTTP/HTTPS URL');
        this.thumbnail = source;
        this.location = assertObject(location, 'Location');
        return this;
    }

    async resolveThumbnail() {
        if (!this.thumbnail) return null;
        if (Buffer.isBuffer(this.thumbnail)) return Buffer.from(this.thumbnail);
        if (/^https?:\/\//i.test(this.thumbnail)) {
            const response = await fetch(this.thumbnail);
            if (!response.ok) throw new Error(`Unable to download thumbnail: HTTP ${response.status}`);
            return Buffer.from(await response.arrayBuffer());
        }
        return readFile(this.thumbnail);
    }

    async build(jid, options = {}) {
        this.requireDestination(jid);
        const thumbnail = await this.resolveThumbnail();
        const contentText = thumbnail ? this.body : [this.title, this.subtitle, this.body].filter(Boolean).join('\n\n');
        const header = thumbnail ? {
            headerType: 6,
            locationMessage: {
                degreesLatitude: 0,
                degreesLongitude: 0,
                name: this.title,
                address: this.subtitle,
                ...this.location,
                jpegThumbnail: thumbnail,
            },
        } : { headerType: 1 };
        return generateWAMessageFromContent(jid, {
            ...this.extraPayload,
            buttonsMessage: {
                contentText,
                footerText: this.footer,
                ...header,
                viewOnce: true,
                contextInfo: this.contextInfo,
                buttons: this.buttons,
            },
        }, options);
    }

    async send(jid, options = {}) {
        const message = await this.build(jid, options);
        await this.socket.relayMessage(message.key.remoteJid, message.message, this.relayOptions(message.key.id, options));
        return message;
    }
}

export class A2UI extends RevizaInteractiveBuilder {
    constructor(socket) {
        super(socket);
        this.imageUrl = '';
        this.messageParams = {};
        this.widgetVersion = 'v0.9';
    }

    setImageUrl(url) {
        assertText(url, 'Image URL');
        if (url && !/^https?:\/\//i.test(url)) throw new TypeError('A2UI image URL must use HTTP or HTTPS');
        this.imageUrl = url;
        return this;
    }

    setA2uiImageUrl(url) { return this.setImageUrl(url); }
    setMessageParams(params) { this.messageParams = assertObject(params, 'Message params'); return this; }

    toNativeButtons() {
        return this.buttons.map((button) => button.nativeFlowInfo?.name ? {
            name: button.nativeFlowInfo.name,
            buttonParamsJson: button.nativeFlowInfo.paramsJson,
        } : {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({ display_text: button.buttonText.displayText, id: button.buttonId }),
        });
    }

    buildWidget() {
        const children = [];
        const components = [{ id: 'root', component: 'Column', children: ['card'] }];
        if (this.imageUrl) {
            children.push('image');
            components.push({ id: 'image', component: 'Image', url: this.imageUrl, variant: 'header', fit: 'cover' });
        }
        if (this.title) {
            children.push('title');
            components.push({ id: 'title', component: 'Text', text: this.title, variant: 'body' });
        }
        if (this.subtitle) {
            children.push('subtitle');
            components.push({ id: 'subtitle', component: 'Text', text: this.subtitle, variant: 'caption' });
        }
        if (this.body) {
            children.push('body');
            components.push({ id: 'body', component: 'Text', text: this.body, variant: 'caption' });
        }
        components.push({ id: 'content', component: 'Column', children });
        components.push({ id: 'card', component: 'Card', child: 'content' });
        return {
            version: this.widgetVersion,
            createSurface: {
                surfaceId: `starcore-widget=${crypto.randomUUID()}`,
                catalogId: 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json',
                components,
            },
        };
    }

    async build(jid, options = {}) {
        this.requireDestination(jid);
        return generateWAMessageFromContent(jid, {
            ...this.extraPayload,
            viewOnceMessage: {
                message: {
                    interactiveMessage: {
                        header: { hasMediaAttachment: false },
                        body: this.body ? { text: this.body } : undefined,
                        footer: { text: this.footer },
                        nativeFlowMessage: {
                            buttons: this.toNativeButtons(),
                            messageParamsJson: JSON.stringify(this.messageParams),
                            messageVersion: 1,
                        },
                        bloksWidget: {
                            uuid: crypto.randomUUID(),
                            data: JSON.stringify(this.buildWidget()),
                            type: 'im_a2ui',
                        },
                        contextInfo: this.contextInfo,
                    },
                },
            },
        }, options);
    }

    async send(jid, options = {}) {
        const message = await this.build(jid, options);
        await this.socket.relayMessage(message.key.remoteJid, message.message, this.relayOptions(message.key.id, options));
        return message;
    }
}

export { NATIVE_FLOW_NODES };
