<h1 align="center">Reviza Baileys</h1>

<div align="center">

Pustaka WhatsApp berbasis WebSockets untuk kebutuhan bot dan aplikasi **Reviza**.

Berasal dari **Baileys** (`@whiskeysockets/baileys`) dan disesuaikan dengan kebutuhan Reviza.

</div>

---

## Daftar Isi

- [Nama Paket](#nama-paket)
- [Prasyarat](#prasyarat)
- [Instalasi](#instalasi)
- [Cara Menghubungkan Akun](#cara-menghubungkan-akun)
  - [Lewat QR Code](#lewat-qr-code)
  - [Lewat Pairing Code](#lewat-pairing-code)
- [Menyimpan & Memulihkan Sesi](#menyimpan--memulihkan-sesi)
- [Contoh Bot Lengkap](#contoh-bot-lengkap)
- [Mengirim Pesan](#mengirim-pesan)
- [Menerima & Mengunduh Media](#menerima--mengunduh-media)
- [Mengelola Grup](#mengelola-grup)
- [Event yang Tersedia](#event-yang-tersedia)
- [Fungsi Utilitas](#fungsi-utilitas)
- [Format ID WhatsApp (JID)](#format-id-whatsapp-jid)
- [Kontak & Channel Reviza](#kontak--channel-reviza)
- [Kepemilikan & Identitas Proyek](#kepemilikan--identitas-proyek)
- [Lisensi](#lisensi)

## Nama Paket

`@reviza/baileys`

## Prasyarat

| Kebutuhan | Keterangan |
|---|---|
| **Node.js 20 atau lebih baru** | **Wajib.** Saat `npm install`, ada script `preinstall` (`engine-requirements.js`) yang akan **menghentikan instalasi** jika versi Node Anda di bawah 20. |
| **ESM** | Paket ini `"type": "module"`. Kalau project Anda CommonJS, pakai `import()` dinamis (lihat di bawah). |
| **`pino`** | Untuk logger. Sudah ikut terpasang sebagai dependency. |

## Instalasi

Dari registry (jika sudah dirilis):

```bash
npm install @reviza/baileys
```

Langsung dari repository GitHub ini:

```bash
npm install github:revizahoshii-no/reviza-baileys
```

Lalu impor di kode Anda:

```js
import makeWASocket from "@reviza/baileys";
```

Di project CommonJS (`require`):

```js
async function main() {
  const { default: makeWASocket } = await import("@reviza/baileys");
  // ... lanjutkan di sini
}
main();
```

## Cara Menghubungkan Akun

WhatsApp menyediakan API multi-device yang membuat paket ini bisa autentikasi sebagai
perangkat WhatsApp kedua — pindai **QR code** atau pakai **pairing code** dari HP.

### Lewat QR Code

> [!IMPORTANT]
> Kode QR dikirim lewat event `connection.update` sebagai properti `qr` — ambil dari situ,
> jangan mengandalkan opsi `printQRInTerminal` (sudah deprecated, tidak mencetak QR).

```js
import makeWASocket, { Browsers } from "@reviza/baileys";

const sock = makeWASocket({
    browser: Browsers.ubuntu("Reviza App")
});

sock.ev.on("connection.update", ({ qr }) => {
    if (qr) console.log("Scan kode QR ini dengan WhatsApp Anda:\n", qr);
});
```

Pindai lewat **WhatsApp → Perangkat Tertaut → Tautkan Perangkat**, dan Anda langsung masuk.

Mau QR yang bisa dibaca mata (bukan string teks) di terminal? Tambahkan dependency kecil:

```bash
npm install qrcode-terminal
```
```js
import qrcode from "qrcode-terminal";

sock.ev.on("connection.update", ({ qr }) => {
    if (qr) qrcode.generate(qr, { small: true });
});
```

### Lewat Pairing Code

Pairing code dipakai kalau tidak bisa memindai QR (misalnya di server/VPS).
Nomor **tanpa** `+`, `()`, atau `-` — awali dengan kode negara. Untuk Indonesia pakai `62`.

```js
import makeWASocket from "@reviza/baileys";

const sock = makeWASocket({});

if (!sock.authState.creds.registered) {
    const nomor = "6281234567890";
    const kode = await sock.requestPairingCode(nomor);
    console.log("Masukkan kode ini di WhatsApp:", kode);
}
```

Anda juga bisa menentukan kode sendiri, dengan syarat **panjangnya harus pas 8 karakter**:

```js
const kode = await sock.requestPairingCode("6281234567890", "REVIZA01");
```

Kalau panjangnya bukan 8, akan error: `Custom pairing code must be exactly 8 chars`.

## Menyimpan & Memulihkan Sesi

Supaya tidak perlu memindai QR berulang kali, simpan kredensial ke folder:

```js
import makeWASocket, { useMultiFileAuthState } from "@reviza/baileys";

const { state, saveCreds } = await useMultiFileAuthState("auth_info_reviza");

const sock = makeWASocket({
    auth: state         // perhatikan: namanya `auth`, bukan `authState`
});

// dipanggil setiap kali kredensial diperbarui
sock.ev.on("creds.update", saveCreds);
```

> [!WARNING]
> Folder `auth_info_reviza` berisi **kunci sesi** akun WhatsApp Anda. Siapa pun yang memegang
> folder itu bisa mengambil alih sesi. **Jangan pernah** commit ke Git — tambahkan ke `.gitignore`:
>
> ```gitignore
> auth_info_reviza/
> ```

Agar sesi makin awet dan tidak sering diminta pairing ulang, bungkus key store dengan cache:

```js
import makeWASocket, { useMultiFileAuthState, makeCacheableSignalKeyStore } from "@reviza/baileys";
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

## Contoh Bot Lengkap

Ini pola dasar yang paling umum dipakai: tangkap pesan masuk, balas, tangani koneksi putus.

```js
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@reviza/baileys";
import { Boom } from "@hapi/boom";

async function jalankanBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info_reviza");

    const sock = makeWASocket({
        auth: state
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) console.log("Scan kode QR ini:", qr);

        if (connection === "close") {
            const logout = lastDisconnect?.error
                ? new Boom(lastDisconnect.error)?.output?.statusCode === DisconnectReason.loggedOut
                : false;

            console.log("Koneksi tertutup:", lastDisconnect?.error);
            // sambungkan lagi, kecuali Anda memang logout secara sadar
            if (!logout) jalankanBot();
        } else if (connection === "open") {
            console.log("Bot aktif!");
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        // selalu pakai loop: messages adalah array
        for (const m of messages) {
            if (m.key.fromMe) continue;                 // lewati pesan dari bot sendiri
            if (m.message?.protocolMessage) continue;   // lewati edit/hapus pesan

            const teks = m.message?.conversation
                || m.message?.extendedTextMessage?.text
                || "";

            console.log(`Pesan dari ${m.key.remoteJid}:`, teks);
            await sock.sendMessage(m.key.remoteJid, { text: "Halo dari Reviza Baileys!" });
        }
    });

    sock.ev.on("creds.update", saveCreds);
}

jalankanBot();
```

## Mengirim Pesan

Semua jenis pesan dikirim lewat satu fungsi: `sock.sendMessage(jid, konten, opsi)`.

**Teks**

```js
await sock.sendMessage(nomor, { text: "halo apa kabar" });
```

**Balas dengan quote**

```js
await sock.sendMessage(nomor, { text: "oke siap" }, { quoted: pesanMasuk });
```

**Sebut (mention) pengguna**

```js
await sock.sendMessage(nomor, {
    text: "halo @6281234567890 👋",
    mentions: ["6281234567890@s.whatsapp.net"]
});
```

**Gambar**

```js
// dari file
await sock.sendMessage(nomor, { image: { url: "./foto.jpg" }, caption: "caption di sini" });

// dari Buffer hasil unduhan
await sock.sendMessage(nomor, { image: buffer, caption: "langsung dari memori" });
```

**Video, audio, dokumen, sticker, GIF**

```js
await sock.sendMessage(nomor, { video: { url: "./klip.mp4" }, caption: "video", gifPlayback: false });
await sock.sendMessage(nomor, { audio: { url: "./suara.mp3" }, ptt: true });   // ptt: true = voice note
await sock.sendMessage(nomor, { document: { url: "./kata-kata.pdf" }, fileName: "kata-kata.pdf" });
await sock.sendMessage(nomor, { sticker: "./stiker.webp" });
await sock.sendMessage(nomor, { video: { url: "./loop.mp4" }, gifPlayback: true });
```

**View Once**

```js
await sock.sendMessage(nomor, { image: { url: "./rahasia.jpg" }, viewOnce: true });
```

**Lokasi & Kontak**

```js
await sock.sendMessage(nomor, {
    location: { degreesLatitude: -3.5952, degreesLongitude: 97.6571 }  // Medan
});

const vcard =
    "BEGIN:VCARD\n" +
    "VERSION:3.0\n" +
    "FN:Reviza\n" +
    "TEL;type=CELL;type=VOICE;waid=6281234567890:+62 812-3456-7890\n" +
    "END:VCARD";

await sock.sendMessage(nomor, {
    contacts: { displayName: "Reviza", contacts: [{ vcard }] }
});
```

**Reaksi, Poll, dan Maju (forward)**

```js
await sock.sendMessage(nomor, { react: { text: "🔥", key: pesanMasuk.key } });
await sock.sendMessage(nomor, { react: { text: "", key: pesanMasuk.key } });  // string kosong = hapus reaksi

await sock.sendMessage(nomor, {
    poll: { name: "Makan siang?", values: ["Nasi padang", "Soto", "Gado-gado"], selectableCount: 1 }
});

await sock.sendMessage(nomor, { forward: pesanMasuk });
```

> [!TIP]
> Supaya tautan ikut menampilkan *preview*, pasang dependency opsionalnya:
>
> ```bash
> npm install link-preview-js
> ```
>
> Opsi `generateHighQualityLinkPreview` sudah aktif secara default, jadi
> tidak perlu di-set ulang — cukup kirim teks yang berisi URL:
>
> ```js
> await sock.sendMessage(nomor, { text: "lihat: https://example.com" });
> ```

## Menerima & Mengunduh Media

```js
import { downloadMediaMessage } from "@reviza/baileys";
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

        fs.writeFileSync(`unduhan_${m.message.imageMessage ? "foto.jpg" : "media"}`, buffer);
    }
});
```

Butuh alurnya terpisah (unduh manual per konten)? Tersedia juga `downloadContentFromMessage`.

## Mengelola Grup

```js
// buat grup (array nomor)
const { id: jidGrup } = await sock.groupCreate("Ruang Reviza", [
    "6281234567890@s.whatsapp.net",
    "6281234567891@s.whatsapp.net"
]);

// info grup: nama, deskripsi, peserta
const meta = await sock.groupMetadata(jidGrup);
console.log(meta.subject, "| peserta:", meta.participants.length);

// tambah / keluarkan / naikkan-turunkan admin
await sock.groupParticipantsUpdate(jidGrup, ["6281234567892@s.whatsapp.net"], "add");
await sock.groupParticipantsUpdate(jidGrup, ["6281234567892@s.whatsapp.net"], "remove");
await sock.groupParticipantsUpdate(jidGrup, ["6281234567892@s.whatsapp.net"], "promote");
await sock.groupParticipantsUpdate(jidGrup, ["6281234567892@s.whatsapp.net"], "demote");

// ubah nama & deskripsi
await sock.groupUpdateSubject(jidGrup, "Nama Baru");
await sock.groupUpdateDescription(jidGrup, "Deskripsi grup");

// kunci grup (hanya admin yang bisa kirim)
await sock.groupSettingUpdate(jidGrup, "announcement");
await sock.groupSettingUpdate(jidGrup, "not_announcement");  // buka lagi

// pesan sementara (auto-delete)
await sock.groupToggleEphemeral(jidGrup, 7 * 24 * 3600);  // detik
```

## Event yang Tersedia

Paket ini memakai gaya `EventEmitter`, jadi tinggal `sock.ev.on(...)`:

| Event | Kapan terjadi |
|---|---|
| `connection.update` | Status koneksi berubah (`open`, `close`, QR menunggu) |
| `messages.upsert` | Ada pesan baru |
| `messages.update` | Pesan berubah (dibaca, diedit, dihapus, vote poll) |
| `messaging-history.set` | Riwayat chat terkirim saat pertama kali sinkron |
| `chats.upsert` / `chats.update` / `chats.delete` | Data chat berubah |
| `contacts.upsert` / `contacts.update` | Data kontak berubah |
| `groups.upsert` / `groups.update` | Informasi grup berubah |
| `group-participants.update` | Ada yang masuk/keluar/di-promosi |
| `creds.update` | Kredensial sesi perlu disimpan ulang |
| `presence.update` | Ada yang sedang mengetik / online |

Contoh menangani peserta grup baru:

```js
sock.ev.on("group-participants.update", async (event) => {
    if (event.action === "add") {
        await sock.sendMessage(event.id, { text: `Selamat datang @${event.participants[0].split("@")[0]}!`, mentions: event.participants });
    }
});
```

## Fungsi Utilitas

Semua ini bisa diimpor langsung dari `"@reviza/baileys"`:

| Fungsi | Kegunaan |
|---|---|
| `getContentType(pesan)` | Tahu jenis isi pesan (`imageMessage`, `conversation`, dst.) |
| `getDevice(pesan)` | Tahu perangkat pengirim (`android`, `desktop`, `smba`) |
| `normalizeMessageContent(m)` | Buka bungkus pesan (`viewOnce`, `ephemeral`, album, dll.) jadi isi aslinya |
| `hasValidAlbumMedia` / `getAggregateResponsesInEventMessage` | Tambahan khas fork ini |
| `jidDecode("62..@s.whatsapp.net")` | Pecah JID jadi `{ user, server, agent, device }` |
| `jidNormalizedUser(jid)` | Normalisasi JID (buang agent/device) |
| `isJidGroup` / `isJidBroadcast` / `isJidStatusBroadcast` | Cek jenis JID |
| `downloadMediaMessage` / `downloadContentFromMessage` | Unduh media |
| `prepareWAMessageMedia` | Siapkan media sebelum dikirim (untuk kontrol penuh) |
| `generateWAMessageFromContent` | Susun objek pesan mentah |
| `updateMediaMessage` | Kirim ulang media yang habis masa berlakunya |
| `getAggregateVotesInPollMessage` | Baca hasil vote poll |
| `useMultiFileAuthState` / `useSingleFileAuthState` / `useSqliteAuthState` | Simpan sesi (folder / satu file / SQLite) |
| `makeCacheableSignalKeyStore` | Cache kunci sesi (lebih cepat & lebih awet) |
| `initAuthCreds` | Bikin kredensial kosong dari nol |
| `makeInMemoryStore` | Penyimpanan chat/kontak sementara di memori |
| `useSqliteAuthState({ dbPath })` | Simpan sesi di SQLite (butuh `better-sqlite3`) |
| `Browsers` | Pengaturan identitas perangkat (`macOS`, `windows`, `ubuntu`, `android`, `baileys`, `appropriate`) |
| `delay(ms)` | Jeda (Promise) |
| `fetchLatestRevizaBaileysVersion()` / `fetchLatestWaWebVersion()` | Ambil nomor versi WA untuk opsi `version` |
| `proto` | Akses objek protokol WhatsApp (`proto.Message`, `proto.WebMessageInfo`) |

Penyimpanan di memori (praktis untuk bot kecil, **boros RAM** untuk pemakaian serius):

```js
import makeWASocket, { makeInMemoryStore } from "@reviza/baileys";

const store = makeInMemoryStore({});
store.readFromFile("./reviza_store.json");
setInterval(() => store.writeToFile("./reviza_store.json"), 10_000);

const sock = makeWASocket({});
store.bind(sock.ev);

sock.ev.on("chats.upsert", () => console.log(store.chats.all()));
```

## Format ID WhatsApp (JID)

ID tujuan (disebut **JID**) wajib format `[kode negara][nomor]@s.whatsapp.net`:

| Untuk | Format | Contoh |
|---|---|---|
| Pengguna | `nomor@s.whatsapp.net` | `6281234567890@s.whatsapp.net` |
| Grup | `id-internal@g.us` | `120363012345678901@g.us` |
| Broadcast list | `[waktu-dibuat]@broadcast` | — |
| Status/story | `status@broadcast` | — |

Nomor **selalu** pakai kode negara tanpa `+` (Indonesia → `62`).

## Kontak & Channel Reviza

Semua tautan di bawah ini diambil dari situs resmi Reviza: <https://revizayowa.biz.id/>

| Kanal | Tautan |
|---|---|
| WhatsApp (Admin) | https://wa.me/628978595858 |
| Telegram | https://t.me/zayuyoo |
| Instagram | https://instagram.com/Always_revizaa |
| TikTok | https://www.tiktok.com/@reviza4ever |
| YouTube | https://www.youtube.com/@reviza4ever |
| Discord | https://discord.gg/7Nn352cN9b |
| Grup WhatsApp | https://chat.whatsapp.com/BW0zgEgEPUOI5Arb80RWG0 |
| Dukungan (Saweria) | https://saweria.co/REVIZAHOSHI |

### Saluran (Channel) WhatsApp Reviza

| Nama saluran | Kode undangan | JID untuk dipakai via library |
|---|---|---|
| Preset AM / Saluran preset | https://whatsapp.com/channel/0029Vb7xLulDJ6GrrJGtU51t | `120363426118421279@newsletter` |
| Info Channel | https://whatsapp.com/channel/0029VbBc5ak3AzNL2pXnJJ1u | `120363423129630445@newsletter` |

JID di atas berguna kalau Anda mengirim atau menjadwalkan konten ke saluran lewat `sock.sendMessage(jid, ...)`.

### Auto-follow saluran

Saat koneksi berhasil terbuka (`connection === 'open'`), socket otomatis mengikuti dua saluran di atas
lewat `newsletterFollow()`. Perilaku ini **hanya sekali per proses** — reconnect tidak mengirim ulang
permintaan join. Hasilnya dicatat ke log pada level `info`, jadi bisa Anda lihat langsung:

```
{"level":30,...,"jid":"...@newsletter","msg":"sukses follow saluran Reviza"}
{"level":30,...,"jid":"...@newsletter","alasan":409,"msg":"follow saluran Reviza dilewati"}
```

`alasan: 409` artinya sudah pernah ikut, `429`/`503` artinya sedang dibatasi sementara. Keduanya
tidak menghentikan bot.

```js
// matikan kalau tidak dipakai
const sock = makeWASocket({ auth: state, autoFollowSaluran: false });

// atau ganti daftarnya
const sock2 = makeWASocket({ auth: state, autoFollowSaluran: ["1234...@newsletter"] });
```

## Kepemilikan & Identitas Proyek

Paket ini adalah proyek pribadi **Reviza**, dikemas untuk kebutuhan bot dan aplikasinya sendiri.

| Aspek | Keterangan |
|---|---|
| Nama paket | `@reviza/baileys` |
| Versi | `0.3.18-final` |
| Pemegang hak cipta | **Reviza** — © 2026 (lihat `LICENSE`) |
| Penulis di `package.json` | `author: "Reviza"` |
| Lisensi | MIT |
| Rumah proyek | https://github.com/revizahoshii-no/reviza-baileys |
| Kontak & kanal | lihat [Kontak & Channel Reviza](#kontak--channel-reviza) |

**Jejak perubahan Reviza di dalam source.** Fork ini bukan cuma ganti nama: ada **80 penanda**
`Reviza@Changes` / `Reviza@Note` tersebar di **12 file** `lib/`, tercatat sejak 30-01-26.
Kebanyakan menambah jenis & opsi pesan yang tidak ada di Baileys upstream:

- `album`, `quiz` (khusus saluran), `poll result snapshot`, `poll update`, `reaction`/`receipt` update
- `request payment`, `invoice`, `order`, `groupStatus`, `spoiler`, `ephemeral`, `viewOnceV2`,
  `lottieSticker`, `futureProofMessage`, `interactiveAsTemplate`, `native flow`
- `single_select` shortcut, validasi `hasValidAlbumMedia` / `hasValidCarouselHeader`,
  `getAggregateResponsesInEventMessage`, `normalizeMessageContent`
- lapisan rich message (`lib/Utils/rich-message-utils.js`, bertanda `[WIP]`), `useSingleFileAuthState`
  dengan LRUCache + mutex, perbaikan newsletter (`/m1/`, thumbnail server, `additionalNodes`),
  `newsletterSubscribed`, pengurangan pemakaian RSS, `lib/Store/make-in-memory-store.js` (`[WIP]`)

**Perlu Anda ketahui sebelum pakai:** ada nilai `DONATE_URL = "https://saweria.co/REVIZAHOSHI"` di
`lib/Defaults/index.js` yang dipakai sebagai **nilai cadangan** pada tiga tempat:

| Kondisi | Yang terjadi |
|---|---|
| `externalAdReply` dikirim tanpa `url` | `url` diisi `DONATE_URL` |
| `offerText` diisi tapi `offerUrl` kosong | tombol offer menunjuk `DONATE_URL` (teks offer jatuh ke `LIBRARY_NAME`, yaitu `@reviza/baileys`) |
| `richResponseMessage` punya link tanpa `url` | memakai `DONATE_URL`, label sumbernya `"Donate"` / `"Saweria"` |

Semuanya hanya kena kalau field-nya memang kosong — kirim `url` sendiri dan tidak ada yang berubah.

**Yang tetap milik upstream:** basis kode Baileys, protokol `WAProto/`, implementasi Signal, dan
seluruh dependency di `package.json`. Tidak ada klaim kepemilikan atas bagian ini — karena itu
`LICENSE` MIT dibiarkan utuh beserta pemberitahuan hak ciptanya.

## Lisensi

Ketentuan lisensi dan pemberitahuan hak cipta yang diwajibkan oleh komponen sumber tetap tersedia
di file `LICENSE`. File tersebut tidak dihapus atau diubah.

## Catatan

Jangan menghapus file `LICENSE` ketika menyalin atau menggunakan paket ini apabila ketentuan
lisensinya mewajibkan pemberitahuan tersebut tetap disertakan.

## Repository

Sumber resmi proyek: https://github.com/revizahoshii-no/reviza-baileys

Contoh penggunaan di halaman ini diadaptasi dari dokumentasi
[Baileys (`WhiskeySockets/Baileys`)](https://github.com/WhiskeySockets/Baileys) dan diterjemahkan
serta disesuaikan ke `@reviza/baileys`.
