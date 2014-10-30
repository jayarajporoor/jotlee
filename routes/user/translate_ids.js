exports.index  = function(req, res)
{
	if(req.user == null)
	{
		res.send('Unauthorized', 401);
		logger.warn("unauthorized jot submit");
		return;
	}
		
	var userids = req.body;
    var db = easydb();

	db
	.query(function()
		  {	
		  	return {query: "select username, display_name, userid from users where " + 
		  					"userid in ( ? )", 
		  			params: [userids]};
		   })
	 .success(function(rows)
		   {
		 		reply = {};
		 		for(var i =0;i < rows.length; i++)
		 		{
		 			reply[rows[i].username.toLowerCase()] = {displayName: rows[i].display_name,
		 					                      			userName: rows[i].username,
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