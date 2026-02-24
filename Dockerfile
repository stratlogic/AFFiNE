# syntax=docker/dockerfile:1.7
FROM node:22-bookworm AS builder

# Install Rust for compiling @affine/server-native
RUN apt-get update && apt-get install -y curl build-essential && \
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /app

# Copy all files for building
COPY . .

# Setup Yarn architecture configs
RUN yarn config set --json supportedArchitectures.cpu '["x64", "arm64", "arm"]'
RUN yarn config set --json supportedArchitectures.libc '["glibc"]'

# Install dependencies
RUN yarn install

# Enforce stable build type so web/admin bundles generate the 'dist' correctly
ENV BUILD_TYPE=stable

# Build everything
RUN yarn affine @affine/web build
RUN yarn affine @affine/admin build
RUN yarn workspace @affine/server-native build

# Rename the compiled Rust binary to exactly what the backend expects
RUN cp ./packages/backend/native/server-native.node ./packages/backend/native/server-native.x64.node || true
RUN cp ./packages/backend/native/server-native.node ./packages/backend/native/server-native.arm64.node || true

RUN yarn workspace @affine/server build
RUN yarn workspace @affine/server prisma generate

# Create the final lean production image
FROM node:22-bookworm-slim
WORKDIR /app

# Copy the built backend
COPY --from=builder /app/packages/backend/server /app
# Copy the built frontend into static serving directories
COPY --from=builder /app/packages/frontend/apps/web/dist /app/static
COPY --from=builder /app/packages/frontend/admin/dist /app/static/admin

# Ensure the native bindings and node modules are kept
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/packages/backend/native /app/packages/backend/native

RUN apt-get update && \
  apt-get install -y --no-install-recommends openssl libjemalloc2 ca-certificates && \
  rm -rf /var/lib/apt/lists/*

ENV LD_PRELOAD=libjemalloc.so.2
EXPOSE 3010

CMD ["node", "./dist/main.js"]
