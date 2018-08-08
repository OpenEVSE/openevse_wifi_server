/* jslint node: true, esversion: 6 */
/* jshint bitwise: false*/

"use strict";

const STATE_INVALID =                -1;
const STATE_STARTING =                0;
const STATE_NOT_CONNECTED =           1;
const STATE_CONNECTED =               2;
const STATE_CHARGING =                3;
const STATE_VENT_REQUIRED =           4;
const STATE_DIODE_CHECK_FAILED =      5;
const STATE_GFI_FAULT =               6;
const STATE_NO_EARTH_GROUND =         7;
const STATE_STUCK_RELAY =             8;
const STATE_GFI_SELF_TEST_FAILED =    9;
const STATE_OVER_TEMPERATURE =       10;
const STATE_SLEEPING =              254;
const STATE_DISABLED =              255;

var autoService = 1;
var autoStart   = 0;
var serialDebug = 0;
var lcdType     = 0;
var commandEcho = 0;
var pilot       = 32;
var service     = 0;
var diodet      = 0;
var ventt       = 0;
var groundt     = 0;
var relayt      = 0;
var gfcit       = 0;
var tempt       = 0;

var state       = STATE_STARTING;
var elapsed     = 108;

var ffSupported = true;

function toHex(num, len)
{
  var str = num.toString(16);
  while(str.length < len) {
    str = "0" + str;
  }

  return str.toUpperCase();
}

function checksum(msg)
{
  var check = 0;
  for(var i = 0; i < msg.length; i++) {
    check ^= msg.charCodeAt(i);
  }

  var checkString = toHex(check, 2);

  return msg + "^" + checkString;
}

function setState(newState)
{
  if(state != newState) {
    state = newState;
    eventCallback("$ST " + state.toString());
  }
}

function startCharging()
{
  setTimeout(() => {
    setState(STATE_CHARGING);
  }, 1500);
}

setTimeout(() => {
  setState(STATE_CONNECTED);
  startCharging();
}, 1000);

var eventCallback = function() {};
exports.onevent = function(callback) {
  eventCallback = callback;
};

exports.rapi = function(rapi)
{
  if(commandEcho) {
    console.log(rapi);
  }

  var dummyData = {
    "GC": checksum("$OK 10 80"),
    "G3": checksum("$OK 0"),
    "GH": checksum("$OK 0"),
    "GO": checksum("$OK 650 650"),
    "GD": checksum("$OK 0 0 0 0"),
    "GU": checksum("$OK 0 54"),
    "GF": checksum("$OK 0 c 0"),
    "GG": checksum("$OK 0 -1"),
    "GP": checksum("$OK 247 0 230"),
    "GA": checksum("$OK 220 0"),
    "GV": checksum("$OK DEMO 3.0.1")
  };

  var regex = /\$([^^]*)(\^..)?/;
  var match = rapi.match(regex);
  var request = match[1].split(" ");
  var cmd = request[0];
  var resp = "";
  var success = false;

  switch (cmd) {
  case "GT": {
    var date = new Date();
    var time = [
      date.getFullYear() % 100,
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds()
    ];
    resp = checksum("$OK " + time.join(" "));
    success = true;
    break;
  }

  case "GE": {
    var flags = 0;
    flags |= (2 === service  ? 0x0001 : 0);
    flags |= (diodet         ? 0x0002 : 0);
    flags |= (ventt          ? 0x0004 : 0);
    flags |= (groundt        ? 0x0008 : 0);
    flags |= (relayt         ? 0x0010 : 0);
    flags |= (autoService    ? 0x0020 : 0);
    flags |= (autoStart      ? 0x0040 : 0);
    flags |= (serialDebug    ? 0x0080 : 0);
    flags |= (lcdType        ? 0x0100 : 0);
    flags |= (gfcit          ? 0x0200 : 0);
    flags |= (tempt          ? 0x0400 : 0);

    var flagsStr = toHex(flags, 4);

    resp = checksum("$OK " + pilot.toString() + " " + flagsStr);
    success = true;
    break;
  }

  case "GS": {
    resp = checksum("$OK " + state.toString() + " " + elapsed.toString());
    success = true;
    break;
  }

  case "FF": {
    if(ffSupported && request.length >= 3)
    {
      switch(request[1])
      {
      case "D":
        diodet = parseInt(request[2]) ? 0 : 1;
        success = true;
        break;

      case "E":
        commandEcho = parseInt(request[2]);
        success = true;
        break;

      case "F":
        gfcit = parseInt(request[2]) ? 0 : 1;
        success = true;
        break;

      case "G":
        groundt = parseInt(request[2]) ? 0 : 1;
        success = true;
        break;

      case "R":
        relayt = parseInt(request[2]) ? 0 : 1;
        success = true;
        break;

      case "T":
        tempt = parseInt(request[2]) ? 0 : 1;
        success = true;
        break;

      case "V":
        ventt = parseInt(request[2]) ? 0 : 1;
        success = true;
        break;
      }

      if(success) {
        resp = checksum("$OK");
      }
    }
  } break;

  case "FS": {
    setState(STATE_SLEEPING);
    success = true;
    resp = checksum("$OK");
    break;
  }

  case "FD": {
    setState(STATE_DISABLED);
    success = true;
    resp = checksum("$OK");
    break;
  }

  case "FE": {
    setState(STATE_CONNECTED);
    startCharging();
    success = true;
    resp = checksum("$OK");
    break;
  }

  case "SD": {
    if(!ffSupported && request.length >= 2) {
      diodet = parseInt(request[1]) ? 0 : 1;
      success = true;
      resp = checksum("$OK");
    }
  } break;

  case "SE": {
    if(!ffSupported && request.length >= 2) {
      commandEcho = parseInt(request[1]);
      success = true;
      resp = checksum("$OK");
    }
  } break;

  case "SF": {
    if(!ffSupported && request.length >= 2) {
      gfcit = parseInt(request[1]) ? 0 : 1;
      success = true;
      resp = checksum("$OK");
    }
  } break;

  case "SG": {
    if(!ffSupported && request.length >= 2) {
      groundt = parseInt(request[1]) ? 0 : 1;
      success = true;
      resp = checksum("$OK");
    }
  } break;

  case "SR": {
    if(!ffSupported && request.length >= 2) {
      relayt = parseInt(request[1]) ? 0 : 1;
      success = true;
      resp = checksum("$OK");
    }
  } break;

  case "SV": {
    if(!ffSupported && request.length >= 2) {
      ventt = parseInt(request[1]) ? 0 : 1;
      success = true;
      resp = checksum("$OK");
    }
  } break;

  default:
    if (dummyData.hasOwnProperty(cmd)) {
      resp = dummyData[cmd];
      success = true;
      break;
    }
  }

  if(!success) {
    console.warn("Could not handle "+rapi);
    resp = "$NK";
  }

  if(commandEcho) {
    console.log(resp);
  }

  return resp;
};
