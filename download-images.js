const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const BASE_URL = 'https://gamersgripbd.com';

const products = [
  {
    "deviceName": "8BitDo Ultimate 2c",
    "model": "8BitDo Ultimate 2c",
    "imageUrls": [
      "/assets/products/n-ultimate2c-c.png"
    ]
  },
  {
    "deviceName": "GameSir G7 Pro 8K PC Phantom Blade Zero Limited Edition",
    "model": "GameSir G7 Pro 8K PC × Phantom Blade Zero | Limited Edition",
    "imageUrls": [
      "https://ztiviynhnrtjhsdihskv.supabase.co/storage/v1/object/public/products/8d3e2195-9abc-4271-a8e4-dd686d561b48-1794722494205.webp"
    ]
  },
  {
    "deviceName": "Flydigi Apex 6 Pro",
    "model": "Flydigi Apex 6 Pro",
    "imageUrls": [
      "https://ztiviynhnrtjhsdihskv.supabase.co/storage/v1/object/public/products/fe46528e-7fdf-4fc7-8e73-a2cd70240325-1790449980588.webp"
    ]
  },
  {
    "deviceName": "Flydigi Apex 6 Pro Shadow Blade Zero Limited Edition",
    "model": "Flydigi Apex 6 Pro Shadow Blade Zero Limited Edition",
    "imageUrls": [
      "https://ztiviynhnrtjhsdihskv.supabase.co/storage/v1/object/public/products/6b1d8dbf-bd08-417a-83bc-ca4087954b40-1790450002894.webp"
    ]
  },
  {
    "deviceName": "GameSir Cyclone 2",
    "model": "GameSir Cyclone 2",
    "imageUrls": [
      "/assets/products/image2.png",
      "/assets/products/n-cyclone2-white-v2.png"
    ]
  },
  {
    "deviceName": "GameSir G7 pro",
    "model": "GameSir G7 pro",
    "imageUrls": [
      "/assets/products/n-g7pro-black-v2.png",
      "/assets/products/n-g7pro-white-c.png"
    ]
  },
  {
    "deviceName": "GameSir G7 pro Wuchang Limited edition",
    "model": "GameSir G7 pro Wuchang Limited edition",
    "imageUrls": [
      "/assets/products/n-g7pro-wuchang-c.png"
    ]
  },
  {
    "deviceName": "GameSir Nova 2 lite",
    "model": "GameSir Nova 2 lite",
    "imageUrls": [
      "/assets/products/n-nova2lite-c.png"
    ]
  },
  {
    "deviceName": "GameSir G7 Pro 8k PC Black Edition",
    "model": "GameSir G7 Pro 8k PC Black Edition",
    "imageUrls": [
      "/assets/products/image5.png"
    ]
  },
  {
    "deviceName": "GameSir G7 pro 8k pc Aimlabs edition",
    "model": "GameSir G7 pro 8k pc Aimlabs edition",
    "imageUrls": [
      "/assets/products/image6.png"
    ]
  },
  {
    "deviceName": "GameSir Tarantula 8k pc",
    "model": "GameSir Tarantula 8k pc",
    "imageUrls": [
      "/assets/products/image7.png"
    ]
  },
  {
    "deviceName": "Flydigi Vader 5 pro",
    "model": "Flydigi Vader 5 pro",
    "imageUrls": [
      "/assets/products/n-vader5pro-c.png"
    ]
  },
  {
    "deviceName": "Flydigi Vader 5 pro with Dock",
    "model": "Flydigi Vader 5 pro with Dock",
    "imageUrls": [
      "/assets/products/n-vader5dock-c.png"
    ]
  },
  {
    "deviceName": "Flydigi Apex 5 With Dock",
    "model": "Flydigi Apex 5 With Dock",
    "imageUrls": [
      "/assets/products/n-apex5dock-c.png"
    ]
  },
  {
    "deviceName": "Flydigi Apex 5",
    "model": "Flydigi Apex 5",
    "imageUrls": [
      "/assets/products/image10.png"
    ]
  },
  {
    "deviceName": "Flydigi Direwolf 4",
    "model": "Flydigi Direwolf 4",
    "imageUrls": [
      "/assets/products/n-direwolf4-c.png"
    ]
  },
  {
    "deviceName": "Flydigi Dock 2 Pro",
    "model": "Dock 2 Pro",
    "imageUrls": [
      "/assets/products/n-dock2pro-c.png",
      "/assets/products/n-dock2-white-c.png"
    ]
  },
  {
    "deviceName": "EasySMX XO5 Pro",
    "model": "EasySMX XO5 Pro",
    "imageUrls": [
      "/assets/products/n-xo5pro-c.png",
      "/assets/products/n-xo5-purple-c.png",
      "/assets/products/n-xo5-white-c.png"
    ]
  },
  {
    "deviceName": "EasySMX D10",
    "model": "EasySMX D10",
    "imageUrls": [
      "/assets/products/n-d10-c.png",
      "/assets/products/n-d10-purple-c.png",
      "/assets/products/n-d10-green-c.png"
    ]
  },
  {
    "deviceName": "Flydigi BS2 Pro",
    "model": "Flydigi BS2 Pro",
    "imageUrls": [
      "/assets/products/n-bs2pro-v2.png"
    ]
  },
  {
    "deviceName": "Flydigi BS3 Pro",
    "model": "Flydigi BS3 Pro",
    "imageUrls": [
      "/assets/products/n-bs3pro-c.png"
    ]
  },
  {
    "deviceName": "8BitDo Ultimate 2",
    "model": "8BitDo Ultimate 2",
    "imageUrls": [
      "/assets/products/n-ultimate2-c.png",
      "/assets/products/n-u2-white-c.png",
      "/assets/products/n-u2-purple-c.png"
    ]
  }
];

function sanitizeFolderName(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

function getFullUrl(imageUrl) {
  if (imageUrl.startsWith('http')) {
    return imageUrl;
  }
  return BASE_URL + imageUrl;
}

function getExtension(url) {
  const pathname = new URL(url).pathname;
  const ext = path.extname(pathname).split('?')[0];
  return ext || '.png';
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const request = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      const file = fs.createWriteStream(destPath);
      response.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
      file.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });
    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

async function downloadAllImages() {
  const baseDir = path.join(__dirname, 'product_images');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  let totalDownloaded = 0;
  let totalFailed = 0;

  for (const product of products) {
    const folderName = sanitizeFolderName(product.deviceName);
    const productDir = path.join(baseDir, folderName);
    
    if (!fs.existsSync(productDir)) {
      fs.mkdirSync(productDir, { recursive: true });
    }

    console.log(`\n📦 ${product.deviceName} (${product.imageUrls.length} images)`);

    for (let i = 0; i < product.imageUrls.length; i++) {
      const imageUrl = product.imageUrls[i];
      const fullUrl = getFullUrl(imageUrl);
      const ext = getExtension(fullUrl);
      const fileName = `${String(i + 1).padStart(2, '0')}_angle${ext}`;
      const destPath = path.join(productDir, fileName);

      try {
        await downloadFile(fullUrl, destPath);
        console.log(`  ✅ ${fileName}`);
        totalDownloaded++;
      } catch (err) {
        console.log(`  ❌ ${fileName} - ${err.message}`);
        totalFailed++;
      }

      // Small delay to be respectful
      await new Promise(r => setTimeout(r, 200));
    }
  }

  console.log(`\n📊 Summary: ${totalDownloaded} downloaded, ${totalFailed} failed`);
  console.log(`📁 Images saved to: ${baseDir}`);
}

downloadAllImages().catch(console.error);