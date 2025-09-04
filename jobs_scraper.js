
const { chromium } = require('playwright');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
require('dotenv').config();

const ACCOUNTS = [];
for (let i = 1; i <= 1; i++) {
    const email = process.env[`LINKEDIN_EMAIL_USER${i}`];
    const password = process.env[`LINKEDIN_PASSWORD_USER${i}`];
    if (email && password) {
        ACCOUNTS.push({ email, password });
    }
}


const JOB_KEYWORDS = "Node Js Developer";
const JOB_LOCATION = "Pune";
const MAX_PAGES_TO_SCRAPE = 5; 


const EXPERIENCE_LEVELS = ["Entry level", "Associate"]; 

const JOB_TYPES = ["Full-time"]; 

const DATE_POSTED = "Past 24 hours"; 
const OUTPUT_CSV_PATH = 'scraped_jobs.csv'; 

const JOB_LISTING_SELECTOR = 'div.job-card-container[data-job-id]'; 
const JOB_TITLE_SELECTOR = 'a.job-card-list__title--link'; 
const COMPANY_NAME_SELECTOR = 'div.artdeco-entity-lockup__subtitle'; 
const JOB_LOCATION_SELECTOR = 'ul.job-card-container__metadata-wrapper > li:first-child'; 
const EASY_APPLY_TAG_SELECTOR = 'li:has-text("Easy Apply")';
const NEXT_PAGE_BUTTON_SELECTOR = 'button[aria-label="View next page"]';

const JOB_DETAILS_PANE_SELECTOR = 'div.jobs-details__main-content';
const JOB_DESCRIPTION_SELECTOR = '#job-details';  
const JOB_CRITERIA_SELECTOR = 'ul.jobs-unified-top-card__job-insight > li:first-child'; 
const ACTIVELY_RECRUITING_SELECTOR = 'span.jobs-unified-top-card__subtitle-secondary-grouping > span';


function randomDelay(min = 2000, max = 5000) {
    const delay = Math.random() * (max - min) + min;
    console.log(`Pausing for ${Math.round(delay / 1000)}s...`);
    return new Promise(resolve => setTimeout(resolve, delay));
}

async function loginToLinkedIn(page, email, password) {
    console.log(`Navigating to LinkedIn login page for account: ${email}`);
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#username', { timeout: 30000 });
    console.log('Entering credentials...');
    await page.fill('#username', email);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/feed/', { timeout: 90000 });
    console.log('Login successful!');
}

 
async function searchForJobs(page) {
    console.log(`Searching for jobs with keywords: "${JOB_KEYWORDS}" in "${JOB_LOCATION}"`);

    const experienceMap = { "Internship": "1", "Entry level": "2", "Associate": "3", "Mid-Senior level": "4", "Director": "5", "Executive": "6" };
    const jobTypeMap = { "Full-time": "F", "Part-time": "P", "Contract": "C", "Temporary": "T", "Internship": "I" };
    const datePostedMap = { "Any time": "", "Past 24 hours": "r86400", "Past week": "r604800", "Past month": "r2592000" };

 
    let url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(JOB_KEYWORDS)}&location=${encodeURIComponent(JOB_LOCATION)}&origin=JOB_SEARCH_PAGE_SEARCH_BUTTON&refresh=true`;

    const f_E = EXPERIENCE_LEVELS.map(level => experienceMap[level]).filter(Boolean).join(',');
    if (f_E) url += `&f_E=${f_E}`;

    const f_JT = JOB_TYPES.map(type => jobTypeMap[type]).filter(Boolean).join(',');
    if (f_JT) url += `&f_JT=${f_JT}`;
    
    const f_TPR = datePostedMap[DATE_POSTED];
    if (f_TPR) url += `&f_TPR=${f_TPR}`;
    
    console.log("Constructed search URL with filters:", url);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('Waiting for job search results to load...');
    await page.waitForSelector(JOB_LISTING_SELECTOR, { timeout: 60000 });
    console.log('Job results loaded.');
    await randomDelay();
}


async function processJobListing(page, jobListing) {

    const titleLocator = jobListing.locator(JOB_TITLE_SELECTOR);
    try {
        await titleLocator.waitFor({ state: 'visible', timeout: 5000 });
    } catch (error) {
        console.warn(`      -> Skipping a card, as a job title was not found within 5 seconds. This could be an ad.`);
        return null;
    }


    const jobTitle = await titleLocator.innerText();
    const companyName = await jobListing.locator(COMPANY_NAME_SELECTOR).innerText();
    const jobLocation = await jobListing.locator(JOB_LOCATION_SELECTOR).innerText();
    const jobUrlHref = await jobListing.locator(JOB_TITLE_SELECTOR).getAttribute('href');
    const jobUrl = jobUrlHref.startsWith('http') ? jobUrlHref : `https://www.linkedin.com${jobUrlHref}`;
    const hasEasyApplyTag = await jobListing.locator(EASY_APPLY_TAG_SELECTOR).isVisible();

    console.log(`\n--- Processing: ${jobTitle.trim()} at ${companyName.trim()}`);

    let jobDescription = "N/A";
    let jobCriteria = "N/A";
    let activelyRecruiting = "N/A";

    try {
        await jobListing.click();
        await page.waitForSelector(JOB_DETAILS_PANE_SELECTOR, { state: 'visible', timeout: 10000 });
        await randomDelay(1000, 2000); 

        const descriptionElement = page.locator(JOB_DESCRIPTION_SELECTOR);
        if (await descriptionElement.isVisible({ timeout: 5000 })) {
            jobDescription = await descriptionElement.innerText();
        }

        const criteriaElement = page.locator(JOB_CRITERIA_SELECTOR);
        if (await criteriaElement.isVisible()) {
            jobCriteria = await criteriaElement.innerText();
        }

        const recruitingElement = page.locator(ACTIVELY_RECRUITING_SELECTOR);
        if (await recruitingElement.isVisible()) {
            activelyRecruiting = await recruitingElement.innerText();
        }

    } catch (error) {
        console.error(`      -> Could not extract detailed info: ${error.message.split('\n')[0]}`);
    }

    const jobData = {
        jobTitle: jobTitle.trim(),
        companyName: companyName.trim(),
        jobLocation: jobLocation.trim(),
        jobCriteria: jobCriteria.trim(),
        activelyRecruiting: activelyRecruiting.trim(),
        hasEasyApply: hasEasyApplyTag ? 'Yes' : 'No',
        jobUrl: jobUrl,
        jobDescription: jobDescription.trim().replace(/\s\s+/g, ' '), 
    };

    return jobData;
}


(async () => {
    if (ACCOUNTS.length === 0 || !ACCOUNTS[0].email) {
        console.error('No LinkedIn credentials found in .env file. Please check your configuration.');
        return;
    }

    const csvWriter = createObjectCsvWriter({
        path: OUTPUT_CSV_PATH,
        header: [
            { id: 'jobTitle', title: 'Job Title' },
            { id: 'companyName', title: 'Company Name' },
            { id: 'jobLocation', title: 'Location' },
            { id: 'jobCriteria', title: 'Experience & Job Type' },
            { id: 'activelyRecruiting', title: 'Recruiting Status' },
            { id: 'hasEasyApply', title: 'Easy Apply' },
            { id: 'jobUrl', title: 'Job URL' },
            { id: 'jobDescription', title: 'Job Description' },
        ],
    });

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    let jobsScrapedCount = 0;

    try {
        await loginToLinkedIn(page, ACCOUNTS[0].email, ACCOUNTS[0].password);
        await searchForJobs(page);

        for (let pageNum = 1; pageNum <= MAX_PAGES_TO_SCRAPE; pageNum++) {
            console.log(`\n--------------------------------------------------`);
            console.log(`Processing Page ${pageNum} of ${MAX_PAGES_TO_SCRAPE}...`);
            console.log(`--------------------------------------------------`);

            await page.waitForSelector(JOB_LISTING_SELECTOR, { timeout: 30000 });
            
            const jobListingsCount = await page.locator(JOB_LISTING_SELECTOR).count();
            console.log(`Found ${jobListingsCount} jobs on this page.`);

            for (let i = 0; i < jobListingsCount; i++) {
                const jobListing = page.locator(JOB_LISTING_SELECTOR).nth(i);
                const jobData = await processJobListing(page, jobListing);
                
           
                if (jobData) {
                    await csvWriter.writeRecords([jobData]);
                    console.log(`      -> Successfully written to ${OUTPUT_CSV_PATH}`);
                    jobsScrapedCount++;
                }
                await randomDelay(3000, 6000); 
            }

            if (pageNum < MAX_PAGES_TO_SCRAPE) {
                const nextPageButton = page.locator(NEXT_PAGE_BUTTON_SELECTOR);
                if (await nextPageButton.isVisible() && await nextPageButton.isEnabled()) {
                    console.log("\nNavigating to the next page...");
                    await nextPageButton.click();
                    await page.waitForLoadState('domcontentloaded');
                    await randomDelay();
                } else {
                    console.log("\nNo more pages to scrape. Ending process.");
                    break;
                }
            }
        }

    } catch (error) {
        console.error(`\nA critical error occurred: ${error.message}`);
    } finally {
    
        console.log('\n--------------------------------------------------');
        console.log(`Script finished. A total of ${jobsScrapedCount} jobs were written to ${OUTPUT_CSV_PATH}.`);
        console.log('Closing browser.');
        await browser.close();
    }
})();
