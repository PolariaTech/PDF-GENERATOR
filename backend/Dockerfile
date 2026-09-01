# Imagen oficial de Playwright, version fijada exacta a la que ya resuelve
# package-lock.json (1.61.0) -- ya trae Chromium y TODAS sus dependencias de
# sistema instaladas y probadas por Microsoft. Reemplaza el build via Nixpacks
# (Root Directory de este servicio en Railway: /backend): Nixpacks detecta
# "playwright" en package.json e inyecta su propia lista hardcodeada de
# paquetes apt para Chromium, desactualizada para Debian trixie (rompia el
# build con "E: Unable to locate package libllvm15") y sin forma confiable de
# corregirla desde afuera (un nixpacks.toml con [phases.setup] aptPkgs = []
# no tuvo ningun efecto). Este Dockerfile evita ese problema de raiz.
FROM mcr.microsoft.com/playwright:v1.61.0-noble

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
CMD ["npm", "start"]
