# LinkedIn Job Scraper

This Node.js script automates the process of logging into LinkedIn, searching for jobs based on your provided **keywords** and **location**, and exporting all job details into a CSV file.  

---

## Features
- Automated login to LinkedIn using **Playwright**
- Search jobs by **keyword** and **location**
- Extracts:
  - Job Title  
  - Company Name
  - Job Location
  - Job Criteria
  - Actively Recruiting
  - Job Url
  - Easy Apply (Yes/No)  
  - Job Description  
  - Posted Time  
- Exports results to a **CSV file**

---
<p align="center">
  <img src="https://img.shields.io/badge/Python-3.9+-blue.svg" alt="Python Version">
  <img src="https://img.shields.io/badge/Status-Active-brightgreen.svg" alt="Status">
</p>

## Installation

Make sure you have **Node.js (>=16)** installed.

```bash
# Clone this repository
git clone https://github.com/swapnil-jadhav-2608/JobsScraper.git

# Navigate to project folder
cd JobsScraper

# Install required packages
npm install playwright csv-writer dotenv

# Run
node jobs_scraper.js
