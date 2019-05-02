#!/usr/bin/env node
/* jslint node: true, esversion: 6 */

const minimist = require("minimist");
const OpenEVSEWiFi = require("./openevsewifi");
const web = require("./web");
const debug = require("debug")("openevse:app");

var app = new OpenEVSEWiFi();

let args = minimist(process.argv.slice(2), {
  alias: {
    h: "help",
    v: "version"
  },
  default: {
    help: false,
    version: false,
    port: 3000,
    endpoint: "simulator",
    lcd: false
  },
});

debug(args);

if(args.help) {
  console.log("OpenEVSE WiFi Simulator");
  return 0;
}

if(args.version) {
  console.log(app.info.version);
  return 0;
}

app.start(args.endpoint);
web.start(app, args.port);

if(args.lcd)
{
  const lcd = require("./lcd");
  var lcdApp = new lcd();
  lcdApp.start(app, args.lcd);
}
