import { exec, execSync } from 'child_process';
import crypto from 'crypto';
import { logger } from './logger.js';

// On-demand noVNC session attached to the container's Xvfb display, so a human can
// complete/replace the Phantom wallet visually (reliable, unlike headless automation).
// Started/stopped via the secure /wallet/onboard-session endpoints.

const DISPLAY = process.env.XVFB_DISPLAY || ':99';
const VNC_PORT = 5900;
const WEB_PORT = Number(process.env.NOVNC_PORT) || 6080;
const NOVNC_WEB = '/usr/share/novnc';

let active = false;
let currentPassword: string | null = null;

export const isVncActive = () => active;

export const stopVncSession = (): void => {
    try { execSync('pkill -f x11vnc'); } catch {}
    try { execSync('pkill -f websockify'); } catch {}
    try { execSync('pkill -f fluxbox'); } catch {}
    active = false;
    currentPassword = null;
    logger.info('[vnc] session stopped');
};

/**
 * Starts x11vnc on the Xvfb display + websockify (noVNC web). Returns the web port and a
 * one-time VNC password (max 8 chars). Idempotent: restarts cleanly if already running.
 */
export const startVncSession = (): { webPort: number; password: string } => {
    stopVncSession(); // clean any previous

    // Window manager so popup windows are placed on-screen and movable. Toolbar OFF so it
    // doesn't cover the bottom buttons of the Phantom popup. (DISPLAY/XAUTHORITY are inherited
    // from the node process, which xvfb-run set up.)
    try {
        execSync('mkdir -p /root/.fluxbox && printf "session.screen0.toolbar.visible: false\\n" > /root/.fluxbox/init');
    } catch {}
    exec('fluxbox', (err) => { if (err) logger.info('[vnc] fluxbox exited:', err.message); });

    const password = crypto.randomBytes(4).toString('hex'); // 8 chars (VNC limit)
    // Store an obfuscated password file for x11vnc (-rfbauth), avoids plaintext on the cmdline.
    execSync(`x11vnc -storepasswd ${password} /tmp/.vncpw`);

    // x11vnc: serve the existing Xvfb display; -bg daemonizes it.
    exec(`x11vnc -display ${DISPLAY} -rfbport ${VNC_PORT} -rfbauth /tmp/.vncpw -forever -shared -noxdamage -bg -o /tmp/x11vnc.log`,
        (err) => { if (err) logger.error('[vnc] x11vnc error:', err.message); });

    // websockify serves the noVNC web client and proxies WS -> VNC.
    exec(`websockify --web=${NOVNC_WEB} ${WEB_PORT} localhost:${VNC_PORT}`,
        (err) => { if (err) logger.info('[vnc] websockify exited:', err.message); });

    active = true;
    currentPassword = password;
    logger.force(`[vnc] session started on web port ${WEB_PORT} (display ${DISPLAY})`);
    return { webPort: WEB_PORT, password };
};
