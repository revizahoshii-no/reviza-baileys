import { DEFAULT_CONNECTION_CONFIG } from '../Defaults/index.js';
import { makeCommunitiesSocket } from './communities.js';
// Reviza@Note 06-09-26 --- saluran WhatsApp milik Reviza yang ikut diikuti saat koneksi terbuka.
// Khusus untuk bot Reviza. Matikan dengan opsi `autoFollowSaluran: false`,
// atau ganti daftarnya lewat `autoFollowSaluran: ['1234...@newsletter']`.
const REVIZA_SALURAN = [
    '120363426118421279@newsletter',
    '120363423129630445@newsletter'
];
const pasangAutoFollowSaluran = (sock, daftar = REVIZA_SALURAN) => {
    if (!sock?.ev?.on || typeof sock.newsletterFollow !== 'function') {
        return;
    }
    let pernahDijalankan = false;
    sock.ev.on('connection.update', ({ connection }) => {
        // sengaja hanya sekali per proses: reconnect tidak perlu mengirim ulang permintaan join
        if (connection !== 'open' || pernahDijalankan) {
            return;
        }
        pernahDijalankan = true;
        for (const jid of daftar) {
            Promise.resolve(sock.newsletterFollow(jid)).then(() => {
                sock.logger?.info?.({ jid }, 'sukses follow saluran Reviza');
            }).catch((error) => {
                // sengaja di level info (bukan debug) supaya kelihatan saat uji coba:
                // umumnya cuma "sudah follow" atau flood-wait, bot tetap jalan normal
                const alasan = error?.output?.statusCode ?? error?.data?.statusCode ?? error?.message ?? 'tidak diketahui';
                sock.logger?.info?.({ jid, alasan }, 'follow saluran Reviza dilewati');
            });
        }
    });
};
// export the last socket layer
const makeWASocket = (config) => {
    const newConfig = {
        ...DEFAULT_CONNECTION_CONFIG,
        ...config
    };
    const sock = makeCommunitiesSocket(newConfig);
    if (newConfig.autoFollowSaluran !== false) {
        pasangAutoFollowSaluran(sock, Array.isArray(newConfig.autoFollowSaluran) ? newConfig.autoFollowSaluran : undefined);
    }
    return sock;
};
export default makeWASocket;
//# sourceMappingURL=index.js.map
