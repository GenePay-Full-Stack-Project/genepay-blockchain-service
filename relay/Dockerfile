# Onchain Relay Service Dockerfile

FROM node:20-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -S nodeuser && adduser -S nodeuser -G nodeuser

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY index.js .
COPY test.js .

# Change ownership
RUN chown -R nodeuser:nodeuser /app
USER nodeuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run application
CMD ["node", "index.js"]
