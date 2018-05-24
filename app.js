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
  "espflash": 0,
  "version": "0.0.1",
  "diodet": 0,
  "gfcit": 0,
  "groundt": 0,
  "relayt": 0,
  "ventt": 0,
  "tempt": 0,
  "service": 0,
  "scale": 0,
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
  "comm_sent": 0,
  "comm_success": 0,
  "amp": 0,
  "pilot": 0,
  "temp1": 0,
  "temp2": 0,
  "temp3": 0,
  "state": 0,
  "elapsed": 0,
  "wattsec": 0,
  "watthour": 0,
  "gfcicount": 0,
  "nogndcount": 0,
  "stuckcount": 0,
  "divertmode": 1
};

// Time between sending a command to the OpenEVSE
var updateTime = 500;

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
  res.json(config);
});
app.get("/status", function (req, res) {
  res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
  status.comm_sent = evseConn.comm_sent;
  status.comm_success = evseConn.comm_success;
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


// List of items to update on calling update on startup
var initList = [
  function () { return evseConn.version(function (version, protocol) {
    config.firmware = version;
    config.protocol = protocol;
  }); },
  function () { return evseConn.ammeter_settings(function (scaleFactor, offset) {
    config.scale = scaleFactor;
    config.offset = offset;
  }); },
  function () { return evseConn.flags(function (flags) {
    config.service = flags.service;
    config.diodet = flags.diode_check ? 0 : 1;
    config.ventt = flags.vent_required ? 0 : 1;
    config.groundt = flags.ground_check ? 0 : 1;
    config.relayt = flags.stuck_relay_check ? 0 : 1;
    config.gfcit = flags.gfci_test ? 0 : 1;
    config.tempt = flags.temp_ck ? 0 : 1;
  }); },
];

// List of items to update on calling update(). The list will be processed one item at
// a time.
var updateList = [
  function () { return evseConn.current_capacity(function (capacity) {
    status.pilot = capacity;
  }); },
  function () { return evseConn.status(function (state, elapsed) {
    status.state = state;
    status.elapsed = elapsed;
  }); },
  function () { return evseConn.charging_current_voltage(function (voltage, current) {
    status.voltage = voltage;
    status.amp = current;
  }); },
  function () { return evseConn.temperatures(function (temp1, temp2, temp3) {
    status.temp1 = temp1;
    status.temp2 = temp2;
    status.temp3 = temp3;
  }); },
  function () { return evseConn.energy(function (wattSeconds, whacc) {
    status.wattsec = wattSeconds;
    status.watthour = whacc;
  }); },
  function () { return evseConn.fault_counters(function (gfci_count, nognd_count, stuck_count) {
    status.gfcicount = gfci_count;
    status.nogndcount = nognd_count;
    status.stuckcount = stuck_count;
  }); },
];

function init(list, always, delay = 0, count = 0)
{
  if(count >= list.length) {
    always();
    return;
  }

  var updateFn = list[count];
  updateFn().always(function () {
    setTimeout(function () {
      init(list, always, delay, count + 1);
    }, delay);
  });
}

init(initList, function () {
  init(updateList, function () {
    setTimeout(function () {
      update();
    }, updateTime);
  });
});

function update()
{
  init(updateList, update, updateTime);
}
