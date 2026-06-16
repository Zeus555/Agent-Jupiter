module.exports = {
    apps: [
        {
            name: "prc-jupiter",
            script: "src/index.ts",
            interpreter: "D:/Herramientas/node-v20.18.0-win-x64/node.exe",
            interpreter_args: "--import tsx",
            env: {
                NODE_ENV: "production",
            },
            windowsHide: true,
            max_memory_restart: '1G',
            restart_delay: 5000,
            exp_backoff_restart_delay: 100
        }
    ]
};
