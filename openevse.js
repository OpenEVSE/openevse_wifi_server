// OpenEVSE comms library
//
// Based (loosely) on https://github.com/tiramiseb/python-openevse/

/* global $ */
/* jshint node: true, bitwise: false, esversion: 6*/

"use strict";

const EventEmitter = require("events");
const simulator = require("./simulator_driver");
const SerialPort = require("serialport");
const Readline = SerialPort.parsers.Readline;

class OpenEVSEError{
  constructor(type, message = "") {
    this.type = type;
    this.message = message;
  }
}

class OpenEVSERequest
{
  constructor()
  {

    this._done = function() {};
    this._error = function() {};
    this._always = function() {};
  }

  done(fn) {
    this._done = fn;
    return this;
  }

  error(fn) {
    this._error = fn;
    return this;
  }

  always(fn) {
    this._always = fn;
    return this;
  }
}

class OpenEVSEDriver extends EventEmitter
{

}

class OpenEVSEDriverHttp extends OpenEVSEDriver
{
  constructor(endpoint)
  {
    super();
    this._endpoint = endpoint;
    if (endpoint.substring(0, 5) === "https") { this.http = require("https"); }
    else { this.http = require("http"); }
  }

  rapi(command, callback = function() {})
  {
    var request = new OpenEVSERequest();
    var url = this._endpoint + "?json=1&rapi="+encodeURI(command);
    this.http.get(url, function (res) {
      res.setEncoding("utf8");
      var body = "";

      res.on("data", function (chunk) {
        body += chunk;
      });

      res.on("end", function() {
        var data;
        try {
          data = JSON.parse(body);
          callback(data.ret);
          request._always();
        }
        catch (e) {
          request._error(new OpenEVSEError("BadBody", body));
          request._always();
        }
      }).on("error", function () {
        request._error(new OpenEVSEError("RequestFailed"));
        request._always();
      }).setTimeout(6000, function () {
        request._error(new OpenEVSEError("HTTPTimeout"));
        request._always();
      });
    });

    return request;
  }
}

class OpenEVSEDriverSimulator extends OpenEVSEDriver
{
  constructor()
  {
    super();
    simulator.onevent((data) => {
      var eventData = data.split(" ");
      var event = eventData.shift();
      this.emit(event, eventData);
    });
  }

  rapi(command, callback = function() {})
  {
    var request = new OpenEVSERequest();
    setTimeout(function () {
      callback(simulator.rapi(command));
      request._always();
    }, 1);

    return request;
  }
}

class OpenEVSEDriverSerial extends OpenEVSEDriver
{
  constructor(endpoint)
  {
    super();
    this.serial = new SerialPort(endpoint, {
      baudRate: 115200
    });

    const parser = new Readline({ delimiter: "\r" });
    this.serial.pipe(parser);

    this.requests = [];
    parser.on("data", function (data)
    {
      if(data.startsWith("$OK") || data.startsWith("$NK"))
      {
        if(this.requests.length > 0)
        {
          var request = this.requests.pop();
          request.callback(data);
          request.request._always();
        }
      }
      else
      {
        var eventData = data.split(" ");
        var event = eventData.shift();
        this.emit(event, eventData);
      }
    });
  }

  rapi(command, callback = function() {})
  {
    var request = new OpenEVSERequest();
    this.serial.write(command+"\r");
    this.requests.push({
      callback: callback,
      request: request
    });

    return request;
  }
}

/* exported OpenEVSE */
class OpenEVSE extends EventEmitter
{
  constructor (driver)
  {
    super();
    this._version = "0.1";
    this._driver = driver;

    this.STATE_INVALID =                -1;
    this.STATE_STARTING =                0;
    this.STATE_NOT_CONNECTED =           1;
    this.STATE_CONNECTED =               2;
    this.STATE_CHARGING =                3;
    this.STATE_VENT_REQUIRED =           4;
    this.STATE_DIODE_CHECK_FAILED =      5;
    this.STATE_GFI_FAULT =               6;
    this.STATE_NO_EARTH_GROUND =         7;
    this.STATE_STUCK_RELAY =             8;
    this.STATE_GFI_SELF_TEST_FAILED =    9;
    this.STATE_OVER_TEMPERATURE =       10;
    this.STATE_SLEEPING =              254;
    this.STATE_DISABLED =              255;

    this.states = {
      0: "unknown",
      1: "not connected",
      2: "connected",
      3: "charging",
      4: "vent required",
      5: "diode check failed",
      6: "gfci fault",
      7: "no ground",
      8: "stuck relay",
      9: "gfci self-test failure",
      10: "over temperature",
      254: "sleeping",
      255: "disabled"
    };

    this._lcd_colors = ["off", "red", "green", "yellow", "blue", "violet", "teal", "white"];
    this._status_functions = {"disable":"FD", "enable":"FE", "sleep":"FS"};
    this._lcd_types=["monochrome", "rgb"];
    this._service_levels=["A", "1", "2"];

    // Timeouts in seconds
    this.STANDARD_SERIAL_TIMEOUT = 0.5;
    this.RESET_SERIAL_TIMEOUT = 10;
    this.STATUS_SERIAL_TIMEOUT = 0;
    this.SYNC_SERIAL_TIMEOUT = 0.5;
    this.NEWLINE_MAX_AGE = 5;

    this.CORRECT_RESPONSE_PREFIXES = ("$OK", "$NK");

    this.regex = /\$([^^]*)(\^..)?/;

    this.comm_sent = 0;
    this.comm_success = 0;

    driver.on("$ST", (data) => {
      this.emit("state", parseInt(data[0]));
    });

    driver.on("$WF", (data) => {
      this.emit("wifiMode", parseInt(data[0]));
    });
  }

  _request(args, callback = function() {})
  {
    var command = "$" + (Array.isArray(args) ? args.join("+") : args);

    var request = this.rawRequest(command, (data) =>
    {
      var match = data.match(this.regex);
      if(null !== match)
      {
        var response = match[1].split(" ");
        if("OK" === response[0]) {
          this.comm_success++;
          callback(response.slice(1));
          request._done(response.slice(1));
        } else {
          request._error(new OpenEVSEError("OperationFailed"));
        }
      } else {
        request._error(new OpenEVSEError("UnexpectedResponse"));
      }
    });

    return request;
  }

  rawRequest(command, callback = function() {})
  {
    this.comm_sent++;
    return this._driver.rapi(command, callback);
  }

  /**
   * Get EVSE controller flags
   *
   * Specific values:
   * - service_level: 1 or 2
   * - lcd_type: 'monochrome' or 'rgb'
   *
   * True for enabled, False for disabled:
   * - auto_service_level
   * - diode_check
   * - gfi_self_test
   * - ground_check
   * - stuck_relay_check
   * - vent_required
   * - temp_check
   * - auto_start
   * - serial_debug
   */
  flags(callback)
  {
    var request = this._request("GE", (data) => {
      var flags = parseInt(data[1], 16);
      if(!isNaN(flags)) {
        var ret = {
          "service_level": (flags & 0x0001) + 1,
          "diode_check": 0 === (flags & 0x0002),
          "vent_required": 0 === (flags & 0x0004),
          "ground_check": 0 === (flags & 0x0008),
          "stuck_relay_check": 0 === (flags & 0x0010),
          "auto_service_level": 0 === (flags & 0x0020),
          "auto_start": 0 === (flags & 0x0040),
          "serial_debug": 0 !== (flags & 0x0080),
          "lcd_type": 0 !== (flags & 0x0100) ? "monochrome" : "rgb",
          "gfi_self_test": 0 === (flags & 0x0200),
          "temp_check": 0 === (flags & 0x0400)
        };

        callback(ret);
      } else {
        request._error(new OpenEVSEError("ParseError", "Failed to parse \""+data[0]+"\""));
      }
    });
    return request;
  }

  /*** Function operations ***/

  /**
   * Reset the OpenEVSE
   */
  reset()
  {
    return this._request("FR");
  }

  /**
   * Set or get the RTC time
   *
   * Argument:
   *  - a Date object
   *
   * If the datetime object is not specified, get the current OpenEVSE clock
   *
   * Returns a datetime object
   */
  time(callback, date = false)
  {
    if(false !== date) {
      return this._request([
        "S1", date.getFullYear() - 2000,
        date.getMonth(), date.getDate(),
        date.getHours(), date.getMinutes(),
        date.getSeconds()], function() {
        this.time(callback);
      });
    }

    var request = this._request("GT", function(data) {
      if(data.length >= 6) {
        var year = parseInt(data[0]);
        var month = parseInt(data[1]);
        var day = parseInt(data[2]);
        var hour = parseInt(data[3]);
        var minute = parseInt(data[4]);
        var second = parseInt(data[5]);

        if(!isNaN(year) && !isNaN(month) && !isNaN(day) && !isNaN(hour) && !isNaN(minute) && !isNaN(second)) {
          if (year===165 && month===165 && day===165 && hour===165 && minute===165 && second===85){
            let date = new Date(0);
            callback(date,false);//this pattern occurs when no RTC is connected to openevse
          } else {
            let date = new Date(2000+year, month, day, hour, minute, second);
            callback(date,true);
          }
        } else {
          request._error(new OpenEVSEError("ParseError", "Could not parse time \""+data.join(" ")+"\" arguments"));
        }
      } else {
        request._error(new OpenEVSEError("ParseError", "Only received "+data.length+" arguments"));
      }
    });
    return request;
  }

  /**
   * Set or get the charge timer
   *
   * Argument:
   *  - start: The start time
   *  - end: The stop time
   *
   * If any of the values is false, get the timer
   */
  timer(callback, start = false, stop = false)
  {
    function addZero(val) {
      return (val < 10 ? "0" : "") + val;
    }

    if(false !== start && false !== stop) {
      var timeRegex = /([01]\d|2[0-3]):([0-5]\d)/;
      var startArray = start.match(timeRegex);
      var stopArray = stop.match(timeRegex);

      if(null !== startArray && null !== stopArray)
      {
        return this._request([
          "ST",
          parseInt(startArray[1]), parseInt(startArray[2]),
          parseInt(stopArray[1]), parseInt(stopArray[2])
        ], function() {
          this.timer(callback);
        });
      }

      return false;
    }

    var request = this._request("GD", function(data) {
      if(data.length >= 4) {
        var startMinute = parseInt(data[0]);
        var startSecond = parseInt(data[1]);
        var stopMinute = parseInt(data[2]);
        var stopSecond = parseInt(data[3]);

        if(!isNaN(startMinute) && !isNaN(startSecond) && !isNaN(stopMinute) && !isNaN(stopSecond)) {
          if(0 === startMinute && 0 === startSecond && 0 === stopMinute && 0 === stopSecond) {
            callback(false, "--:--", "--:--");
          } else {
            start = addZero(startMinute) + ":" + addZero(startSecond);
            stop = addZero(stopMinute) + ":" + addZero(stopSecond);

            callback(true, start, stop);
          }
        } else {
          request._error(new OpenEVSEError("ParseError", "Could not parse time \""+data.join(" ")+"\" arguments"));
        }
      } else {
        request._error(new OpenEVSEError("ParseError", "Only received "+data.length+" arguments"));
      }
    });
    return request;
  }

  /**
   * Cancel the timer
   */
  cancelTimer(callback) {
    return this._request([
      "ST", 0, 0, 0, 0], function() {
      callback();
    });
  }

  /**
   * Get or set the charge time limit, in minutes.
   *
   * This time is rounded to the nearest quarter hour.
   *
   * The maximum value is 3825 minutes.
   *
   * Returns the limit
   */
  time_limit(callback, limit = false) {
    if(false !== limit) {
      return this._request(["S3", Math.round(limit/15.0)],
        function() {
          this.time_limit(callback);
        });
    }

    var request = this._request("G3", function(data) {
      if(data.length >= 1) {
        var limit = parseInt(data[0]);

        if(!isNaN(limit)) {
          callback(limit * 15);
        } else {
          request._error(new OpenEVSEError("ParseError", "Could not parse \""+data.join(" ")+"\" arguments"));
        }
      } else {
        request._error(new OpenEVSEError("ParseError", "Only received "+data.length+" arguments"));
      }
    });
    return request;
  }

  /**
   * Get or set the charge limit, in kWh.
   *
   * 0 = no charge limit
   *
   * Returns the limit
   */
  charge_limit(callback, limit = false) {
    if(false !== limit) {
      return this._request(["SH", limit],
        function() {
          this.charge_limit(callback);
        });
    }

    var request = this._request("GH", function(data) {
      if(data.length >= 1) {
        var limit = parseInt(data[0]);

        if(!isNaN(limit)) {
          callback(limit);
        } else {
          request._error(new OpenEVSEError("ParseError", "Could not parse \""+data.join(" ")+"\" arguments"));
        }
      } else {
        request._error(new OpenEVSEError("ParseError", "Only received "+data.length+" arguments"));
      }
    });
    return request;
  }

  /**
   * Set or get the ammeter settings
   *
   * If either of the arguments is None, get the values instead of setting them.
   *
   * Returns scale factor and offset
   */
  ammeter_settings(callback, scaleFactor = false, offset = false) {
    if(false !== scaleFactor && false !== offset) {
      return this._request(["SA", scaleFactor, offset],
        function() {
          callback(scaleFactor, offset);
        });
    }

    var request = this._request("GA", function(data) {
      if(data.length >= 2) {
        var scaleFactor = parseInt(data[0]);
        var offset = parseInt(data[1]);

        if(!isNaN(scaleFactor) && !isNaN(offset)) {
          callback(scaleFactor, offset);
        } else {
          request._error(new OpenEVSEError("ParseError", "Could not parse \""+data.join(" ")+"\" arguments"));
        }
      } else {
        request._error(new OpenEVSEError("ParseError", "Only received "+data.length+" arguments"));
      }
    });
    return request;
  }

  /**
   * Set or get the current capacity
   *
   * If capacity is false, get the value
   *
   * Returns the capacity in amperes
   */
  current_capacity(callback, capacity = false) {
    if(false !== capacity) {
      return this._request(["SC", capacity],
        function() {
          this.current_capacity(callback);
        });
    }

    var request = this._request("GE", function(data) {
      if(data.length >= 1) {
        var capacity = parseInt(data[0]);

        if(!isNaN(capacity)) {
          callback(capacity);
        } else {
          request._error(new OpenEVSEError("ParseError", "Could not parse \""+data.join(" ")+"\" arguments"));
        }
      } else {
        request._error(new OpenEVSEError("ParseError", "Only received "+data.length+" arguments"));
      }
    });
    return request;
  }

  /**
   * Set or get the service level
   *
   * Allowed values:
   * - 0: Auto
   * - 1: Level 1, 120VAC 16A
   * - 2: Level 2, 208-240VAC 80A
   *
   * If the level is not specified, the current level is returned
   *
   * Returns the current service level: 0 for auto, 1 or 2
   */
  service_level(callback, level = false) {
    if(false !== level) {
      return this._request(["SL", this._service_levels[level]],
        function() {
          this.service_level(callback);
        });
    }

    var request = this.flags(function(flags) {
      callback(flags.auto_service_level ? 0 : flags.service_level, flags.service_level);
    });
    return request;
  }

  /**
   * Get the current capacity range, in amperes
   * (it depends on the service level)
   * Returns the current capacity:
   *     (min_capacity, max_capacity)
   */
  current_capacity_range(callback) {
    var request = this._request("GC", function(data) {
      if(data.length >= 2) {
        var minCapacity = parseInt(data[0]);
        var maxCapacity = parseInt(data[1]);
        if(!isNaN(minCapacity) && !isNaN(maxCapacity)) {
          callback(minCapacity, maxCapacity);
        } else {
          request._error(new OpenEVSEError("ParseError", "Could not parse \""+data.join(" ")+"\" arguments"));
        }
      } else {
        request._error(new OpenEVSEError("ParseError", "Only received "+data.length+" arguments"));
      }
    });
    return request;
  }

  /**
   * Change the EVSE status.
   *
   * If an action is not specified, the status is requested
   *
   * Allowed actions:
   *   * enable
   *   * disable
   *   * sleep
   *
   * Default: no action, request the status
   *
   * Returns the status of the EVSE as a string
   *
   */
  status(callback, action = false) {
    if(false !== action) {
      var cmd = this._status_functions[action];
      return this._request([cmd],
        function() {
          this.status(callback);
        });
    }

    var request = this._request("GS", function(data) {
      if(data.length >= 1) {
        var state = parseInt(data[0]);
        var elapsed = parseInt(data[1]);

        if(!isNaN(state) && !isNaN(elapsed)) {
          callback(state, elapsed);
        } else {
          request._error(new OpenEVSEError("ParseError", "Could not parse \""+data.join(" ")+"\" arguments"));
        }
      } else {
        request._error(new OpenEVSEError("ParseError", "Only received "+data.length+" arguments"));
      }
    });

    return request;
  }

  /**
   * if enabled == True, enable the diode check
   * if enabled == False, disable the diode check
   * if enabled is not specified, request the diode check status
   *
   * Returns the diode check status
   */
  diode_check(callback, enabled = null) {
    if(null !== enabled) {
      return this._request(["FF", "D", enabled ? "1" : "0"],
        // OLD API < 4.0.1
        // return this._request(["SD", enabled ? "1" : "0"],
        function() {
          this.diode_check(callback);
        });
    }

    var request = this.flags(function(flags) {
      callback(flags.diode_check);
    });
    return request;
  }

  /**
   * if enabled == True, enable the GFI self test
   * if enabled == False, disable the GFI self test
   * if enabled is not specified, request the GFI self test status
   *
   * Returns the GFI self test status
   */
  gfi_self_test(callback, enabled = null) {
    if(null !== enabled) {
      return this._request(["FF F", enabled ? "1" : "0"],
        // OLD API < 4.0.1
        // return this._request(["SF", enabled ? "1" : "0"],
        function() {
          this.gfi_self_test(callback);
        });
    }

    var request = this.flags(function(flags) {
      callback(flags.gfi_self_test);
    });
    return request;
  }

  /**
   * if enabled == True, enable the ground check
   * if enabled == False, disable the ground check
   * if enabled is not specified, request the ground check status
   *
   * Returns the ground check status
   */
  ground_check(callback, enabled = null) {
    if(null !== enabled) {
      return this._request(["FF G", enabled ? "1" : "0"],
        // OLD API < 4.0.1
        // return this._request(["SG", enabled ? "1" : "0"],
        function() {
          this.ground_check(callback);
        });
    }

    var request = this.flags(function(flags) {
      callback(flags.ground_check);
    });
    return request;
  }

  /**
   * if enabled == True, enable the stuck relay check
   * if enabled == False, disable the stuck relay check
   * if enabled is not specified, request the stuck relay check status
   *
   * Returns the stuck relay check status
   */
  stuck_relay_check(callback, enabled = null) {
    if(null !== enabled) {
      return this._request(["FF R", enabled ? "1" : "0"],
        // OLD API < 4.0.1
        // return this._request(["SR", enabled ? "1" : "0"],
        function() {
          this.stuck_relay_check(callback);
        });
    }

    var request = this.flags(function(flags) {
      callback(flags.stuck_relay_check);
    });
    return request;
  }

  /**
   * if enabled == True, enable "ventilation required check"
   * if enabled == False, disable "ventilation required check"
   * if enabled is not specified, request the "ventilation required check" status
   *
   * Returns the "ventilation required" status
   */
  vent_required(callback, enabled = null) {
    if(null !== enabled) {
      return this._request(["FF V", enabled ? "1" : "0"],
        // OLD API < 4.0.1
        // return this._request(["SV", enabled ? "1" : "0"],
        function() {
          this.vent_required(callback);
        });
    }

    var request = this.flags(function(flags) {
      callback(flags.vent_required);
    });
    return request;
  }

  /**
   * if enabled == True, enable "temperature monitoring"
   * if enabled == False, disable "temperature monitoring"
   * if enabled is not specified, request the "temperature monitoring" status
   *
   * Returns the "temperature monitoring" status
   */

  temp_check(callback, enabled = null) {
    if(null !== enabled) {
      return this._request(["FF T", enabled ? "1" : "0"],
        function() {
          this.temp_check(callback);
        });
    }

    var request = this.flags(function(flags) {
      callback(flags.temp_check);
    });
    return request;
  }


  // OLD API < 4.0.1
  // temp_check(callback, enabled = null) {
  //   if(null !== enabled)
  //   {
  //     if(enabled)
  //     {
  //       return this._request("GO", function(data) {
  //         this._request(["SO", data[0], data[1]],
  //           function() {
  //             this.temp_check(callback);
  //           });
  //       });
  //     }
  // **NOTE: SO has been removed totally in RAPI 4.0.0**
  //     return this._request(["SO", "0", "0"],
  //       function() {
  //         this.temp_check(callback);
  //       });
  //   }
  //   var request = this.flags(function(flags) {
  //     callback(flags.temp_check);
  //   });
  //   return request;
  // };



  /**
   *
   */
  over_temperature_thresholds(callback, ambientthresh = false, irthresh = false) {
    if(false !== ambientthresh && false !== irthresh) {
      return this._request(["SO", ambientthresh, irthresh],
        function() {
          this.over_temperature_thresholds(callback);
        });
    }

    var request = this._request("GO", function(data) {
      if(data.length >= 2) {
        var ambientthresh = parseInt(data[0]);
        var irthresh = parseInt(data[1]);

        if(!isNaN(ambientthresh) && !isNaN(irthresh)) {
          callback(ambientthresh, irthresh);
        } else {
          request._error(new OpenEVSEError("ParseError", "Could not parse \""+data.join(" ")+"\" arguments"));
        }
      } else {
        request._error(new OpenEVSEError("ParseError", "Only received "+data.length+" arguments"));
      }
    });
    return request;
  }

  /**
   *
   */
  charging_current_voltage(callback) {
    var request = this._request("GG", function(data) {
      if(data.length >= 2) {
        var voltage = parseInt(data[0]);
        var current = parseInt(data[1]);

        if(!isNaN(voltage) && !isNaN(current)) {
          callback(voltage, current);
        } else {
          request._error(new OpenEVSEError("ParseError", "Could not parse \""+data.join(" ")+"\" arguments"));
        }
      } else {
        request._error(new OpenEVSEError("ParseError", "Only received "+data.length+" arguments"));
      }
    });
    return request;
  }

  /**
   *
   */
  temperatures(callback) {
    var request = this._request("GP", function(data) {
      if(data.length >= 2) {
        var temp1 = parseInt(data[0]);
        var temp2 = parseInt(data[1]);
        var temp3 = parseInt(data[2]);

        if(!isNaN(temp1) && !isNaN(temp2) && !isNaN(temp3)) {
          callback(temp1, temp2, temp3);
        } else {
          request._error(new OpenEVSEError("ParseError", "Could not parse \""+data.join(" ")+"\" arguments"));
        }
      } else {
        request._error(new OpenEVSEError("ParseError", "Only received "+data.length+" arguments"));
      }
    });
    return request;
  }

  /**
   *
   */
  energy(callback) {
    var request = this._request("GU", function(data) {
      if(data.length >= 2) {
        var wattSeconds = parseInt(data[0]);
        var whacc = parseInt(data[1]);

        if(!isNaN(wattSeconds) && !isNaN(whacc)) {
          callback(wattSeconds, whacc);
        } else {
          request._error(new OpenEVSEError("ParseError", "Could not parse \""+data.join(" ")+"\" arguments"));
        }
      } else {
        request._error(new OpenEVSEError("ParseError", "Only received "+data.length+" arguments"));
      }
    });
    return request;
  }

  /**
   *
   */
  fault_counters(callback) {
    var request = this._request("GF", function(data) {
      if(data.length >= 2) {
        var gfci_count = parseInt(data[0], 16);
        var nognd_count = parseInt(data[1], 16);
        var stuck_count = parseInt(data[2], 16);

        if(!isNaN(gfci_count) && !isNaN(nognd_count) && !isNaN(stuck_count)) {
          callback(gfci_count, nognd_count, stuck_count);
        } else {
          request._error(new OpenEVSEError("ParseError", "Could not parse \""+data.join(" ")+"\" arguments"));
        }
      } else {
        request._error(new OpenEVSEError("ParseError", "Only received "+data.length+" arguments"));
      }
    });
    return request;
  }

  /**
   *
   */
  version(callback) {
    var request = this._request("GV", function(data) {
      if(data.length >= 2) {
        var version = data[0];
        var protocol = data[1];

        callback(version, protocol);
      } else {
        request._error(new OpenEVSEError("ParseError", "Only received "+data.length+" arguments"));
      }
    });
    return request;
  }
}

exports.connect = function(endpoint)
{
  var driver;
  if("simulator" === endpoint) {
    driver = new OpenEVSEDriverSimulator();
  } else if(endpoint.startsWith("http:") || endpoint.startsWith("https:")) {
    driver = new OpenEVSEDriverHttp(endpoint);
  } else {
    driver = new OpenEVSEDriverSerial(endpoint);
  }

  return new OpenEVSE(driver);
};
