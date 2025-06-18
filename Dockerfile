# Use Puppeteer's official Docker image with Chromium included
FROM ghcr.io/puppeteer/puppeteer:latest

# Set working directory inside the container
WORKDIR /app
USER root
# Copy package files first to leverage Docker layer caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy all other source files
COPY . .

# Railway uses the PORT environment variable
ENV PORT=3000

# Expose port (Railway maps this automatically)
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
