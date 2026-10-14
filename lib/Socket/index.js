import { DEFAULT_CONNECTION_CONFIG } from '../Defaults/index.js';
import { bindVerifiedReply } from '../Utils/verified-reply-utils.js';
import { makeCommunitiesSocket } from './communities.js';
// export the last socket layer
const makeWASocket = (config) => {
    const newConfig = {
        ...DEFAULT_CONNECTION_CONFIG,
        ...config
    };
    const sock = makeCommunitiesSocket(newConfig);
    bindVerifiedReply(sock);
    return sock;
};
export default makeWASocket;
//# sourceMappingURL=index.js.map
