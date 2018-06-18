const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const expressWs = require("express-ws")(app);

const DUMMY_PASSWORD = "___DUMMY_PASSWORD___";
var data = false;

//
// Create HTTP server by ourselves.
//

// Setup the static content
app.use(express.static(path.join(__dirname, "../src/data"), { index: "home.htm" }));

// Setup the websocket
app.ws("/ws", function(ws) {
  ws.on("message", function() {
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
  res.json({
    firmware: data.info.firmware,
    protocol: data.info.protocol,
    espflash: data.info.espflash,
    version: data.info.version,
    diodet: data.openevse.diodet ? 0 : 1,
    gfcit: data.openevse.gfcit ? 0 : 1,
    groundt: data.openevse.groundt ? 0 : 1,
    relayt: data.openevse.relayt ? 0 : 1,
    ventt: data.openevse.ventt ? 0 : 1,
    tempt: data.openevse.tempt ? 0 : 1,
    service: data.openevse.service,
    scale: data.openevse.scale,
    offset: data.openevse.offset,
    ssid: data.config.wifi.ssid,
    pass: data.config.wifi.pass ? DUMMY_PASSWORD : "",
    emoncms_enabled: data.config.emoncms.enabled,
    emoncms_server: data.config.emoncms.server,
    emoncms_node: data.config.emoncms.node,
    emoncms_apikey: data.config.emoncms.apikey ? DUMMY_PASSWORD : "",
    emoncms_fingerprint: data.config.emoncms.fingerprint,
    mqtt_enabled: data.config.mqtt.enabled,
    mqtt_server: data.config.mqtt.server,
    mqtt_topic: data.config.mqtt.topic,
    mqtt_user: data.config.mqtt.user,
    mqtt_pass: data.config.mqtt.pass ? DUMMY_PASSWORD : "",
    mqtt_solar: data.config.mqtt.solar,
    mqtt_grid_ie: data.config.mqtt.grid_ie,
    www_username: data.config.www.username,
    www_password: data.config.www.password ? DUMMY_PASSWORD : "",
    ohm_enabled: data.config.ohm.enabled
  });
});
app.get("/status", function (req, res) {
  res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
  res.json(data.status);
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

  data.rapi(rapi, function (data) {
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
  var config = {
    emoncms: {
      enabled: req.body.enable,
      server: req.body.server,
      node: req.body.node,
      fingerprint: req.body.fingerprint
    }
  };
  if(DUMMY_PASSWORD !== req.body.apikey) {
    config.emoncms.apikey = req.body.apikey;
  }
  data.config = config;
  res.send("Saved: " + req.body.server + " " + req.body.node + " " + req.body.apikey + " " + req.body.fingerprint);
});

app.post("/savemqtt", function (req, res) {
  res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
  var config = {
    mqtt: {
      enabled: req.body.enable,
      server: req.body.server,
      topic: req.body.topic,
      user: req.body.user,
      solar: req.body.solar,
      grid_ie: req.body.grid_ie
    }
  };
  if(DUMMY_PASSWORD !== req.body.pass) {
    config.mqtt.pass = req.body.pass;
  }
  data.config = config;
  res.send("Saved: " + req.body.server + " " + req.body.topic + " " + req.body.user + " " + req.body.pass);
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

exports.start = function(evseApp, port) {
  data = evseApp;
  app.listen(port, () => console.log("OpenEVSE WiFi Simulator listening on port " + port + "!"));
};
