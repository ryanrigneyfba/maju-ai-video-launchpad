FROM node:20-slim

# Install FFmpeg for video stitching
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm install && npm install better-sqlite3

# Copy everything
COPY . .

# Create required directories
RUN mkdir -p server/uploads server/output server/audio ig-research-agent/data

EXPOSE 3001

CMD ["node", "server/index.js"]
