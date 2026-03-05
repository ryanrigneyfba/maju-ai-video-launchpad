FROM node:20-slim

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy server dependencies first (better layer caching)
COPY server/package*.json ./server/
RUN cd server && npm ci --production

# Copy full project (server + frontend)
COPY . .

# Create directories
RUN mkdir -p server/uploads server/output

EXPOSE 3001

WORKDIR /app/server
CMD ["node", "index.js"]
