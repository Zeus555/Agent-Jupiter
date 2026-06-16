# Isolated Linux container for the PRC Jupiter agent.
#
# Runs headful Chromium + the Phantom extension under Xvfb (a virtual display) —
# a container has no real desktop, so the Windows "hide window" feature is a no-op here
# (the browser is never visible regardless). The Playwright base image already bundles
# Chromium and all the system libraries it needs, matched to the project's playwright version.
FROM mcr.microsoft.com/playwright:v1.58.2-jammy

# Tools for the on-demand visual wallet-onboarding session (noVNC in the browser).
# DEBIAN_FRONTEND=noninteractive prevents debconf from hanging the build on prompts.
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
        x11vnc novnc websockify procps fluxbox xdotool wmctrl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first for better layer caching.
# (NODE_ENV is set AFTER this so devDependencies like tsx/typescript are installed.)
COPY package.json package-lock.json ./
RUN npm ci

# Application code + assets.
COPY tsconfig.json swagger.yaml ./
COPY src ./src
COPY extensions/phantom ./extensions/phantom

# Runtime defaults. The real PHANTOM_PASSWORD and other secrets come from --env-file/.env.
# PHANTOM_EXTENSION_PATH points at the in-image extension (overrides any Windows path in .env).
ENV NODE_ENV=production \
    PORT=3011 \
    PHANTOM_EXTENSION_PATH=/app/extensions/phantom \
    BROWSER_VISIBLE=false

EXPOSE 3011

# Headful Chromium needs a display; xvfb-run supplies a virtual one. Pin it to :99 so the
# on-demand noVNC session can reliably attach to the same display.
CMD ["xvfb-run", "-n", "99", "--server-args=-screen 0 1600x1200x24", "./node_modules/.bin/tsx", "src/index.ts"]
