/* jshint node: true, esversion: 6*/

// Load/Save config

"use strict";

const fs = require("fs");
const debug = require("debug")("openevse:wifi:config");

exports.path = "./config.json";

exports.save = function(config)
{
  return new Promise(function(resolve, reject)
  {
    var data = JSON.stringify(config, null, 2);

    fs.writeFile(exports.path, data, function (err) {
      if (err) {
        reject(err);
        return;
      }
      debug("Configuration saved successfully.");
      resolve();
    });
  });
};

exports.load = function (defaults)
{
  var config = defaults;
  if(fs.existsSync(exports.path))
  {
    var data = fs.readFileSync(exports.path);

    try {
      config = Object.assign(defaults, JSON.parse(data));
    }
    catch (err) {
      console.log("There has been an error parsing your JSON.");
      console.log(err);
    }
  }

  return config;
};
