/* jslint node: true, esversion: 6 */
"use strict";

const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const minimist = require("minimist");

const openevse = require("./openevse");


var config = {
  "firmware": "-",
  "protocol": "-",
  "espflash": 4194304,
  "version": "DEMO",
  "diodet": 0,
  "gfcit": 0,
  "groundt": 0,
  "relayt": 0,
  "ventt": 0,
  "tempt": 0,
  "service": 2,
  "scale": 220,
  "offset": 0,
  "ssid": "demo",
  "pass": "___DUMMY_PASSWORD___",
  "emoncms_enabled": false,
  "emoncms_server": "emoncms.org",
  "emoncms_node": "openevse",
  "emoncms_apikey": "",
  "emoncms_fingerprint": "",
  "mqtt_enabled": true,
  "mqtt_server": "emonpi.local",
  "mqtt_topic": "openevse",
  "mqtt_user": "emonpi",
  "mqtt_pass": "___DUMMY_PASSWORD___",
  "mqtt_solar": "emon/emonpi/power1",
  "mqtt_grid_ie": "",
  "www_username": "",
  "www_password": "",
  "ohm_enabled": false
};

var status = {
  "mode": "STA",
  "wifi_client_connected": 1,
  "srssi": -50,
  "ipaddress": "172.16.0.191",
  "emoncms_connected": 0,
  "packets_sent": 0,
  "packets_success": 0,
  "mqtt_connected": 1,
  "ohm_hour": "NotConnected",
  "free_heap": 20816,
  "comm_sent": 1077,
  "comm_success": 1075,
  "amp": 27500,
  "pilot": 32,
  "temp1": 247,
  "temp2": 0,
  "temp3": 230,
  "state": 3,
  "elapsed": 10790,
  "wattsec": 71280000,
  "watthour": 72970,
  "gfcicount": 0,
  "nogndcount": 0,
  "stuckcount": 0,
  "divertmode": 1
};

let args = minimist(process.argv.slice(2), {
  alias: {
    h: "help",
    v: "version"
  },
  default: {
    help: false,
    version: false,
    port: 3000,
    endpoint: "simulator"
  },
});

if(args.help) {
  console.log("OpenEVSE WiFi Simulator");
  return 0;
}

if(args.version) {
  console.log(config.version);
  return 0;
}

var port = args.port;

const app = express();
const expressWs = require("express-ws")(app);
const evseConn = openevse.connect(args.endpoint);

//
// Create HTTP server by ourselves.
//

// Setup the static content
app.use(express.static(path.join(__dirname, "../src/data"), { index: "home.htm" }));

// Setup the websocket
app.ws("/ws", function(ws, req) {
  ws.on("message", function(msg) {
    //ws.send(msg);
  });
});
var ws = expressWs.getWss("/ws");
ws.sendAll = function (data) {
  ws.clients.forEach(client => {
    client.send(JSON.stringify(data));
  });
};

// Setup the API endpoints
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/config", function (req, res) {
  res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
  res.json(config);
});
app.get("/status", function (req, res) {
  res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
  res.json(status);
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

  evseConn.rawRequest(rapi, function (data) {
    var resp = { "cmd": rapi, "ret": data};
    res.json(resp);
  }).error(function () {
    var resp = { "cmd": rapi, "ret": "$NK"};
    res.json(resp);
  });
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

app.listen(port, () => console.log("OpenEVSE WiFi Simulator listening on port " + port + "!"));
