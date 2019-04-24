const Page = require('../models/page.model');
const request = require('request');
const cheerio = require('cheerio');
const robotsParser = require('robots-parser');
const Humanoid = require("humanoid-js");
const async = require('async');

const BASE_URL = 'https://fiverr.com/';

const ONE_SECOND = 1000;
const ONE_MINUTE = ONE_SECOND * 60;
const ONE_HOUR = 60 * ONE_MINUTE * ONE_SECOND;
const MAX_LEVEL = 2;

const DEFAULT_CRAWL_REQUEST_BODY = {
    url: BASE_URL,
    currentLevel: 0,
};

function isAllowedLink(link) {
    let text = 'User-Agent: *\n' +
        'Disallow: /orders/timeline/*\n' +
        'Disallow: /s/\n' +
        'Disallow: */pinned_flashes/*\n' +
        'Disallow: /gigs/*/share/\n' +
        'Disallow: /gigs/*/share?*\n' +
        'Disallow: /specials/*\n' +
        'Disallow: /packages/*\n' +
        'Disallow: /categories/silly\n' +
        'Disallow: /categories/fifa\n' +
        'Disallow: /categories/Halloween\n' +
        'Disallow: /categories/Postcards\n' +
        'Disallow: /purchases\n' +
        'Disallow: /user_sessions\n' +
        'Disallow: /users/\n' +
        'Disallow: /counter/*?\n' +
        'Disallow: /counter/\n' +
        'Disallow: /counter\n' +
        'Disallow: /referral_invited\n' +
        'Disallow: /search_results/gigs/*\n' +
        'Disallow: /v4/*\n' +
        'Disallow: /pro/*\n' +
        'Allow: /pro/about';

    var robots = robotsParser(BASE_URL + '/robots.txt', text);

    return robots.isAllowed(link);
}

function getChildren(payload, callback) {
    const children = [];

    const $ = cheerio.load(payload.html);

    let links = $('a');

    $(links).each(async function (i, link) {
        link = $(link).attr('href');

        if (link === undefined || link.includes("#") || link.length === 0 || link.includes('mailto')) {
            return;
        }

        if (!link.includes('http')) {
            link = BASE_URL + link;
        }

        if (isAllowedLink(link)) {
            children.push(link)
        }

        children.push(link)
    });

    payload.children = children;

    callback(null, payload);
}

function getHTML(payload, callback) {
    let humanoid = new Humanoid();

    humanoid.get(payload.req.body.url)
        .then(res => {
            payload.html = res.body;

            if (payload.html.includes("sorry, no robots allowed")) {
                //If couldn't solve the challenge, than trying again.
                sendCrawlRequest(payload.req.body, true);

                callback('no robots allowed page');
            } else {
                callback(null, payload);
            }

        })
        .catch(err => {
            callback(err)
        })
}

function savePage(payload, callback) {
    let newPagePayload = {
        currentLevel: Number(payload.req.body.currentLevel),
        parentPage: payload.req.body.parentPage,
        url: payload.req.body.url,
        html: payload.html,
    };

    const newPage = new Page(newPagePayload);

    newPage.save()
        .then((newPage) => {
            payload.newPage = newPage;

            callback(null, payload);
        })
        .catch((err) => {
            callback(err);
        });
}

function crawlChildren(payload, callback) {
    if (isReachedMaxDepth(Number(payload.req.body.currentLevel), MAX_LEVEL)) {
        callback(null, payload);

        return;
    }

    payload.children.forEach(function (child) {
        let body = {
            url: child,
            currentLevel: Number(payload.req.body.currentLevel) + 1,
            parentPage: payload.newPage._id
        };

        sendCrawlRequest(body)
    });

    callback(null, payload);
}

function isReachedMaxDepth(currentLevel, maxLevel) {
    return currentLevel >= maxLevel;
}

function initCrawl(res) {
    async.waterfall([
        function (callback) {
            callback(null, {res});
        },
        getLastCrawlDate,

        initialCrawl,
    ], function (err, result) {
        if (err) {
        } else {
        }
    });
}

function initSchedule() {
    setInterval(sendCrawlRequest, ONE_HOUR * 8);
}

function initialCrawl(payload, callback) {
    if (!payload.lastCrawlDate) {
        sendCrawlRequest(undefined, undefined, true);
        initSchedule();

    } else if (((new Date) - new Date(payload.lastCrawlDate)) >= ONE_HOUR * 8) {
        sendCrawlRequest(undefined, undefined, true);
        initSchedule();

    } else if (((new Date) - new Date(payload.lastCrawlDate)) < ONE_HOUR * 8) {
        setTimeout(sendCrawlRequest, ((new Date) - new Date(payload.lastCrawlDate)));
        setTimeout(initSchedule, ((new Date) - new Date(payload.lastCrawlDate)));
    }

    callback(null, payload);
}

function sendCrawlRequest(body = DEFAULT_CRAWL_REQUEST_BODY, isRobotIncluded = false, toSendImmediately = false) {
    let nextTime = isRobotIncluded ? ONE_MINUTE * 10 : ONE_MINUTE * 5;
    nextTime = toSendImmediately ? 0 : nextTime;

    setTimeout(function () {
        request.post(
            'http://localhost:3002/crawler',
            {
                json: body
            }).on('error', function (err) {
        });
    }, (Math.floor(Math.random() * nextTime) + 1) * 1000);
}

function getLastCrawlDate(payload, callback) {
    Page
        .find({parentPage: null})
        .sort({_id: -1})
        .exec()
        .then((pages) => {
            if (pages.length > 0) {
                payload.lastCrawlDate = pages[0]._id.getTimestamp();
            }

            callback(null, payload);
        })
        .catch((err) => {
            callback(err);
        });
}

module.exports = {
    getHTML,

    getChildren,

    savePage,

    crawlChildren,

    initCrawl
};
