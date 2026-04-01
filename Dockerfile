# Step 1: Build the application
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependencies manifest
COPY package*.json ./

# Install ALL dependencies (including devDependencies like nest-cli)
RUN npm install

# Copy source code
COPY . .

# Build the production-ready code
RUN npm run build

# Step 2: Run the application
FROM node:18-alpine AS runner

WORKDIR /app

# Copy dependencies manifest for production installation
COPY package*.json ./

# Install only production dependencies
RUN npm install --production

# Copy the compiled output from the builder stage
COPY --from=builder /app/dist ./dist

# Expose the application port
EXPOSE 8080

# Start the application using the production script
CMD ["npm", "run", "start:prod"]
