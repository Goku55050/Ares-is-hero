FROM node:18-bullseye-slim

# Install Python, FFmpeg, and curl
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install the absolute latest yt-dlp (crucial for bypassing detection)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Set up the app directory
WORKDIR /usr/src/app

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Copy all project files (including server.js and cookies.txt)
COPY . .

# Create the temporary music directory
RUN mkdir -p public/music

EXPOSE 3000

CMD ["npm", "start"]
