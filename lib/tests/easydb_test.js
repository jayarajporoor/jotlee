var easydb = require('../easydb');

var _logfunc = function(){
	var msg = "";
	for(i=0;i<arguments.length;i++)
		msg += arguments[i] + ",";
	console.log(msg);
}

global.logger = {
		error: _logfunc,
		info : _logfunc,
		debug: _logfunc
		
}

var client = {
		query: function(q, v, f)
		{
			var fc = typeof(v) == "function" ? v : f;			
			if(fc != v)
				console.log(q + JSON.stringify(v));
			else
				console.log(q);
			
			var res = {insertId: 1};
			process.nextTick(
					function()
					{
						fc(null, res);
					});
		}		
};

global.pool = {
		acquire: function(f)
		{
			process.nextTick(
					function()
					{
						f(null, client);
					}
			);
		},
		release: function(c)
		{
			console.log("release");
		}
		
};


var db = easydb();

var userid=0;

db
.query( function()
		{
			return {query: "insert into test", params: [10, "abc"]};
		})
.success(function(rows)
		{
			userid = rows.insertId;
		})
.query( function()
		{
			return {query: "insert into testx", params : [userid, "def"]};
		})		
/*.success(function(rows)
		{
			console.log("query is successful");
		})*/
.done(function()
		{
			console.log("commit is successful");
		})
.error(function(err)
		{
			console.log("something went wrong: " + err);
		})		
.execute({transaction:true});

