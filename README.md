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

---

## 在新環境中部署

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

後端伺服器和 Vite 開發伺服器都需要 HTTPS 才能讓 WebRTC 正常運作。由於憑證檔案 (`.pem`) 已被 `.gitignore` 排除，您需要手動產生它們。

請在終端機中，進入 `server-ui-demo` 目錄並執行以下 `openssl` 指令：

```bash
cd server-ui-demo

openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' \
  -keyout cert-key.pem -out cert.pem
```

這個指令會在 `server-ui-demo` 目錄下產生 `cert-key.pem` 和 `cert.pem` 兩個檔案。在執行過程中，您不需要輸入任何額外資訊。

*(註：`localhost-key.pem` 和 `localhost.pem` 是舊的憑證檔案，目前專案已不再使用，您可以忽略它們。)*

### 4. 安裝依賴套件

專案分為前端和後端兩個部分，都需要安裝各自的依賴套件。

-   **安裝後端依賴套件 (在專案根目錄執行):**
    ```bash
    npm install --prefix server-ui-demo
    ```

-   **安裝前端依賴套件 (在專案根目錄執行):**
    ```bash
    npm install --prefix voip-demo
    ```

### 5. 初始化資料庫

`voip_demo.db` 資料庫檔案會在您首次啟動後端伺服器時，由程式自動建立。您不需要手動進行任何操作。

### 6. 啟動專案

您需要開啟**兩個**終端機視窗，一個用於啟動後端，另一個用於啟動前端。

-   **啟動後端伺服器 (在專案根目錄執行):**
    ```bash
    npm run dev --prefix server-ui-demo
    ```
    您應該會看到 `伺服器正在 https://localhost:8443 上運行` 的訊息。

-   **啟動前端開發伺服器 (在專案根目錄執行):**
    ```bash
    npm run dev --prefix voip-demo
    ```
    您應該會看到 Vite 啟動的訊息，並提供一個本地網址 (如 `https://localhost:5173/`) 和一個網路網址 (如 `https://192.168.x.x:5173/`)。

### 7. 開始使用

1.  在您的 PC 瀏覽器上開啟 Vite 提供的**本地網址** (例如 `https://localhost:5173/`)。
2.  在您的手機瀏覽器上，開啟 Vite 提供的**網路網址** (例如 `https://192.168.x.x:5173/`)。
3.  首次開啟時，瀏覽器可能會警告憑證不受信任，請選擇「繼續前往」或「信任此憑證」。
4.  在兩邊的頁面上分別輸入不同的使用者名稱並連線，即可開始測試通話。
