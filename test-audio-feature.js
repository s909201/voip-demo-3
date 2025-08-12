const https = require('https');
const fs = require('fs');

// 測試 API 端點
const testAPI = () => {
  const options = {
    hostname: '192.168.0.75',
    port: 8443,
    path: '/api/history',
    method: 'GET',
    rejectUnauthorized: false
  };

  const req = https.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('API Response Status:', res.statusCode);
      console.log('API Response:', JSON.parse(data));
    });
  });

  req.on('error', (e) => {
    console.error('API Request Error:', e);
  });

  req.end();
};

console.log('測試語音檔功能...');
console.log('1. 檢查 API 端點');
testAPI();

console.log('2. 檢查 uploads 目錄');
if (fs.existsSync('./server-ui-demo/uploads')) {
  const files = fs.readdirSync('./server-ui-demo/uploads');
  console.log('Uploads 目錄內容:', files);
} else {
  console.log('Uploads 目錄不存在');
}

console.log('3. 檢查伺服器是否運行');
const checkServer = () => {
  const options = {
    hostname: '192.168.0.75',
    port: 8443,
    path: '/',
    method: 'GET',
    rejectUnauthorized: false
  };

  const req = https.request(options, (res) => {
    console.log('伺服器狀態:', res.statusCode);
  });

  req.on('error', (e) => {
    console.error('伺服器連接錯誤:', e.message);
  });

  req.end();
};

checkServer();
