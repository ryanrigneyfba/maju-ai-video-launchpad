FROM node:20-slim

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy frontend files
COPY index.html ./
COPY backend-url.json* ./
COPY css/ ./css/
COPY js/ ./js/

# Copy server files, install dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --production
COPY server/*.js ./server/

# Create directories
RUN mkdir -p server/uploads server/output

EXPOSE 3001

WORKDIR /app/server
CMD ["node", "index.js"]
