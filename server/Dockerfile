FROM node:20-slim

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy frontend files
COPY index.html ./
COPY backend-url.json* ./
COPY css/ ./css/
COPY js/ ./js/

# Copy dashboard
COPY dashboard/ ./dashboard/

# Copy IG Research Agent (for database access)
COPY ig-research-agent/package*.json ./ig-research-agent/
COPY ig-research-agent/src/ ./ig-research-agent/src/
RUN mkdir -p ig-research-agent/data

# Copy server files, install dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --production && npm install better-sqlite3
COPY server/*.js ./server/

# Create directories
RUN mkdir -p server/uploads server/output server/audio

EXPOSE 3001

WORKDIR /app/server
CMD ["node", "index.js"]
