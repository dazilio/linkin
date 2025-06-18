const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function getLinkedInCookies(email, password) {

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle2' });

  await page.type('#username', email, { delay: 50 });
  await page.type('#password', password, { delay: 50 });

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
  ]);

  try {
    await page.waitForFunction(
      () => window.location.href.includes('/feed') || window.location.href.includes('/in/'),
      { timeout: 0 }
    );
  } catch (err) {
    console.error('❌ Login likely failed or was interrupted.');
    await browser.close();
    return;
  }

  const cookies = await page.cookies();
  await browser.close();
	console.log(cookies);
  return cookies;
}

module.exports = getLinkedInCookies;
