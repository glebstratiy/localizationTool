const mongoose = require('mongoose');

const localizationFileSchema = new mongoose.Schema({
    platform: { type: String, required: true },
    filename: { type: String, required: true },
    data: { type: Buffer, required: true },
    uploadDate: { type: Date, default: Date.now }
});

const LocalizationFile = mongoose.model('LocalizationFile', localizationFileSchema);

module.exports = LocalizationFile;
