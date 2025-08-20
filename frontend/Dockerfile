# Stage 1: Build the React application
FROM node:20-alpine AS build

WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Set the WebSocket URL from build argument
ARG VITE_API_URL=ws://localhost:8000/ws
ENV VITE_API_URL=$VITE_API_URL

# Build the project
RUN npm run build

# Stage 2: Serve the static files with Caddy
FROM caddy:2.8-alpine

WORKDIR /usr/share/caddy

# Remove the default Caddyfile
RUN rm -f /etc/caddy/Caddyfile

# Copy the built assets from the build stage
COPY --from=build /app/dist /usr/share/caddy

# Copy our Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile

# Expose the port Caddy will listen on
EXPOSE 5173
