# --- 第一階段: 建置階段 ---
FROM node:18-alpine AS build

# 設定工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝依賴
RUN npm install

# 複製所有前端原始碼
COPY . .

# 執行建置
RUN npm run build

# --- 第二階段: 正式環境階段 ---
FROM nginx:stable-alpine

# 複製 Nginx 設定檔
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 從建置階段複製建置好的靜態檔案到 Nginx 的根目錄
COPY --from=build /app/dist /usr/share/nginx/html

# 開放 80 連接埠
EXPOSE 80

# 啟動 Nginx
CMD ["nginx", "-g", "daemon off;"]
