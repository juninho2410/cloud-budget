# Stage 1: Build the application
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies
# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./
# Install dependencies based on lock file
RUN npm install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Build the Next.js application
# Disable Genkit telemetry during build
ENV GENKIT_TELEMETRY_DISABLED=1
RUN npm run build

# Remove development dependencies after build
RUN npm prune --production

# Stage 2: Production image
FROM node:20-alpine AS runner

# Set working directory
WORKDIR /app

# Set NODE_ENV to production
ENV NODE_ENV=production

# Copy necessary files from the builder stage.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Switch to the non-root user node
USER node

# Expose the port the app runs on (default 3000 for Next.js)
EXPOSE 3000

# Set the default command to start the app
CMD ["node", "server.js"]
