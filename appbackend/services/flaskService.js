const axios = require('axios');

const FLASK_URL = process.env.FLASK_URL || 'http://localhost:8000';

async function extractDescriptor(imageBase64) {
    try {

        const response = await axios.post(
            `${FLASK_URL}/extract-face`,
            { imageBase64 },
            { timeout: 15000 }   // ← 15 second timeout add kiya
        );

        return response.data;

    } catch (err) {

        if (err.code === 'ECONNABORTED') {
            throw new Error('Face detection timed out. Please try again.');
        }

        if (err.response) {
            throw new Error(err.response.data.message || 'Face detection failed.');
        }

        throw new Error('Could not connect to face detection service.');
    }
}

module.exports = {
    extractDescriptor
};