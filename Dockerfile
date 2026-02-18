# Use Node.js 20 Alpine for a lightweight image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy the rest of the source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Copy the generated Prisma client into dist/ so relative imports resolve correctly
RUN cp -r generated dist/

# Ensure the public static files directory exists
RUN mkdir -p dist/src/public

# Copy EJS views (TypeScript compiler doesn't copy non-TS files)
RUN cp -r src/views dist/src/views

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]
