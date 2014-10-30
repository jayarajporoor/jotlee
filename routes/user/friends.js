exports.index = function(req, res)
{
	res.set("Content-Type", "application/json");
	
	if(req.user != null && req.user.name)
	{
		var db = easydb();
		var reply = {error: false, friends:[]};
		db
		.query(function()
				{
					return {
						query: "select friends.friendid, friends.auto_accept, " +
						       " friends.friend_since, users.username, users.display_name " +
						       " from friends inner join users on friends.friendid=users.userid where " +
						       " friends.userid = ?",
						params: [req.user.internalId]
					};
				})		
		.success(function(rows)
				{
					for(var i=0;i<rows.length;i++)
					{
  					    var m = new moment(rows[i].friend_since);						
						var friend = {username: rows[i].username, 
								      userid: rows[i].friendid, autoAccept: rows[i].auto_accept[0], 
								      friendSince: m.format("YYYY-MM-DD HH:mm:ss Z"), 
								      displayName: rows[i].display_name};
						reply.friends.push(friend);
					}
				})
		.done(function()
			{
				res.send(JSON.stringify(reply));
			})
		.error(function(err)
			{
				reply.error = "db_error";
				res.send(JSON.stringify(reply));
			})
		.execute();
	}else
	{
		res.send(401, "Unauthorized");		
	}
}