/**
 * Playwright test script for Leo Vibe Maps extension
 * 
 * Usage: node test-extension.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function testExtension() {
  const extensionPath = __dirname;
  const userDataDir = path.join(__dirname, '.playwright-user-data');
  
  // Clean up old user data
  if (fs.existsSync(userDataDir)) {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
  
  console.log('🚀 Launching Chrome with Leo Vibe Maps extension...');
  console.log(`📁 Extension path: ${extensionPath}`);
  console.log(`📁 User data dir: ${userDataDir}`);

  try {
    // Launch browser with extension using Chrome channel
    const browser = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chrome',  // Use real Chrome, not Chromium
      headless: false,  // Must be false to load extensions
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
      viewport: { width: 1400, height: 900 },
      slowMo: 50,
    });

    console.log('✅ Browser launched successfully');

    // Get the first page or create one
    let page = browser.pages()[0];
    if (!page) {
      page = await browser.newPage();
    }

    // Listen to console logs from page
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Leo') || text.includes('🌈') || text.includes('🗺') || 
          text.includes('heatmap') || text.includes('✅') || text.includes('❌')) {
        console.log(`   [Page] ${text}`);
      }
    });

    console.log('🌐 Navigating to Airbnb Barcelona...');
    
    // Navigate to Airbnb Barcelona search
    await page.goto('https://www.airbnb.com/s/Barcelona--Spain/homes', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    console.log('⏳ Waiting for page to stabilize...');
    await page.waitForTimeout(5000);

    // Handle cookie consent if it appears
    try {
      const acceptBtn = await page.$('button:has-text("Accept")');
      if (acceptBtn) {
        console.log('🍪 Accepting cookies...');
        await acceptBtn.click();
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      // No cookie dialog
    }

    // Wait for Google Maps
    console.log('⏳ Looking for Google Maps...');
    try {
      await page.waitForSelector('.gm-style', { timeout: 20000 });
      console.log('✅ Google Maps detected!');
    } catch (e) {
      console.log('⚠️ Google Maps not found immediately, waiting more...');
      await page.waitForTimeout(5000);
    }

    // Take screenshot
    console.log('📸 Taking screenshot...');
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', 'airbnb-with-extension.png'),
      fullPage: false 
    });
    console.log('✅ Screenshot saved to screenshots/airbnb-with-extension.png');

    // Wait for content script to inject
    console.log('⏳ Waiting for heatmap injection (10 seconds)...');
    await page.waitForTimeout(10000);

    // Take another screenshot
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', 'airbnb-after-injection.png'),
      fullPage: false 
    });
    console.log('✅ Screenshot saved to screenshots/airbnb-after-injection.png');

    // Check extension popup
    console.log('\n📊 Extension Status:');
    
    // Evaluate in page context to check for heatmap
    const hasGMStyle = await page.evaluate(() => {
      return document.querySelectorAll('.gm-style').length;
    });
    console.log(`   - Google Maps elements found: ${hasGMStyle}`);

    // Keep browser open
    console.log('\n✨ Test complete!');
    console.log('🔍 Browser will stay open for 60 seconds for inspection.');
    console.log('   - Check the map on the right side of the Airbnb page');
    console.log('   - The heatmap should appear UNDER the price pins');
    console.log('   - Click the extension icon in Chrome toolbar to change vibes\n');

    await page.waitForTimeout(60000);

    await browser.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Create screenshots directory
if (!fs.existsSync(path.join(__dirname, 'screenshots'))) {
  fs.mkdirSync(path.join(__dirname, 'screenshots'));
}

// Run
testExtension();
