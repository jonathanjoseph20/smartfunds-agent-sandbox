FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
COPY apps ./apps
COPY packages ./packages
COPY control-plane ./control-plane
COPY tsconfig*.json ./

RUN npm ci --omit=optional

ENV HOST=127.0.0.1
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '3000') + '/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "service:start"]
