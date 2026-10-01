import type { WAMessage } from '../Types/index.js';

export interface RevizaSocketLike {
    relayMessage(jid: string, message: any, options: any): Promise<any>;
}

export interface NativeFlowSectionRow {
    id: string;
    title: string;
    description?: string;
    header?: string;
}

export interface NativeFlowSection {
    title?: string;
    highlight_label?: string;
    rows: NativeFlowSectionRow[];
}

export interface BuildOptions {
    [key: string]: any;
}

export declare class ButtonV2 {
    constructor(socket: RevizaSocketLike);
    setTitle(value: string): this;
    setSubtitle(value: string): this;
    setBody(value: string): this;
    setFooter(value: string): this;
    setContextInfo(value: Record<string, any>): this;
    addPayload(value: Record<string, any>): this;
    clearButtons(): this;
    addButton(displayText: string, buttonId?: string): this;
    addReply(displayText: string, id?: string): this;
    addCopy(displayText: string, copyCode: string): this;
    addUrl(displayText: string, url: string, options?: Record<string, any>): this;
    addCall(displayText: string, phoneNumber: string): this;
    addSelection(title: string, sections: NativeFlowSection[]): this;
    addRawButton(button: Record<string, any>): this;
    setThumbnail(source: Buffer | string, location?: Record<string, any>): this;
    build(jid: string, options?: BuildOptions): Promise<WAMessage>;
    send(jid: string, options?: BuildOptions): Promise<WAMessage>;
}

export declare class A2UI {
    constructor(socket: RevizaSocketLike);
    setTitle(value: string): this;
    setSubtitle(value: string): this;
    setBody(value: string): this;
    setFooter(value: string): this;
    setContextInfo(value: Record<string, any>): this;
    addPayload(value: Record<string, any>): this;
    clearButtons(): this;
    addButton(displayText: string, buttonId?: string): this;
    addReply(displayText: string, id?: string): this;
    addCopy(displayText: string, copyCode: string): this;
    addUrl(displayText: string, url: string, options?: Record<string, any>): this;
    addCall(displayText: string, phoneNumber: string): this;
    addSelection(title: string, sections: NativeFlowSection[]): this;
    addRawButton(button: Record<string, any>): this;
    setImageUrl(url: string): this;
    setA2uiImageUrl(url: string): this;
    setMessageParams(params: Record<string, any>): this;
    build(jid: string, options?: BuildOptions): Promise<WAMessage>;
    send(jid: string, options?: BuildOptions): Promise<WAMessage>;
}

export declare const NATIVE_FLOW_NODES: any[];
