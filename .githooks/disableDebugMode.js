const fs = require('fs');

// Get the file path from command-line arguments
const filePath = 'src/content.js'; // The first argument after the script name

const searchStringPattern = "const DEBUG = false;";
const replaceString = "const DEBUG = true;";
const confirmation = "DEBUG Mode set to " + replaceString;

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
            console.log(confirmation);
        }
    });
});
