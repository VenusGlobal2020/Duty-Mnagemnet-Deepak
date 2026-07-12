const mongoose = require('mongoose');
const dutySchema = new mongoose.Schema({}, { strict: false, collection: 'duties' });
module.exports = mongoose.models.Duty || mongoose.model('Duty', dutySchema);