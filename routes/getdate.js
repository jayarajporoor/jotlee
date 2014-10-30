var moment = require('moment');

exports.index = function(req, res){
	var m = moment();
	m.utc();
  var reply = {time: m.format("YYYY-MM-DD HH:mm:ss Z")};
  res.set("Content-Type", "application/json");
  res.send(JSON.stringify(reply));
};