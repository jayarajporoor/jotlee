global.moment = require('../../node_modules/moment');
var jot = require('../../public/jot.js');

var jot = jot.jot_Parse(process.argv[2]);

console.log(jot);