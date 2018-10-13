// Load/Save config

"use strict";

var fs = require("fs");

exports.save = function(config)
{
  var data = JSON.stringify(config, null, 2);

  fs.writeFile("./config.json", data, function (err) {
    if (err) {
      console.log("There has been an error saving your configuration data.");
      console.log(err.message);
      return;
    }
    console.log("Configuration saved successfully.");
  });
};

exports.load = function (defaults)
{
  var config = defaults;
  if(fs.existsSync("./config.json"))
  {
    var data = fs.readFileSync("./config.json");

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
