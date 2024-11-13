FROM node:20-alpine

ARG NEXT_PUBLIC_BACKEND_API
ENV NEXT_PUBLIC_BACKEND_API=$NEXT_PUBLIC_BACKEND_API

WORKDIR /app

COPY . .

RUN npm install
RUN npm run build

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

CMD ["npm", "start"]