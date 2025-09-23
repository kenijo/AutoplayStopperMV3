const fs = require('fs');

// Get today's date in YYYY.MM.DD format
const today = new Date();
const year = today.getFullYear();
const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are zero-based
const day = String(today.getDate()).padStart(2, '0');
const currentDate = `${year}.${month}.${day}`;

// Get the file path from command-line arguments
const filePath = 'manifest.json'; // The first argument after the script name

const searchStringPattern = /"version":\s*"\d{4}\.\d{2}\.\d{2}"/; // Regex to match any date in "version": "YYYY.MM.DD" format
const replaceString = `"version": "${currentDate}"`; // Use today's date

fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
        console.error('File not found:', err);
        return;
    }
    const result = data.replace(searchStringPattern, replaceString);
    fs.writeFile(filePath, result, 'utf8', (err) => {
        if (err) {
            console.error('Error writing file:', err);
        } else {
            console.log('String replaced successfully with date:', currentDate);
        }
    });
});
