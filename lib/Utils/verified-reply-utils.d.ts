import { proto } from '../../WAProto/index.js';
export declare const VerifiedContentType: {
    readonly UPDATE: 1;
    readonly UPDATE_CARD: 2;
    readonly LINK_CARD: 3;
};
export type VerifiedPresetName = 'whatsapp' | 'meta' | 'metaai';
export declare const VERIFIED_PRESETS: Record<string, {
    name: string;
    jid: string;
}>;
export type VerifiedReplyOptions = {
    preset?: VerifiedPresetName | string;
    name?: string;
    jid?: string;
    serverMessageId?: number;
    contentType?: number;
    text?: string;
    participant?: string;
    stanzaId?: string;
    quotedMessage?: proto.IMessage;
    contextInfo?: proto.IContextInfo;
};
export declare const buildVerifiedNewsletterInfo: (options?: VerifiedReplyOptions) => proto.ContextInfo.IForwardedNewsletterMessageInfo;
export declare const buildVerifiedContextInfo: (options?: VerifiedReplyOptions) => proto.IContextInfo;
export declare const withVerifiedReply: <T extends Record<string, any>>(content: T, options?: VerifiedReplyOptions) => T & {
    contextInfo: proto.IContextInfo;
};
export declare const createVerifiedQuote: (options?: VerifiedReplyOptions) => proto.IWebMessageInfo;
export declare const bindVerifiedReply: <T extends Record<string, any>>(sock: T) => T;
