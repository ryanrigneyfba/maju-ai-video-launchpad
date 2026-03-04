FROM node:20-slim

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy server files
COPY package*.json ./
RUN npm ci --production

COPY . .

# Create directories
RUN mkdir -p uploads output

EXPOSE 3001

CMD ["node", "index.js"]
