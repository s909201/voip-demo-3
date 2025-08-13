# VoIP Demo - 安心聊

這是一個使用 WebRTC、WebSocket 和 Node.js 建立的點對點 (P2P) 語音通話應用程式。專案包含一個後端訊號伺服器和一個前端 React 應用程式。

## 功能特色

-   即時語音通話
-   使用者上線狀態列表
-   透過 STUN/TURN 伺服器進行 NAT 穿透，支援複雜網路環境
-   通話錄音與歷史紀錄查詢 (開發中)

## 技術棧

-   **前端**: React, TypeScript, Vite, Tailwind CSS
-   **後端**: Node.js, Express, WebSocket (`ws` library), SQLite
-   **核心技術**: WebRTC
-   **容器化**: Docker, Docker Compose

---

## 使用 Docker 部署 (建議方式)

這是在任何支援 Docker 的環境中部署此專案最簡單、最一致的方法。

### 1. 環境準備

-   **Docker**: [安裝 Docker Desktop](https://www.docker.com/products/docker-desktop/) 或 Docker Engine。
-   **Docker Compose**: 通常已包含在 Docker Desktop 中。
-   **Git**: 用於複製專案。

### 2. 複製專案並啟動

在您的終端機中執行以下指令：

```bash
# 複製專案
git clone https://github.com/s909201/voip-demo-3.git
cd voip-demo-3

# 使用 Docker Compose 建置並啟動所有服務
# --build 旗標會確保在首次啟動時建置映像
docker-compose up --build
```

### 3. 開始使用

啟動完成後：
1.  在您的瀏覽器中開啟 `http://localhost`。
2.  前端應用程式將會載入，並自動連線到在容器中運行的後端服務。
3.  您可以在另一台電腦或手機的瀏覽器上，透過執行 Docker 的電腦的區域網路 IP (例如 `http://192.168.0.75`) 來存取服務，進行通話測試。

### 4. 停止服務

若要停止所有服務，請在同一個終端機視窗中按下 `Ctrl + C`，或開啟新的終端機視窗並在專案根目錄下執行：

```bash
docker-compose down
```

---

## 手動部署

請遵循以下步驟在新電腦上設定並啟動此專案。

### 1. 環境準備

在開始之前，請確保您的電腦上已安裝以下軟體：

-   **Node.js**: 建議使用 v18 或更高版本。
-   **Git**: 用於從儲存庫複製專案。
-   **OpenSSL**: 用於產生本地開發所需的 SSL 憑證。
    -   Windows: 通常內建於 Git Bash 中。
    -   macOS/Linux: 通常已內建。

### 2. 複製專案

開啟您的終端機，並執行以下指令：

```bash
git clone https://github.com/s909201/voip-demo-3.git
cd voip-demo-3
```

### 3. 產生 SSL 憑證

**重要：** 由於 WebRTC 需要 HTTPS 環境才能存取麥克風，因此前端和後端都必須使用 SSL 憑證。

請在終端機中，進入 `server-ui-demo` 目錄並執行以下 `openssl` 指令來產生包含正確 IP 地址的 SSL 憑證：

```bash
cd server-ui-demo

# 刪除舊的憑證檔案（如果存在）
rm -f cert.pem cert-key.pem

# 產生新的 SSL 憑證，包含本機和區域網路 IP
openssl req -x509 -newkey rsa:4096 -keyout cert-key.pem -out cert.pem -days 365 -nodes \
  -subj "/C=TW/ST=Taiwan/L=Taipei/O=VoIP Demo/OU=IT Department/CN=192.168.0.75" \
  -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1,IP:192.168.0.75,IP:192.168.248.1,IP:192.168.253.1,IP:172.20.80.1"
```

**Windows PowerShell 用戶請使用：**
```powershell
cd server-ui-demo

# 刪除舊的憑證檔案（如果存在）
Remove-Item cert.pem, cert-key.pem -Force -ErrorAction SilentlyContinue

# 產生新的 SSL 憑證
openssl req -x509 -newkey rsa:4096 -keyout cert-key.pem -out cert.pem -days 365 -nodes -subj "/C=TW/ST=Taiwan/L=Taipei/O=VoIP Demo/OU=IT Department/CN=192.168.0.75" -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1,IP:192.168.0.75,IP:192.168.248.1,IP:192.168.253.1,IP:172.20.80.1"
```

這個指令會在 `server-ui-demo` 目錄下產生 `cert-key.pem` 和 `cert.pem` 兩個檔案。憑證包含了多個 IP 地址，確保在不同網路環境下都能正常工作。

### 4. 安裝依賴套件

專案分為前端和後端兩個部分，都需要安裝各自的依賴套件。

-   **安裝後端依賴套件：**
    ```bash
    cd server-ui-demo
    npm install
    ```

-   **安裝前端依賴套件：**
    ```bash
    cd ../voip-demo
    npm install
    ```

### 5. 初始化資料庫

`voip_demo.db` 資料庫檔案會在您首次啟動後端伺服器時，由程式自動建立。您不需要手動進行任何操作。

### 6. 啟動專案

您需要開啟**兩個**終端機視窗，一個用於啟動後端，另一個用於啟動前端。

-   **啟動後端伺服器：**
    ```bash
    cd server-ui-demo
    npm start
    ```
    您應該會看到以下訊息：
    ```
    伺服器正在 https://0.0.0.0:8443 上運行
    可透過以下網址存取:
      - https://localhost:8443
      - https://192.168.0.75:8443
    ```

-   **啟動前端開發伺服器：**
    ```bash
    cd voip-demo
    npm run dev
    ```
    您應該會看到 Vite 啟動的訊息，並提供一個本地網址和多個網路網址：
    ```
    ➜  Local:   https://localhost:5173/
    ➜  Network: https://192.168.0.75:5173/
    ➜  Network: https://192.168.248.1:5173/
    ```

### 7. 開始使用

1.  **接受 SSL 憑證：** 首次開啟時，瀏覽器會警告憑證不受信任（因為是自簽名憑證）。請點擊「進階」→「繼續前往資料」來接受憑證。

2.  **測試連線：**
    - 在您的 PC 瀏覽器上開啟 `https://localhost:5173/` 或 `https://192.168.0.75:5173/`
    - 在您的手機瀏覽器上開啟 `https://192.168.0.75:5173/`（使用您的實際 IP 地址）

3.  **開始通話：**
    - 在兩邊的頁面上分別輸入不同的使用者名稱並點擊「連線」
    - 連線成功後，您會在聯絡人列表中看到其他在線使用者
    - 選擇聯絡人並點擊「撥號」開始通話

## 故障排除

### SSL 憑證問題
如果遇到 WebSocket 連線失敗（`ERR_CERT_AUTHORITY_INVALID`），請確保：
1. 已正確產生 SSL 憑證
2. 前端和後端都重新啟動
3. 瀏覽器已接受自簽名憑證

### 網路連線問題
如果無法在不同設備間建立連線：
1. 確保所有設備都在同一個區域網路
2. 檢查防火牆設定，確保允許 8443 和 5173 端口
3. 確認 IP 地址是否正確

### 麥克風權限
如果無法存取麥克風：
1. 確保使用 HTTPS 連線（HTTP 無法存取麥克風）
2. 在瀏覽器中允許麥克風權限
3. 檢查系統麥克風設定

## 專案結構

```
voip-demo-3/
├── server-ui-demo/          # 後端伺服器
│   ├── server.js           # 主要伺服器檔案
│   ├── cert.pem            # SSL 憑證（需要產生）
│   ├── cert-key.pem        # SSL 私鑰（需要產生）
│   └── src/
│       └── database.js     # 資料庫設定
├── voip-demo/              # 前端應用程式
│   ├── src/
│   │   ├── views/
│   │   │   └── CallView.tsx    # 主要通話介面
│   │   ├── hooks/
│   │   │   └── useWebRTC.ts    # WebRTC 邏輯
│   │   └── services/
│   │       └── api.ts          # API 服務
│   └── vite.config.ts      # Vite 配置（包含 SSL 設定）
└── README.md
```

## 開發說明

- 前端使用 Vite 開發伺服器，支援熱重載
- 後端使用 Express 和 WebSocket 處理訊號交換
- WebRTC 使用 Google 的 STUN 伺服器和 OpenRelay 的 TURN 伺服器
- 資料庫使用 SQLite 儲存通話歷史記錄

## 授權

此專案僅供學習和開發用途。
