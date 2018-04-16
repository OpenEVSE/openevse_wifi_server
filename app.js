/* jslint node: true, esversion: 6 */
"use strict";

const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const minimist = require("minimist");

const simulator = require("./simulator_driver");
const openevse = require("./openevse_driver");

const driver = simulator;

let args = minimist(process.argv.slice(2), {
  alias: {
    h: "help",
    v: "version"
  },
  default: {
    help: false,
    version: false,
    port: 3000,
    driver: false
  },
});

if(args.help) {
  console.log("OpenEVSE WiFi Simulator");
  return 0;
}

if(args.version) {
  console.log(driver.config().version);
  return 0;
}

var port = args.port;

const app = express();
const expressWs = require("express-ws")(app);

//
// Create HTTP server by ourselves.
//

// Setup the static content
app.use(express.static(path.join(__dirname, "../src/data"), { index: "home.htm" }));

// Setup the API endpoints
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/config", function (req, res) {
  res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
  res.json(driver.config());
});
app.get("/status", function (req, res) {
  res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
  res.json(driver.status());
});
app.get("/update", function (req, res) {
  res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
  res.send("<html><form method='POST' action='/update' enctype='multipart/form-data'><input type='file' name='firmware'> <input type='submit' value='Update'></form></html>");
});
app.post("/update", function (req, res) {
  res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
  res.status(500).send("Not implemented");
});
app.get("/r", function (req, res) {
  res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");

  var rapi = req.query.rapi;
  var resp = { "cmd": rapi, "ret": driver.rapi(rapi)};

  res.json(resp);
});

app.post("/savenetwork", function (req, res) {
  res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
  res.status(500).send("Not implemented");
});

app.post("/saveemoncms", function (req, res) {
  res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
  res.status(500).send("Not implemented");
});

app.post("/savemqtt", function (req, res) {
  res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
  res.status(500).send("Not implemented");
});

app.post("/saveadmin", function (req, res) {
  res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
  res.status(500).send("Not implemented");
});

app.post("/saveohmkey", function (req, res) {
  res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
  res.status(500).send("Not implemented");
});

app.post("/reset", function (req, res) {
  res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
  res.status(500).send("Not implemented");
});

app.post("/restart", function (req, res) {
  res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
  res.status(500).send("Not implemented");
});

app.get("/scan", function (req, res) {
  res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
  setTimeout(function () {
    res.json([{"rssi":-51,"ssid":"wibble_ext","bssid":"C4:04:15:5A:45:DE","channel":11,"secure":4,"hidden":false},{"rssi":-45,"ssid":"esplug_10560510","bssid":"1A:FE:34:A1:23:FE","channel":11,"secure":7,"hidden":false},{"rssi":-85,"ssid":"BTWifi-with-FON","bssid":"02:FE:F4:32:F1:08","channel":6,"secure":7,"hidden":false},{"rssi":-87,"ssid":"BTWifi-X","bssid":"22:FE:F4:32:F1:08","channel":6,"secure":7,"hidden":false},{"rssi":-75,"ssid":"wibble","bssid":"6C:B0:CE:20:7C:3A","channel":6,"secure":4,"hidden":false},{"rssi":-89,"ssid":"BTHub3-ZWCW","bssid":"00:FE:F4:32:F1:08","channel":6,"secure":8,"hidden":false}]);
  }, 5000);
});

app.post("/apoff", function (req, res) {
  res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
  res.status(500).send("Not implemented");
});

app.post("/divertmode", function (req, res) {
  res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
  res.status(500).send("Not implemented");
});

app.ws("/ws", function(ws, req) {
  ws.on("message", function(msg) {
    //ws.send(msg);
  });
});

app.listen(port, () => console.log("OpenEVSE WiFi Simulator listening on port " + port + "!"));
