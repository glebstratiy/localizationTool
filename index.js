const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sftpClient = require('ssh2-sftp-client');
const {
    parseIOSLocalizationFile,
    parseAndroidLocalizationFile,
    parseWebLocalizationFile,
    parseDesktopLocalizationFile,
    compareLocalizations,
    saveDifferences
} = require('./utils/localization-utils');

const app = express();
const upload = multer({ dest: 'uploads/' });

// SFTP parameters
const sftpConfig = {
    host: 'files.traderevolution.com',
    port: '22',
    username: 'release',
    password: 'Wetfg#432!qd'
};

// Connecting to the SFTP server
const sftp = new sftpClient();

// Serving static files
app.use(express.static(path.join(__dirname, 'public')));

// Route for the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route for handling file comparison
app.post('/compare', upload.fields([{ name: 'previousFile' }, { name: 'currentFile' }]), async (req, res) => {
    const platform = req.body.platform;
    const previousVersion = req.body.previousVersion; // Example: 114
    const currentVersion = req.body.currentVersion;   // Example: 115
    const previousFilePath = req.files['previousFile'][0].path;
    const currentFilePath = req.files['currentFile'][0].path;

    let parseFunction;
    let savePath;

    switch (platform) {
        case 'ios':
            parseFunction = parseIOSLocalizationFile;
            savePath = path.join(__dirname, 'Localizable.strings');
            break;
        case 'android':
            parseFunction = parseAndroidLocalizationFile;
            savePath = path.join(__dirname, 'full_strings.xml');
            break;
        case 'web':
            parseFunction = parseWebLocalizationFile;
            savePath = path.join(__dirname, 'application_es_properties.js');
            break;
        case 'desktop':
            parseFunction = parseDesktopLocalizationFile;
            savePath = path.join(__dirname, 'application_en.properties');
            break;
        default:
            return res.status(400).send('Invalid platform.');
    }

    const previousLocalization = parseFunction(previousFilePath);
    const currentLocalization = parseFunction(currentFilePath);

    const differences = compareLocalizations(previousLocalization, currentLocalization, platform);

    // Creating a filename with the date and time
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    const differencesFilename = `${platform}_localization_diff${previousVersion}-${currentVersion}.json`;
    const differencesPath = path.join(__dirname, 'results', differencesFilename);

    // Saving comparison results to a file
    saveDifferences(differences, differencesPath);

    // Creating a folder on the server with version numbers
    const remoteDir = `/ftp/releases/te/localization_keys_diff/${previousVersion}-${currentVersion}`;

    try {
        // Connecting to SFTP and creating the directory if it doesn't exist
        await sftp.connect(sftpConfig);

        const remoteDirExists = await sftp.exists(remoteDir);
        if (!remoteDirExists) {
            await sftp.mkdir(remoteDir, true); // Create the directory with parent directories
        }

        // Uploading the file to the new directory on the server
        await sftp.put(differencesPath, `${remoteDir}/${differencesFilename}`);
        await sftp.end(); // Closing the SFTP connection
    } catch (err) {
        console.error('Error working with SFTP:', err);
        return res.status(500).send('Error uploading file to the server.');
    }

    // Sending the response with a download link
    res.json({
        message: 'The file is ready for download and uploaded to the server.',
        downloadLink: `/download/${differencesFilename}`,
        remotePath: `${remoteDir}/${differencesFilename}` // Server path
    });
});

// New route for getting a list of directories and files
app.get('/list-directories', async (req, res) => {
    const remoteBaseDir = '/ftp/releases/te/localization_keys_diff';

    try {
        // Connecting to the SFTP server
        await sftp.connect(sftpConfig);

        // Getting the list of directories and files
        const items = await sftp.list(remoteBaseDir);

        // Formatting the response, returning only directories and files
        const directories = items.filter(item => item.type === 'd').map(item => item.name);
        const files = items.filter(item => item.type === '-').map(item => item.name);

        await sftp.end(); // Closing the SFTP connection

        res.json({ directories, files });
    } catch (err) {
        console.error('Error working with SFTP:', err);
        res.status(500).send('Failed to retrieve the list of directories and files.');
    }
});

// Route for retrieving files in a specified directory
app.get('/list-files', async (req, res) => {
    const directory = req.query.directory;
    const remoteDir = `/ftp/releases/te/localization_keys_diff/${directory}`;

    try {
        // Connecting to the SFTP server
        await sftp.connect(sftpConfig);

        // Getting the list of files
        const items = await sftp.list(remoteDir);
        const files = items.filter(item => item.type === '-').map(item => item.name);

        await sftp.end(); // Closing the connection

        res.json({ files });
    } catch (err) {
        console.error('Error working with SFTP:', err);
        res.status(500).send('Failed to retrieve the list of files.');
    }
});

// Route for downloading a file
app.get('/download-file', async (req, res) => {
    const directory = req.query.directory;
    const file = req.query.file;
    const remoteFilePath = `/ftp/releases/te/localization_keys_diff/${directory}/${file}`;
    const localDirPath = path.join(__dirname, 'downloads');
    const localFilePath = path.join(__dirname, 'downloads', file);

    if (!fs.existsSync(localDirPath)) {
        fs.mkdirSync(localDirPath, { recursive: true });
    }

    try {
        // Connecting to the SFTP server
        await sftp.connect(sftpConfig);

        // Downloading the file from SFTP to the local server
        await sftp.fastGet(remoteFilePath, localFilePath);
        await sftp.end(); // Closing the connection

        // Sending the file for download to the user
        res.download(localFilePath, (err) => {
            if (err) {
                console.error('Error downloading file:', err);
                res.status(500).send('Failed to download the file.');
            }

            // Deleting the file after download
            fs.unlinkSync(localFilePath);
        });
    } catch (err) {
        console.error('Error working with SFTP:', err);
        res.status(500).send('Failed to download the file.');
    }
});

// Route for viewing the content of a file in the browser
app.get('/view-file', async (req, res) => {
    const directory = req.query.directory;
    const file = req.query.file;
    const remoteFilePath = `/ftp/releases/te/localization_keys_diff/${directory}/${file}`;

    try {
        // Connecting to the SFTP server
        await sftp.connect(sftpConfig);

        // Downloading the file content into a buffer
        const fileContent = await sftp.get(remoteFilePath);

        await sftp.end(); // Closing the connection

        // Sending the file content as a response
        res.setHeader('Content-Type', 'text/plain'); // Setting content type as plain text
        res.send(fileContent.toString('utf-8')); // Sending the content as text
    } catch (err) {
        console.error('Error opening file:', err);
        res.status(500).send('Failed to open the file.');
    }
});

// Starting the server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
