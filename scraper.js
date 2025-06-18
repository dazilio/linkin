const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

async function autoScroll(page) {
  try {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 1000;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
  } catch (err) {
    console.warn('⚠️ AutoScroll error, possibly due to navigation:', err.message);
  }
}

async function scrapeLinkedInProfile(profileUrl) {
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      defaultViewport: null,
		  args: [
			'--no-sandbox',
			'--disable-setuid-sandbox'
		  ]
    });

    const page = await browser.newPage();

// Load cookies from cookie-proxy-server (http://localhost:3012/cookies)
try {
  const res = await fetch('http://host.docker.internal:3012/cookies');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  
  const cookies = await res.json();
  await page.setCookie(...cookies);
  console.log('✅ Cookies loaded and set in browser');
} catch (err) {
  console.warn('⚠️ Failed to fetch cookies from proxy server:', err.message);
}


    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    console.log('Visited:', page.url());

    if (page.url().includes('login')) {
      throw new Error('❌ Not logged in. Your cookies may be expired or invalid.');
    }

    await autoScroll(page);

    const profileData = await page.evaluate(() => {
      const getText = (selector) =>
        document.querySelector(selector)?.innerText?.trim() || null;
      const cleanText = (str) =>
        str?.replace(/\n+/g, ' ').replace(/\s+/g, ' ').replace(/,+$/, '').trim() || null;

      const about = (() => {
        const sections = Array.from(document.querySelectorAll('section'));
        const aboutSection = sections.find(section =>
          section.innerText?.trim().startsWith('About') ||
          section.innerText?.trim().startsWith('Tentang')
        );
        if (!aboutSection) return null;

        const spans = aboutSection.querySelectorAll('span[aria-hidden="true"]');
        for (const span of spans) {
          const text = span.innerText?.trim();
          if (text && text.length > 30 && !['About', 'Tentang'].includes(text)) {
            return cleanText(text);
          }
        }

        return null;
      })();

      const parseExperience = () => {
        const items = [];
        const section = document.querySelector('#experience')?.parentElement;
        if (!section) return [];

        const positions = section.querySelectorAll('li.artdeco-list__item');
        positions.forEach((item) => {
          const jobBlocks = item.querySelectorAll('.pvs-entity');
          if (jobBlocks.length > 1) {
            jobBlocks.forEach((block) => {
              const title = cleanText(block.querySelector('.t-bold span[aria-hidden="true"]')?.innerText);
              const spans = block.querySelectorAll('.t-14.t-normal.t-black--light span[aria-hidden="true"]');
              const dateRange = cleanText(spans[0]?.innerText || '');
              const location = cleanText(spans[1]?.innerText || '');
              const parentCompany = cleanText(item.querySelector('span.t-14.t-normal span[aria-hidden="true"]')?.innerText);
              if (title || parentCompany) {
                items.push({ title, company: parentCompany, type: '', dateRange, location });
              }
            });
          } else {
            const title = cleanText(item.querySelector('.t-bold span[aria-hidden="true"]')?.innerText);
            const companyRaw = cleanText(item.querySelector('.t-14.t-normal span[aria-hidden="true"]')?.innerText);
            const spans = item.querySelectorAll('.t-14.t-normal.t-black--light span[aria-hidden="true"]');
            const dateRange = cleanText(spans[0]?.innerText || '');
            const location = cleanText(spans[1]?.innerText || '');

            let company = '', type = '';
            if (companyRaw?.includes('·')) {
              [company, type] = companyRaw.split('·').map(s => s.trim());
            } else {
              company = companyRaw;
            }

            if (title || company) {
              items.push({ title, company, type, dateRange, location });
            }
          }
        });

        return items;
      };

      const parseEducation = () => {
        const items = [];
        const section = document.querySelector('#education')?.parentElement;
        if (!section) return [];

        const rows = section.querySelectorAll('li.artdeco-list__item');
        rows.forEach((li) => {
          const school = cleanText(li.querySelector('span[aria-hidden="true"]')?.innerText);
          const degree = cleanText(li.querySelector('.t-14.t-normal')?.innerText);
          if (school || degree) items.push({ school, degree });
        });

        return items;
      };

      const findSectionItems = labelRegex => {
        const section = Array.from(document.querySelectorAll('section'))
          .find(s => labelRegex.test(s.innerText));
        return section
          ? Array.from(section.querySelectorAll('span[aria-hidden="true"]'))
              .map(el => el.innerText.trim())
              .filter(txt => txt.length > 2 && !labelRegex.test(txt))
          : [];
      };

      const profilePicture = document.querySelector('.pv-top-card__photo img')?.src;

      return {
        name: cleanText(getText('h1')),
        headline: cleanText(getText('.text-body-medium.break-words')),
        location: cleanText(getText('.text-body-small.inline.t-black--light.break-words')),
        about,
        profilePicture,
        experience: parseExperience(),
        education: parseEducation(),
        certifications: findSectionItems(/Certification|Sertifikasi/i),
        projects: findSectionItems(/Project|Proyek/i),
      };
    });

    // Grab skills
    let skills = [];
    try {
      const skillsUrl = profileUrl.replace(/\/in\/([^/]+)\/?$/, '/in/$1/details/skills/');
      await page.goto(skillsUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await autoScroll(page);

      skills = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.pvs-list__item--line-separated .t-bold span'))
          .map(span => span?.textContent?.trim())
          .filter(Boolean);
      });

      skills = Array.from(new Set(skills)); // remove duplicates
    } catch (err) {
      console.warn('⚠️ Could not load skills section:', err.message);
    }

    await browser.close();
    return { ...profileData, skills };

  } catch (err) {
    console.error('🔥 Fatal scrape error:', err);
    throw err;
  }
}

module.exports = scrapeLinkedInProfile;
