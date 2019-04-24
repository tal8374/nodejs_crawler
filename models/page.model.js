const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let pageSchema = new mongoose.Schema({
    currentLevel: {type: Schema.Types.Number},
    parentPage: {type: Schema.Types.ObjectId, ref: 'Page'},
    html: {type: Schema.Types.String},
    url: {type: Schema.Types.String},
});

module.exports = mongoose.model('Page', pageSchema);
