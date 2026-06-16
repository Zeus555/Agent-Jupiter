import dotenv from 'dotenv';
dotenv.config();

const isDebug = process.env.AGENT_DEBUG === 'true';

export const logger = {
    info: (...args: any[]) => {
        if (isDebug) {
            console.log(...args);
        }
    },
    warn: (...args: any[]) => {
        // We keep warnings visible unless it's pure quiet, but usually warnings are important
        console.warn(...args);
    },
    error: (...args: any[]) => {
        // Errors must always be visible
        console.error(...args);
    },
    // Force log even in quiet mode (for banners)
    force: (...args: any[]) => {
        console.log(...args);
    }
};
