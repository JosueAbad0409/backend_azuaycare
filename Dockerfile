# Usamos una versión ligera de Node (coincide con la versión que usa Render)
FROM node:24-alpine

# 🔥 1. INSTALAMOS CHROMIUM Y SUS DEPENDENCIAS PARA ALPINE
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# 🔥 2. EVITAMOS QUE PUPPETEER DESCARGUE SU PROPIO CHROME PESADO
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Creamos el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos los archivos de dependencias
COPY package*.json ./

# Instalamos todas las dependencias
RUN npm install

# Copiamos el resto del código del proyecto
COPY . .

# Compilamos el proyecto de TypeScript a JavaScript
RUN npm run build

# Exponemos el puerto que usa nuestra app
EXPOSE 3000

# Comando para iniciar la aplicación en producción
CMD ["npm", "run", "start:prod"]