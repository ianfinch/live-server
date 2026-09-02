/**
 * Middleware so I can use markdown files from live-server
 */

const handler = require("./orchestrator");

module.exports = function(req, res, next) {

    console.log(new Date().toISOString() + " " + req.method + " " + req.url);
    handler(req.url, process.cwd(), res, next);
}
