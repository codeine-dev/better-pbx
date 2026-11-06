# syntax=docker/dockerfile:1.7

# BetterPBX runtime image.
#
# The image is deliberately built in three stages:
#   1. asterisk-builder — compiles a pinned Asterisk 22 LTS from source on Debian 13.
#   2. api-builder      — compiles the Fastify API and deploys production dependencies.
#   3. runtime          — Debian 13 + Node 24 + s6-overlay + fail2ban + Asterisk.
#
# Everything mutable lives under /data. The image itself is read-only apart from that volume,
# /run, and /etc/asterisk (a symlink into /data created by the one-shot init service).

ARG ASTERISK_VERSION=22.12.0
ARG ASTERISK_SHA256=f8b2ba98aac6c4ff3376bc0a2868bea6ed577ca684efb7ec739ae6e8ce6e35e2
ARG S6_OVERLAY_VERSION=3.2.3.2

# ---------------------------------------------------------------------------
# Stage 1: Asterisk 22 LTS from source
# ---------------------------------------------------------------------------
FROM debian:13-slim AS asterisk-builder

ARG ASTERISK_VERSION
ARG ASTERISK_SHA256
ARG DEBIAN_FRONTEND=noninteractive

# Build dependencies for Asterisk plus the bundled pjproject/jansson tarballs. pjproject is
# downloaded during configure, so bzip2 and ca-certificates are required as well.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        autoconf \
        automake \
        bison \
        build-essential \
        bzip2 \
        ca-certificates \
        curl \
        file \
        flex \
        libcap-dev \
        libcurl4-openssl-dev \
        libedit-dev \
        libncurses-dev \
        libnewt-dev \
        libsqlite3-dev \
        libsrtp2-dev \
        libssl-dev \
        libtool \
        libxml2-dev \
        libxslt1-dev \
        pkg-config \
        uuid-dev \
        wget \
        xz-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/asterisk

# Verify the exact release tarball before extracting it. Bumping Asterisk requires bumping both
# the version and the checksum; floating `22-current` is never used in a release image.
RUN set -eux; \
    url="https://downloads.asterisk.org/pub/telephony/asterisk/asterisk-${ASTERISK_VERSION}.tar.gz"; \
    curl -fsSL -o /tmp/asterisk.tar.gz "$url"; \
    echo "${ASTERISK_SHA256}  /tmp/asterisk.tar.gz" | sha256sum -c -; \
    tar -xzf /tmp/asterisk.tar.gz --strip-components=1; \
    rm -f /tmp/asterisk.tar.gz

# The curated menuselect file disables ARI/Stasis, the internal HTTP server, legacy channel
# drivers, command-execution applications, and modules we do not need in the appliance.
COPY docker/asterisk/menuselect.makeopts /tmp/better-pbx-menuselect.makeopts

RUN set -eux; \
    ./configure \
        --prefix=/usr \
        --sysconfdir=/etc \
        --localstatedir=/var \
        --with-pjproject-bundled \
        --with-jansson-bundled \
        --with-ssl=ssl \
        --with-srtp; \
    make menuselect.makeopts; \
    cp /tmp/better-pbx-menuselect.makeopts ./menuselect.makeopts; \
    menuselect/menuselect --check-deps menuselect.makeopts; \
    make -j"$(nproc)"; \
    make install DESTDIR=/out

# ---------------------------------------------------------------------------
# Stage 2: English sound packs and music on hold
# ---------------------------------------------------------------------------
FROM debian:13-slim AS sounds

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# All packs are pinned by SHA-256. English is the default language; other languages can be
# added here as separate stages without changing the runtime layout.
RUN set -eux; \
    mkdir -p /out/var/lib/asterisk/sounds/en /out/var/lib/asterisk/moh; \
    fetch() { \
        url="$1"; checksum="$2"; name="$3"; target="$4"; \
        curl -fsSL -o "/tmp/${name}" "$url"; \
        echo "${checksum}  /tmp/${name}" | sha256sum -c -; \
        tar -xzf "/tmp/${name}" -C "$target"; \
        rm -f "/tmp/${name}"; \
    }; \
    base="https://downloads.asterisk.org/pub/telephony/sounds/releases"; \
    fetch "${base}/asterisk-core-sounds-en-ulaw-1.6.1.tar.gz" \
        83ec602fb1f2cb06a5194a95f855b84bae35d49d5bdb6fbd9274d5d1a5d16b0e \
        core-ulaw.tar.gz /out/var/lib/asterisk/sounds/en; \
    fetch "${base}/asterisk-core-sounds-en-gsm-1.6.1.tar.gz" \
        d79c3d2044d41da8f363c447dfccc140be86b4fcc41b1ca5a60a80da52f24f2d \
        core-gsm.tar.gz /out/var/lib/asterisk/sounds/en; \
    fetch "${base}/asterisk-core-sounds-en-g722-1.6.1.tar.gz" \
        59891033e764d9dffc5ccdd78e845a1c8ea6bed0b434128bb0199c63ef591770 \
        core-g722.tar.gz /out/var/lib/asterisk/sounds/en; \
    fetch "${base}/asterisk-extra-sounds-en-ulaw-1.5.2.tar.gz" \
        1eb9756ff853bd0dd625cb6f9367fc6b9c371cabf3f224e0f68ca3673e150b0e \
        extra-ulaw.tar.gz /out/var/lib/asterisk/sounds/en; \
    fetch "${base}/asterisk-extra-sounds-en-gsm-1.5.2.tar.gz" \
        a872eb41868a75b8b4ea677d46f2659870c7190037e1d97853b4b060e60e9d7c \
        extra-gsm.tar.gz /out/var/lib/asterisk/sounds/en; \
    fetch "${base}/asterisk-extra-sounds-en-g722-1.5.2.tar.gz" \
        b004f2c427c83088fc455cacf74c17a871e514ed22558f5b9c9c09876b05bb4b \
        extra-g722.tar.gz /out/var/lib/asterisk/sounds/en; \
    fetch "${base}/asterisk-moh-opsound-ulaw-2.03.tar.gz" \
        95b163d7f931d58864aba2cfe32156accca7af782c850fb867a85ce88c02573c \
        moh-ulaw.tar.gz /out/var/lib/asterisk/moh; \
    fetch "${base}/asterisk-moh-opsound-gsm-2.03.tar.gz" \
        b0fb7b52b05094a3d5298c965e98717f9907d65a9ec47604ac05d8b06a96e940 \
        moh-gsm.tar.gz /out/var/lib/asterisk/moh

# ---------------------------------------------------------------------------
# Stage 3: API production build
# ---------------------------------------------------------------------------
FROM node:24-trixie-slim AS api-builder

ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable

WORKDIR /build

# Copy every workspace manifest so the frozen lockfile can be installed without pulling the
# entire repository into the build context.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/config-engine/package.json packages/config-engine/package.json
COPY packages/test-fixtures/package.json packages/test-fixtures/package.json

RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY apps/api ./apps/api

RUN pnpm --filter @better-pbx/api build \
    && pnpm --filter @better-pbx/api deploy --prod --legacy /out \
    && rm -rf /out/src /out/tsconfig.json /out/tsconfig.build.json

# ---------------------------------------------------------------------------
# Stage 4: Runtime
# ---------------------------------------------------------------------------
FROM node:24-trixie-slim AS runtime

ARG S6_OVERLAY_VERSION
ARG DEBIAN_FRONTEND=noninteractive

ENV NODE_ENV=production \
    PBX_DATA_DIR=/data \
    PBX_API_PORT=8080 \
    PBX_API_HOST=0.0.0.0 \
    PBX_SETUP_TOKEN_FILE=/data/setup-token \
    PBX_INTERNAL_TOKEN_FILE=/data/runtime/internal-token \
    PBX_INTERNAL_URL=http://127.0.0.1:8080 \
    TZ=UTC

# Runtime libraries match the Debian 13 builder. fail2ban brings in Python 3; its default
# firewall actions are replaced with the loopback API action shipped in this image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        fail2ban \
        git \
        iproute2 \
        libatomic1 \
        libcap2 \
        libedit2 \
        libncurses6 \
        libpopt0 \
        libsqlite3-0 \
        libsrtp2-1 \
        libssl3t64 \
        libtinfo6 \
        libuuid1 \
        libxml2 \
        libxslt1.1 \
        openssl \
        procps \
        sox \
        sqlite3 \
        tzdata \
        xz-utils \
    && rm -rf /var/lib/apt/lists/* /etc/fail2ban/jail.d/*.conf

# s6-overlay 3 as PID 1. The architecture-specific tarball and the noarch tarball are both
# pinned so the image can be built for the architectures this project supports.
RUN set -eux; \
    case "$(dpkg --print-architecture)" in \
        amd64)   s6arch=x86_64;  sum=e6befcc96a437a3831386ecfc51808c5d3e939dc5fe3c02ae9284599e8aa2408 ;; \
        arm64)   s6arch=aarch64; sum=b17f17a82e7a515c682a91edaf2ffdabb73f891981b6c1fd712115693a2f8b4c ;; \
        armhf)   s6arch=arm;     sum=9fc621c84370ab8fdf72dee51ba16c85a882d01bd2f3b388f8e1ee6bc03e00d3 ;; \
        i386)    s6arch=i686;    sum=3139bc0ddc7d51631cd646e4438bf83a649fb4ff027bfca8e769071b21b00b0b ;; \
        riscv64) s6arch=riscv64; sum=85fbc5aac7b35b46e4c1f21547df85c75442876425471837875e7471331217de ;; \
        *) echo "unsupported architecture: $(dpkg --print-architecture)" >&2; exit 1 ;; \
    esac; \
    base="https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}"; \
    curl -fsSL -o /tmp/s6-overlay-noarch.tar.xz "${base}/s6-overlay-noarch.tar.xz"; \
    echo "5379750ed30a84bbd2e2dd74847ba6b5bd29cd0b2e3ea2ec58049b57eb2eda12  /tmp/s6-overlay-noarch.tar.xz" | sha256sum -c -; \
    curl -fsSL -o "/tmp/s6-overlay-${s6arch}.tar.xz" "${base}/s6-overlay-${s6arch}.tar.xz"; \
    echo "${sum}  /tmp/s6-overlay-${s6arch}.tar.xz" | sha256sum -c -; \
    tar -C / -Jxpf /tmp/s6-overlay-noarch.tar.xz; \
    tar -C / -Jxpf "/tmp/s6-overlay-${s6arch}.tar.xz"; \
    rm -f /tmp/s6-overlay-*.tar.xz

# Fixed unprivileged identities. Asterisk runs as asterisk:pbx and the API as pbx:pbx.
RUN groupadd --gid 1001 pbx \
    && useradd --uid 1001 --gid pbx --no-create-home --home-dir /data --shell /usr/sbin/nologin pbx \
    && useradd --uid 1002 --gid pbx --no-create-home --home-dir /data --shell /usr/sbin/nologin asterisk

# Asterisk binary, modules, built-in data, and the separately downloaded sound packs. The
# builder's /var/lib/asterisk contains the XML documentation, static-http assets, and other
# data files that core modules need; the sounds stage only overlays sounds and MOH.
COPY --from=asterisk-builder /out/usr /usr
COPY --from=asterisk-builder /out/var/lib/asterisk /var/lib/asterisk
COPY --from=sounds /out/var/lib/asterisk /var/lib/asterisk

COPY docker/asterisk/config /opt/better-pbx/bootstrap/asterisk
COPY docker/bootstrap/pbx.yaml /opt/better-pbx/bootstrap/pbx.yaml
COPY docker/s6/s6-rc.d /etc/s6-overlay/s6-rc.d
COPY docker/s6/user-bundles.d /etc/s6-overlay/user-bundles.d
COPY docker/fail2ban /etc/fail2ban
COPY docker/scripts/pbx-ban /usr/local/bin/pbx-ban
COPY docker/scripts/healthcheck.mjs /opt/better-pbx/healthcheck.mjs

COPY --from=api-builder /out /opt/better-pbx/api

RUN set -eux; \
    chmod 0755 \
        /etc/s6-overlay/s6-rc.d/init-pbx/up.sh \
        /etc/s6-overlay/s6-rc.d/asterisk/run \
        /etc/s6-overlay/s6-rc.d/api/run \
        /etc/s6-overlay/s6-rc.d/fail2ban/run \
        /usr/local/bin/pbx-ban \
        /opt/better-pbx/healthcheck.mjs; \
    chown -R root:root /var/lib/asterisk/sounds /var/lib/asterisk/moh; \
    chmod -R a+rX,go-w /var/lib/asterisk/sounds /var/lib/asterisk/moh; \
    install -d -m 0750 -o asterisk -g pbx /var/cache/asterisk; \
    ldconfig; \
    if ldd /usr/sbin/asterisk | grep -q 'not found'; then \
        echo 'missing shared libraries for the Asterisk binary' >&2; \
        ldd /usr/sbin/asterisk >&2; \
        exit 1; \
    fi; \
    if find /usr/lib/asterisk/modules -name '*.so' -exec ldd {} + 2>/dev/null | grep -q 'not found'; then \
        echo 'missing shared libraries for one or more Asterisk modules' >&2; \
        find /usr/lib/asterisk/modules -name '*.so' -exec ldd {} + 2>/dev/null | grep -B1 'not found' >&2; \
        exit 1; \
    fi

# Persistent state. /data is the only writable persistent volume; init-pbx prepares it.
VOLUME ["/data"]

# Telephony ports and the local API. AMI (5038), ARI, and Asterisk HTTP (8088) are not exposed
# or enabled.
EXPOSE 5060/udp 5061/tcp 8080/tcp 10000-20000/udp

HEALTHCHECK --interval=15s --timeout=10s --start-period=90s --retries=5 \
    CMD ["/usr/local/bin/node", "/opt/better-pbx/healthcheck.mjs"]

ENTRYPOINT ["/init"]
