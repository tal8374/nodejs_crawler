var express = require('express');
var router = express.Router();
var crawlerService = require('../services/crawler.service');
const async = require('async');

router.post('/', async function (req, res) {
    async.waterfall([
        function (callback) {
            callback(null, {req: req});
        },
        crawlerService.getHTML,

        crawlerService.getChildren,

        crawlerService.savePage,

        crawlerService.crawlChildren,
    ], function (err, result) {
        if (err) {
            res.send(err)
        } else {
            res.send(true)
        }
    });
});

module.exports = router;
