const express = require('express');
const scrapeLinkedInProfile = require('./scraper');
require('dotenv').config();
const getLinkedInCookies = require('./login');

const app = express();
const PORT = process.env.PORT || 3000;
const email = process.env.LINKEDIN_EMAIL;
const password = process.env.LINKEDIN_PASS;
const cookieUrl = process.env.COOKIE_PROXY;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.get('/cookies', async (req, res) => {
  try {


    const cookies = await getLinkedInCookies(email, password);

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(cookies, null, 2));
  } catch (err) {
    console.error('Error getting cookies:', err.message);
    res.status(500).json({ error: 'Login failed or cookies could not be retrieved' });
  }
});

app.get('/scrape', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Profile URL required.' });
  }

  try {
    const data = await scrapeLinkedInProfile(url,cookieUrl);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Scrape error:', err);
    return res.status(500).json({ error: 'Failed to scrape profile' });
  }
});
app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
});