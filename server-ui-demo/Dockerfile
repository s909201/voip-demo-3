# 使用官方 Node.js 18 Alpine 映像作為基礎
FROM node:18-alpine

# 在容器中設定工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝後端依賴
RUN npm install

# 複製所有後端原始碼到工作目錄
COPY . .

# 開放後端服務所使用的連接埠
EXPOSE 3001

# 設定容器啟動時執行的指令
CMD ["node", "server.js"]
