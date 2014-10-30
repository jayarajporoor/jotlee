exports.index = function(req, res)
{
	res.set("Content-Type", "application/json");
	
	if(req.user != null && req.user.name)
	{
		var friendname = req.body.friendname.toLowerCase();
		var db = easydb();
		var reply = {error: false, friend:false};
		db
		.query(function()
				{
					return {
						query: "select userid, username, display_name from users " +
						       " where username_lc=?",
						params: [friendname]
					};
				})		
		.success(function(rows)
				{
					if(rows.length <= 0)
					{
						reply.error = "not_found";						
					}else
					{
						reply.friend = {displayName: rows[0].display_name, userid: rows[0].userid, 
								        username: rows[0].username, autoAccept: 0};
						db
						.query(
								function()
								{
									return {query: "insert into friends(userid, friendid, username_lc, auto_accept, friend_since) " +
										           " values(?, ?, ?, ?, UTC_TIMESTAMP()), (?, ?, ?, ?, UTC_TIMESTAMP())",
										    params: [req.user.internalId, reply.friend.userid, 
										             reply.friend.username.toLowerCase(), 0,  
										             reply.friend.userid, req.user.internalId, 
										             req.user.name.toLowerCase(), 0]
										    };
								});
					}
				})
		.done(function()
			{
				res.send(JSON.stringify(reply));
			})
		.error(function(err)
			{
				if(err.code == "ER_DUP_ENTRY")
					reply.error = "friend_exists";
				else
					reply.error = "db_error";
				res.send(JSON.stringify(reply));
			})
		.execute();
	}else
	{
		res.send(401, "Unauthorized");		
	}
	
}