exports.index = function(req, res){
 //console.log("jotlee: cookies: " + JSON.stringify(req.cookies));
  //console.log("jotlee: session: " + JSON.stringify(req.session));
  
  res.set("Content-Type", "application/json");

  if(req.user != null)
  {
	  if(req.user.name && req.user.name)
	  {
		  res.redirect('/myjots');//already registered.
		 //res.send(JSON.stringify({error:"Already Registered"}));
		 return;
	  }
	  if(!invite_code_is_ok(req.body.inviteCode))
	  {
		  var reply = {error: "Wrong invite code"};
		  res.send(JSON.stringify(reply));
		  return;
	  }
	  var re = /[^a-zA-Z0-9_]/g;
	  if(re.test(req.body.userName))
	  {
		  res.send(JSON.stringify({error:"Username contains special characters"}));
		  return;
	  }
	  
	  console.log(JSON.stringify(req.body));
	  
	  var db = easydb();
	  var user = {
	    	   name : req.body.userName.trim(),
	    	   displayName : req.body.displayName.trim(),
	    	   allowFollowers : req.body.allowFollowers,
	    	   email : req.body.email.trim(),
	  };
	  var name_lc = user.name.toLowerCase();
	  user.id   =  RedisPrefix.USER + name_lc;
	  var userid=false;
      var authid = req.user.id.substring(3);
	  var provider = req.user.id.substring(0,2);
  
	  db
	  .query( function()
	  		{
	  			return {query: "insert into users(username, username_lc, display_name, email, reg_time, " + 
	  				           "allow_followers ) " +
	  				           "values (?, ?, ?, ?, UTC_TIMESTAMP(), ?)", 
	  				     params: [user.name, name_lc, user.displayName, user.email, user.allowFollowers] 
	  				};
	  		})
	  .success(function(rows)
	  		{
	  			userid = rows.insertId;
	  			user.internalId = userid;
	  		})
	  .query( function()
	  		{
		  		return {query: "insert into ext_auth(authid, provider, userid) values(?,?, ?)", 
		  				params: [authid, provider, userid]};
	  		})		
	  .done(function()
	  		{
		  		var redisdb = redisClient(RedisType.SESSION);
			    redisdb.del(req.user.id);
			    redisdb.setex(
			        user.id,
			    	config.SESSION_EXPIRY,
			    	JSON.stringify(user)
			      , function(err)
			    	{
			        	if(err)
			        		logger.error("Redis error. Cannot create user record: " + err);
			        	
        				var reply = {error: err, username: user.name};
					    req.session.regenerate(function (err) {
					    	var passport = {};
					    	passport.user = user.id;
	    					req.session.passport = passport;
	    					res.send(JSON.stringify(reply));
						 });
			         }
			     );								            					
	  		})
	  .error(function(err)
	  		{
				res.send(JSON.stringify({error: 'db_error'}));
	  		})		
	  .execute({transaction:true});
	  	  
  }else
      res.send(401, "Unauthorized");
};


function invite_code_is_ok(code)
{
	return code == "SSKZM91";
}