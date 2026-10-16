<p align="center">
  <img src="https://raw.githubusercontent.com/revizahoshii-no/reviza-baileys/main/banner.jpg" alt="zachannxd/baileys" width="100%">
</p>

# zachannxd/baileys

Library WhatsApp Web multi-device untuk Node.js. Akarnya dari
[Baileys](https://github.com/WhiskeySockets/Baileys), lalu saya poles sendiri sampai cocok
dipakai bot- saya: tombol interaktif, album, kutipan centang biru, panggilan suara, dan
lain-lain. Kalau kamu pernah pakai Baileys, kamu sudah familiar — bedanya di sini ada
banyak tambahan yang tidak ada di upstream.

- **Paket:** `@zachannxd/baileys`
- **Versi:** 0.6.0
- **Rumah kode:** https://github.com/revizahoshii-no/reviza-baileys
- **Lisensi:** MIT

## Instalasi

```bash
npm install @zachannxd/baileys
```

Atau langsung dari GitHub:

```bash
npm install github:revizahoshii-no/reviza-baileys
```

Kebutuhan dasarnya cuma satu: **Node.js 20 ke atas**. Ada script `preinstall` yang
menghentikan instalasi kalau versi Node kamu di bawah itu. Paket ini ESM
(`"type": "module"`), jadi kalau project kamu masih CommonJS, pakai
`const { default: makeWASocket } = await import("@zachannxd/baileys")`.

```js
import makeWASocket from "@zachannxd/baileys";
```

## Menghubungkan akun

Ada dua cara: QR code atau pairing code. Dua-duanya membuat library ini masuk sebagai
*perangkat tertaut*, seperti WhatsApp Web.

### QR code

QR datang lewat event `connection.update`. Opsi `printQRInTerminal` sudah tidak
mencetak apa-apa, jadi ambil QR-nya dari event:

```js
import makeWASocket, { Browsers } from "@zachannxd/baileys";

const sock = makeWASocket({
    browser: Browsers.ubuntu("Reviza App")
});

sock.ev.on("connection.update", ({ qr }) => {
    if (qr) console.log("Scan QR ini:\n", qr);
});
```

Scan lewat **WhatsApp → Perangkat Tertaut → Tautkan Perangkat**. Mau QR-nya jadi
gambar di terminal? Pasang `qrcode-terminal`, lalu:

```js
import qrcode from "qrcode-terminal";

sock.ev.on("connection.update", ({ qr }) => {
    if (qr) qrcode.generate(qr, { small: true });
});
```

### Pairing code

Lebih pas kalau bot jalan di VPS dan kamu tidak bisa scan. Nomor ditulis tanpa `+`,
`()`, atau `-`, diawali kode negara (Indonesia: `62`):

```js
const sock = makeWASocket({});

if (!sock.authState.creds.registered) {
    const kode = await sock.requestPairingCode("6281234567890");
    console.log("Masukkan kode ini di WhatsApp:", kode);
}
```

Kamu juga bisa menentukan kode sendiri — asal **pas 8 karakter**, tidak lebih tidak
kurang:

```js
const kode = await sock.requestPairingCode("6281234567890", "REVIZA01");
```

## Menyimpan sesi

Tanpa ini, kamu scan QR/pairing ulang setiap restart. Simpan kredensialnya ke folder:

```js
import makeWASocket, { useMultiFileAuthState } from "@zachannxd/baileys";

const { state, saveCreds } = await useMultiFileAuthState("auth_info_reviza");

const sock = makeWASocket({
    auth: state    // namanya `auth`, bukan `authState`
});

sock.ev.on("creds.update", saveCreds);
```

Folder itu berisi **kunci sesi akun WhatsApp kamu** — siapa pun yang pegang foldernya
bisa ambil alih akun. Jangan pernah commit ke Git; masukkan ke `.gitignore`.

Supaya sesi lebih awet, bungkus key store-nya dengan cache:

```js
import makeWASocket, { useMultiFileAuthState, makeCacheableSignalKeyStore } from "@zachannxd/baileys";
import pino from "pino";

const logger = pino({ level: "silent" });
const { state, saveCreds } = await useMultiFileAuthState("auth_info_reviza");

const sock = makeWASocket({
    logger,
    auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
    }
});

sock.ev.on("creds.update", saveCreds);
```

## Bot pertama dalam satu file

Pola paling umum: tangkap pesan, balas, dan sambung ulang kalau putus.

```js
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@zachannxd/baileys";
import { Boom } from "@hapi/boom";

async function jalankanBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info_reviza");

    const sock = makeWASocket({ auth: state });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) console.log("Scan QR ini:", qr);

        if (connection === "close") {
            const logout = lastDisconnect?.error
                ? new Boom(lastDisconnect?.error)?.output?.statusCode === DisconnectReason.loggedOut
                : false;

            console.log("Koneksi tertutup:", lastDisconnect?.error);
            if (!logout) jalankanBot();   // sambung lagi, kecuali memang logout sadar
        } else if (connection === "open") {
            console.log("Bot aktif!");
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        for (const m of messages) {              // selalu loop: messages itu array
            if (m.key.fromMe) continue;
            if (m.message?.protocolMessage) continue;   // lewati edit/hapus pesan

            const teks = m.message?.conversation
                || m.message?.extendedTextMessage?.text
                || "";

            console.log(`Pesan dari ${m.key.remoteJid}:`, teks);
            await sock.sendMessage(m.key.remoteJid, { text: "Halo!" });
        }
    });

    sock.ev.on("creds.update", saveCreds);
}

jalankanBot();
```

## Mengirim pesan

Semua lewat satu fungsi: `sock.sendMessage(jid, konten, opsi)`.

```js
// teks
await sock.sendMessage(nomor, { text: "halo apa kabar" });

// balas dengan quote
await sock.sendMessage(nomor, { text: "oke siap" }, { quoted: pesanMasuk });

// mention
await sock.sendMessage(nomor, {
    text: "halo @6281234567890 👋",
    mentions: ["6281234567890@s.whatsapp.net"]
});

// gambar: dari file atau Buffer
await sock.sendMessage(nomor, { image: { url: "./foto.jpg" }, caption: "caption" });
await sock.sendMessage(nomor, { image: buffer, caption: "dari memori" });

// video, audio (ptt = voice note), dokumen, sticker, gif
await sock.sendMessage(nomor, { video: { url: "./klip.mp4" }, caption: "video" });
await sock.sendMessage(nomor, { audio: { url: "./suara.mp3" }, ptt: true });
await sock.sendMessage(nomor, { document: { url: "./laporan.pdf" }, fileName: "laporan.pdf" });
await sock.sendMessage(nomor, { sticker: "./stiker.webp" });
await sock.sendMessage(nomor, { video: { url: "./loop.mp4" }, gifPlayback: true });

// sekali lihat
await sock.sendMessage(nomor, { image: { url: "./rahasia.jpg" }, viewOnce: true });

// lokasi & kontak
await sock.sendMessage(nomor, { location: { degreesLatitude: -3.5952, degreesLongitude: 97.6571 } });

const vcard =
    "BEGIN:VCARD\n" +
    "VERSION:3.0\n" +
    "FN:Reviza\n" +
    "TEL;type=CELL;type=VOICE;waid=6281234567890:+62 812-3456-7890\n" +
    "END:VCARD";

await sock.sendMessage(nomor, { contacts: { displayName: "Reviza", contacts: [{ vcard }] } });

// reaksi, poll, forward
await sock.sendMessage(nomor, { react: { text: "🔥", key: pesanMasuk.key } });
await sock.sendMessage(nomor, { react: { text: "", key: pesanMasuk.key } });   // "" = hapus reaksi

await sock.sendMessage(nomor, {
    poll: { name: "Makan siang?", values: ["Nasi padang", "Soto", "Gado-gado"], selectableCount: 1 }
});

await sock.sendMessage(nomor, { forward: pesanMasuk });
```

Preview tautan sudah aktif default. Kalau mau preview-nya lebih tajam, pasang
dependency opsional `link-preview-js`, tidak perlu set apa-apa lagi.

### Bentuk pesan khas fork ini

Tiga jenis pesan di bawah punya bentuk sendiri dan sudah diuji — ikuti persis:

```js
// album: array di tingkat atas, minimal 2 media
await sock.sendMessage(nomor, {
    caption: "liburan",
    album: [{ image: { url: "./a.jpg" } }, { video: { url: "./b.mp4" } }]
});

// quiz: lewat `poll` dengan pollType 1 + correctAnswer
await sock.sendMessage(nomor, {
    poll: { name: "Kuis", values: ["Ai", "Ruby"], selectableCount: 1, pollType: 1, correctAnswer: "Ai" }
});

// list: sections di tingkat atas
await sock.sendMessage(nomor, {
    text: "Pilih menu", buttonText: "Menu", title: "Reviza Bot", footer: "ketuk di bawah",
    sections: [{ title: "Utama", rows: [{ rowId: "1", title: "Cek saldo" }] }]
});
```

Kalau bentuknya salah, library menolak dengan pesan yang jelas (misalnya
`Minimum provide 2 media to upload album message`), bukan malah crash diam-diam.

## Button V2 dan A2UI

Sejak 0.6.0, `ButtonV2` dan `A2UI` bisa diimpor langsung dari entry point utama —
tidak perlu nyolong builder dari source bot:

```js
import { ButtonV2, A2UI } from "@zachannxd/baileys";
```

Keduanya pakai method berantai: `setTitle`, `setSubtitle`, `setBody`, `setFooter`,
`setContextInfo` (mention, quote, forwarding), `addReply`/`addButton`,
`addCopy`, `addUrl`, `addCall`, `addSelection` (drawer `single_select`),
`addRawButton` (payload mentah), `setThumbnail` (khusus ButtonV2),
`setA2uiImageUrl` + `setMessageParams` (khusus A2UI), lalu `send(jid)` untuk
kirim atau `build(jid)` kalau mau relay sendiri.

```js
await new ButtonV2(sock)
  .setTitle("Hoshino AI")
  .setSubtitle("Premium Flow")
  .setBody("Pilih tindakan yang ingin dijalankan.")
  .setFooter("Powered by Reviza")
  .setThumbnail("./assets/menu.jpg")   // Buffer, path lokal, atau URL
  .addReply("Buka Menu", ".menu")
  .addCopy("Salin Kode", "REVIZA01")
  .addUrl("Dokumentasi", "https://github.com/revizahoshii-no/reviza-baileys")
  .addSelection("Pilih Fitur", [
    {
      title: "Menu Utama",
      rows: [
        { title: "Downloader", description: "Buka fitur unduhan", id: ".menu download" },
        { title: "AI", description: "Buka fitur AI", id: ".menu ai" }
      ]
    }
  ])
  .send("6281234567890@s.whatsapp.net");
```

A2UI sama persis polanya, bedanya dikirim sebagai `im_a2ui` di dalam
`viewOnceMessage` plus node `biz/native_flow`:

```js
await new A2UI(sock)
  .setTitle("Hoshino AI")
  .setSubtitle("A2UI v0.9")
  .setBody("Panel aksi menggunakan Bloks Widget dan native flow.")
  .setFooter("Reviza")
  .setA2uiImageUrl("https://example.com/header.jpg")
  .setMessageParams({
    bottom_sheet: {
      in_thread_buttons_limit: 1,
      divider_indices: [0],
      list_title: "Daftar Aksi",
      button_title: "Pilih"
    }
  })
  .addReply("Status", ".status")
  .addSelection("Pilih Menu", [
    { title: "Kategori", rows: [{ title: "AI", id: ".menu ai" }, { title: "Game", id: ".menu game" }] }
  ])
  .send(jid);
```

Catatan: rendering A2UI tergantung versi aplikasi WhatsApp penerima, jadi siapkan
fallback teks kalau targetmu masih pakai klien lama.

Impor lain yang paling sering dipakai bot:

```js
import makeWASocket, {
  A2UI, ButtonV2, DisconnectReason,
  areJidsSameUser, downloadContentFromMessage, downloadMediaMessage,
  fetchLatestRevizaBaileysVersion, generateForwardMessageContent,
  generateWAMessage, generateWAMessageFromContent,
  getBinaryNodeChild, getContentType, jidDecode, jidNormalizedUser,
  makeCacheableSignalKeyStore, normalizeMessageContent, prepareWAMessageMedia,
  proto, useMultiFileAuthState
} from "@zachannxd/baileys";
```

## Kutipan centang biru

Balasan bot bisa tampil seperti mengutip pesan dari akun/saluran terverifikasi —
ada lencana centang birunya, plus foto di avatar kutipan. Cara kerjanya dua hal
terpisah:

- **Lencana centang** datang dari `participant`. Klien WhatsApp menggambar lencana
  untuk JID sistem `0@s.whatsapp.net` dari daftar bawaan aplikasinya — bukan hasil
  cek sertifikat ke server, jadi akun bot kamu tidak perlu terverifikasi.
- **Avatar bulat** datang dari baris `TEL;waid=` di vcard. WhatsApp mengambil foto
  profil nomor itu. Tanpa `waid`, avatar-nya abu-abu.

Cara pakai paling cepat — helper ini sudah nempel di socket:

```js
await sock.sendOfficialReply(jid, { text: "Hasil HD IMAGE" }, {
  name: "REVIZA DELUXE",
  waid: m.sender,   // isi nomor apa pun; ini penentu avatar
});
```

Isi `waid` dengan nomor pengirim perintah kalau mau avatarnya ikut foto profil
mereka, atau satu nomor tetap biar selalu sama.

Digabung dengan tombol saluran dan thumbnail besar:

```js
import { withOfficialQuote } from "@zachannxd/baileys";

await sock.sendMessage(jid, withOfficialQuote(
  { text: "Hasil HD IMAGE" },
  {
    name: "REVIZA DELUXE",
    waid: m.sender,
    contextInfo: {
      forwardedNewsletterMessageInfo: {
        newsletterJid: "120363426118421279@newsletter",
        newsletterName: "Komunitas Reviza D Kink",
        serverMessageId: 127,
      },
      externalAdReply: {
        title: "HD IMAGE",
        body: "Reply gambar yang mau dijernihkan",
        sourceUrl: "https://revizayowa.biz.id/",
        mediaType: 1,
        renderLargerThumbnail: true,
      },
    },
  },
));
```

Opsi `sendOfficialReply` / `withOfficialQuote`:

- `name` — nama yang tampil di kutipan (default `WhatsApp`)
- `waid` — nomor pemilik foto profil untuk avatar (plus dan spasi diabaikan)
- `participant` — JID pengirim kutipan, penentu lencana (default `0@s.whatsapp.net`)
- `contact` — `true` (bawaan) kartu kontak, `false` teks biasa
- `thumbnail` — Buffer gambar; kalau diisi, kutipan jadi `imageMessage` dan `waid` diabaikan
- `contextInfo` — tambahan apa pun (saluran, `externalAdReply`, dan seterusnya)

### Verified reply (preset saluran)

Keluarga fungsi satu tujuan yang sama — membuat kutipan berasal dari saluran:

```js
// preset bawaan: 'whatsapp' atau 'meta'
await sock.sendVerifiedReply(jid, { text: "Halo!" }, { preset: "whatsapp" });

// saluran sendiri
await sock.sendVerifiedReply(jid, { text: "Halo!" }, {
  name: "Reviza Official",
  jid: "120363420054181921@newsletter",
  text: "Pesan dari saluran resmi",
});

// bungkus jenis pesan apa pun
import { withVerifiedReply, createVerifiedQuote, buildVerifiedContextInfo } from "@zachannxd/baileys";
await sock.sendMessage(jid, withVerifiedReply({ image: { url: "./gambar.jpg" } }, { preset: "meta" }));

// atau jadi objek quoted biasa
await sock.sendMessage(jid, { text: "Halo" }, {
  quoted: createVerifiedQuote({ preset: "whatsapp", text: "Pemberitahuan resmi" }),
});
```

Opsi lengkapnya: `preset`, `name`, `jid` (harus `...@newsletter`), `text`,
`participant`, `serverMessageId` (diacak kalau kosong), `contentType`
(`VerifiedContentType`: `UPDATE`, `UPDATE_CARD`, `LINK_CARD`), `quotedMessage`
(menimpa `text`), dan `contextInfo`. `bindVerifiedReply(sock)` juga ada, tapi
sudah otomatis terpasang.

> Fitur ini cuma mengubah tampilan kutipan di layar penerima. Tidak memberi
> verifikasi resmi apa pun ke akunmu — pakai dengan bijak.

### Pesan AI Rich tanpa tombol Unduh

Sejak 0.5.1 pesan AI Rich otomatis menyertakan `messageSecret` sehingga langsung
tampil di perangkat penerima. Sebelumnya WhatsApp menampilkan peringatan
*"WhatsApp tidak dapat memastikan pesan ini aman"* plus tombol **Unduh**, karena
library mengirim `verificationMetadata` berisi sertifikat acak yang gagal
divalidasi. Tidak ada yang perlu kamu ubah — kalau mau perilaku lama, kirim
`fakeVerification: true`, atau tentukan `messageSecret` sendiri (Buffer 32 byte).

## Menerima dan mengunduh media

```js
import { downloadMediaMessage } from "@zachannxd/baileys";
import fs from "node:fs";

sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const m of messages) {
        const media = m.message?.imageMessage
            || m.message?.videoMessage
            || m.message?.audioMessage
            || m.message?.documentMessage;

        if (!media) continue;

        const buffer = await downloadMediaMessage(m, "buffer", {}, {
            logger: sock.logger,
            reuploadRequest: sock.updateMediaMessage
        });

        fs.writeFileSync("./unduhan", buffer);
    }
});
```

Butuh kontrol per bagian (streaming)? Pakai `downloadContentFromMessage`.

## Grup

```js
// buat grup
const { id: jidGrup } = await sock.groupCreate("Ruang Reviza", [
    "6281234567890@s.whatsapp.net",
    "6281234567891@s.whatsapp.net"
]);

// info grup
const meta = await sock.groupMetadata(jidGrup);
console.log(meta.subject, "| peserta:", meta.participants.length);

// tambah / keluarkan / promote / demote
await sock.groupParticipantsUpdate(jidGrup, ["6281234567892@s.whatsapp.net"], "add");
await sock.groupParticipantsUpdate(jidGrup, ["6281234567892@s.whatsapp.net"], "remove");
await sock.groupParticipantsUpdate(jidGrup, ["6281234567892@s.whatsapp.net"], "promote");
await sock.groupParticipantsUpdate(jidGrup, ["6281234567892@s.whatsapp.net"], "demote");

// nama, deskripsi, kunci grup, pesan sementara
await sock.groupUpdateSubject(jidGrup, "Nama Baru");
await sock.groupUpdateDescription(jidGrup, "Deskripsi grup");
await sock.groupSettingUpdate(jidGrup, "announcement");        // hanya admin bisa kirim
await sock.groupSettingUpdate(jidGrup, "not_announcement");    // buka lagi
await sock.groupToggleEphemeral(jidGrup, 7 * 24 * 3600);       // auto-delete 7 hari
```

## Event

Semua lewat `sock.ev.on(...)`. Yang paling sering dipakai:

`connection.update` (status koneksi & QR), `messages.upsert` (pesan baru),
`messages.update` (dibaca/diedit/dihapus/vote poll),
`messaging-history.set` (sinkron riwayat pertama), `chats.upsert/update/delete`,
`contacts.upsert/update`, `groups.upsert/update`, `group-participants.update`,
`creds.update` (simpan sesi), `presence.update` (online/sedang mengetik).

```js
sock.ev.on("group-participants.update", async (event) => {
    if (event.action === "add") {
        await sock.sendMessage(event.id, {
            text: `Selamat datang @${event.participants[0].split("@")[0]}!`,
            mentions: event.participants
        });
    }
});
```

## Utilitas

Semuanya diekspor dari entry point utama:

- `getContentType(pesan)` — jenis isi pesan (`imageMessage`, `conversation`, ...)
- `getDevice(pesan)` — perangkat pengirim (`android`, `desktop`, `smba`)
- `normalizeMessageContent(m)` — buka bungkus `viewOnce`/`ephemeral`/album jadi isi aslinya
- `hasValidAlbumMedia`, `hasValidCarouselHeader`, `getAggregateResponsesInEventMessage` — tambahan khas fork ini
- `jidDecode`, `jidNormalizedUser`, `isJidGroup`, `isJidBroadcast`, `isJidStatusBroadcast` — kerjaan seputar JID
- `downloadMediaMessage`, `downloadContentFromMessage`, `prepareWAMessageMedia`, `updateMediaMessage` — media
- `generateWAMessage`, `generateWAMessageFromContent`, `generateForwardMessageContent` — susun pesan manual
- `getAggregateVotesInPollMessage` — hasil vote poll
- `useMultiFileAuthState` (folder), `useSingleFileAuthState` (satu file), `useSqliteAuthState({ dbPath })` (SQLite, butuh `better-sqlite3`), `initAuthCreds` — sesi
- `makeCacheableSignalKeyStore` — cache kunci sesi
- `makeInMemoryStore` — chat/kontak di RAM (praktis, tapi boros memori untuk pemakaian serius)
- `Browsers` — identitas perangkat (`macOS`, `windows`, `ubuntu`, `android`, `baileys`, `appropriate`)
- `delay(ms)`, `fetchLatestRevizaBaileysVersion()`, `fetchLatestWaWebVersion()`, `proto`

## Format JID

Tujuan pesan harus `[kode negara][nomor]@s.whatsapp.net`, selalu tanpa `+`
(Indonesia → `62`). Grup berbentuk `123...@g.us`, status `status@broadcast`,
saluran `123...@newsletter`.

## Panggilan suara (VoIP)

Library ini bisa menelpon nomor WhatsApp dan memutar audio ke dalam panggilan —
mirip bot musik di Discord. **`ffmpeg` wajib terpasang** di server
(`sudo apt install ffmpeg`, atau `pkg install ffmpeg` di Termux).

`VoipClient` menempel pada socket yang sudah login:

```js
import makeWASocket, { useMultiFileAuthState, VoipClient } from "@zachannxd/baileys";

const { state, saveCreds } = await useMultiFileAuthState("./auth");
const sock = makeWASocket({ auth: state });
sock.ev.on("creds.update", saveCreds);

sock.ev.on("connection.update", async ({ connection }) => {
  if (connection !== "open") return;

  const voip = new VoipClient();
  await voip.connectWithSocket(sock);

  const call = await voip.call("6281234567890", {
    durationMs: 30_000,         // otomatis ditutup setelah 30 detik
    audioSource: "./lagu.mp3",  // yang diputar ke lawan bicara
  });

  call.on("ringing",   () => console.log("HP tujuan berdering..."));
  call.on("connected", () => console.log("Diangkat, musik diputar"));
  call.on("ended",     (alasan) => console.log("Selesai:", alasan));

  await call.waitForEnd();
  voip.disconnect();
});
```

`audioSource` bisa `"silence"` (default, fake call murni), path file audio apa pun
yang didukung ffmpeg, URL streaming, atau filter ffmpeg seperti
`"lavfi:sine=frequency=440"` untuk nada buatan. Anggota lain yang tersedia:
`call.end()`, `call.mute(true)`, `call.state` (lihat `CallState`), dan event
`audio` untuk menerima PCM dari lawan bicara.

Beberapa hal yang perlu kamu tahu:

- Nomor tujuan ditulis **tanpa** `@s.whatsapp.net` — cukup `6281234567890`.
- Panggilan berjalan dari akun yang sedang login, jadi tercatat di riwayat
  teleponnya.
- Modul ini memuat mesin WASM ±9,8 MB saat pertama dipakai — panggilan pertama
  agak lambat, wajar.
- Jangan dipakai spam telepon; akun berisiko diblokir WhatsApp.

## Kontak & saluran

Semua tautan diambil dari <https://revizayowa.biz.id/>:

- WhatsApp Admin: <https://wa.me/628978595858>
- Telegram: <https://t.me/zayuyoo>
- Instagram: <https://instagram.com/Always_revizaa>
- TikTok: <https://www.tiktok.com/@reviza4ever>
- YouTube: <https://www.youtube.com/@reviza4ever>
- Discord: <https://discord.gg/7Nn352cN9b>
- Grup WhatsApp: <https://chat.whatsapp.com/BW0zgEgEPUOI5Arb80RWG0>
- Dukungan (Saweria): <https://saweria.co/REVIZAHOSHI>

Saluran Reviza yang sering dipakai bot:

- Preset AM / Saluran preset — <https://whatsapp.com/channel/0029Vb7xLulDJ6GrrJGtU51t> (`120363426118421279@newsletter`)
- Info Channel — <https://whatsapp.com/channel/0029VbBc5ak3AzNL2pXnJJ1u> (`120363423129630445@newsletter`)

**Library ini tidak mengikuti saluran apa pun secara otomatis** — keputusan
mengikuti saluran punya pemilik akun. Kalau bot kamu mau ikut saluran sendiri,
panggil langsung dari kode bot (misal sekali saat koneksi terbuka):

```js
await sock.newsletterFollow("120363426118421279@newsletter");
```

`409` berarti sudah ikut, `429`/`503` lagi dibatasi — dua-duanya tidak mengganggu bot.

## Catatan sebelum dipakai

**Fallback donasi.** Ada nilai `DONATE_URL = "https://saweria.co/REVIZAHOSHI"` di
`lib/Defaults/index.js` yang jadi nilai cadangan di tiga tempat: `externalAdReply`
yang dikirim tanpa `url`, tombol offer yang `offerUrl`-nya kosong, dan link
`richResponseMessage` tanpa `url`. Semuanya cuma kena kalau field-nya kosong —
isi `url` sendiri dan tidak ada yang berubah.

**Jejak perubahan.** Fork ini bukan sekadar ganti nama. Ada 80-an penanda
`Reviza@Changes` / `Reviza@Note` di 12 file `lib/`, menambah jenis dan opsi pesan
yang tidak ada di upstream: album, quiz saluran, poll snapshot/update, reaction
update, request payment, invoice, order, group status, spoiler, ephemeral,
view-once V2, lottie sticker, `single_select`, native flow, validasi album/carousel,
dan lapisan rich message — ditambah perbaikan newsletter dan pengurangan pemakaian RSS.

**Yang tetap milik upstream.** Basis kode Baileys, protokol `WAProto/`,
implementasi Signal, dan semua dependency — bukan milik saya, dan tidak pernah
diklaim. File `LICENSE` MIT dibiarkan utuh beserta pemberitahuan hak ciptanya.
Jangan hapus file itu kalau kamu menyalin atau memakai paket ini.

## Terima kasih

Library ini berdiri di atas kerja banyak orang:

- [Baileys — adiwajshing](https://github.com/adiwajshing/Baileys), pustaka asalnya.
- [Baileys — WhiskeySockets](https://github.com/WhiskeySockets/Baileys), kelanjutan resmi yang jadi dasar fork ini.
- [ourin-baileys — zanpiww (@Zann)](https://www.npmjs.com/package/ourin-baileys), modul VoIP (panggilan suara + putar musik) berasal dari sini. Terima kasih banyak.
- Reviza — penyesuaian, penambahan fitur, dan pemeliharaan fork ini.
