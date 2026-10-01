import assert from 'node:assert/strict';
import test from 'node:test';

import { A2UI, ButtonV2, NATIVE_FLOW_NODES } from '../lib/index.js';

const jid = '6281234567890@s.whatsapp.net';

const makeSocket = () => {
    const calls = [];
    return {
        calls,
        async relayMessage(...args) {
            calls.push(args);
        },
    };
};

test('ButtonV2 is exported and builds the Hoshino button payload', async () => {
    const socket = makeSocket();
    const builder = new ButtonV2(socket)
        .setTitle('Hoshino')
        .setBody('Pilih')
        .setFooter('Reviza')
        .addReply('Menu', '.menu')
        .addCopy('Salin', 'REVIZA')
        .addSelection('Kategori', [{ title: 'Utama', rows: [{ title: 'AI', id: '.menu ai' }] }]);

    const message = await builder.build(jid);
    const payload = message.message.buttonsMessage;
    assert.equal(payload.contentText, 'Hoshino\n\nPilih');
    assert.equal(payload.buttons.length, 3);
    assert.equal(payload.buttons[1].nativeFlowInfo.name, 'cta_copy');
    assert.equal(payload.buttons[2].nativeFlowInfo.name, 'single_select');

    await builder.send(jid);
    assert.equal(socket.calls.length, 1);
    assert.deepEqual(socket.calls[0][2].additionalNodes, NATIVE_FLOW_NODES);
});

test('A2UI builds im_a2ui with quick reply and native flow actions', async () => {
    const socket = makeSocket();
    const message = await new A2UI(socket)
        .setTitle('Hoshino AI')
        .setSubtitle('Premium Flow')
        .setBody('Panel aksi')
        .setFooter('Reviza')
        .setA2uiImageUrl('https://example.com/header.jpg')
        .setMessageParams({ bottom_sheet: { button_title: 'Pilih' } })
        .addReply('Status', '.status')
        .addUrl('Dokumentasi', 'https://example.com')
        .build(jid);

    const interactive = message.message.viewOnceMessage.message.interactiveMessage;
    assert.equal(interactive.bloksWidget.type, 'im_a2ui');
    assert.equal(interactive.nativeFlowMessage.buttons[0].name, 'quick_reply');
    assert.equal(interactive.nativeFlowMessage.buttons[1].name, 'cta_url');
    assert.equal(JSON.parse(interactive.bloksWidget.data).version, 'v0.9');
});

test('builders reject missing socket, destination, buttons, and invalid drawer', async () => {
    assert.throws(() => new ButtonV2(), /socket/i);
    const socket = makeSocket();
    await assert.rejects(new ButtonV2(socket).addReply('Menu', '.menu').build(''), /destination/i);
    await assert.rejects(new A2UI(socket).build(jid), /button/i);
    assert.throws(() => new A2UI(socket).addSelection('Menu', []), /section/i);
});
