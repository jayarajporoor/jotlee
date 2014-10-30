exports.index  = function(req, res)
{
	if(req.user == null)
	{
		res.send('Unauthorized', 401);
		logger.warn("unauthorized jot submit");
		return;
	}
		
	var names = req.body;
    var db = easydb();
    
    for(var i =0;i< names.length;i++)
    	names[i] = names[i].toLowerCase();
	db
	.query(function()
		  {	
		  	return {query: "select userid, username_lc, username, display_name " + 
		  					" from users where username_lc in (?)", 
		  			params: [names]};
		   })
	 .success(function(rows)
		   {
		 		reply = {};
		 		for(var i =0;i < rows.length; i++)
		 		{
		 			reply[rows[i].username_lc] = {displayName: rows[i].display_name,
		 					                      userName: rows[i].user_name,
		 										  userid: rows[i].userid};
		 		}
		 		res.set("Content-Type", "application/json");
		 		res.send(JSON.stringify(reply));
		   })
	  .error(function(err)
		  {
          		reply = {};
          		res.send(JSON.stringify(reply));
		  })
	  .execute();	  
	
}