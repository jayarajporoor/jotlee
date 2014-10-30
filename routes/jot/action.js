exports.index = function(req, res)
{
	if(req.user == null)
	{
		res.send('Unauthorized', 401);
		logger.warn("unauthorized accept req");
	}else
	{
		var msg = req.body;
		var reply = {error: false};
		var sessionid = utils.get_session_id_fast(req);
		if(!sessionid)
		{
			logger.error("Couldn't get session id for user: " + JSON.stringify(req.user));
			reply.error = "session_error";
			res.send(JSON.stringify(reply));
			return;
		}
		
		jot_action(req.user.internalId, sessionid, msg, function(err)
			{
				reply.error = err;
				res.set('Content-Type', 'application/json');
				res.send(JSON.stringify(reply));
			});

	}
}

function jot_action(userid, sessionid, jotInfo, callback)
{
	var query = "";
	if(jotInfo.action == 'accept')
		query = "update jot_users set has_accepted=1 where userid=? and jotid=?";
	else
	if(jotInfo.action == 'cancel')
		query = "update jot_users set status='C' where userid=? and jotid=?";
	else
	if(jotInfo.action == 'done')
		query = "update jot_users set status='D' where userid=? and jotid=?";
	
	if(query == "")
	{
		logger.log("Invalid jot action: " + JSON.stringify(jotInfo) + ", user: " + userid + ", sessionid: " + sessionid);
		callback("invalid_action");
		return;
	}
	
	var db = easydb();
	db
	.query(function()
		{
			return {
				query: query,
				params: [userid, jotInfo.jotid]
			};
		})
	.done(function()
		{
			jot_notify(userid, sessionid, jotInfo, callback);
		})
	.error(function()
		{
			callback("db_error");
		})
	.execute();
}

function jot_notify(userid, sessionid, jotInfo, callback)//convert userids to sessionids
{
	
	logger.debug("accept jotinfo: " + JSON.stringify(jotInfo));
	var redisSession = redisClient(RedisType.SESSION);
	var multi = redisSession.multi();
	
	for(var i =0;i<jotInfo.userids.length;i++)
	{
		multi.smembers(RedisPrefix.SESSION_KEY_SET + jotInfo.userids[i]);
	}
	
	multi.exec(
		function(err, sessions)
		{
			var flat_sessions = [];
			
			//logger.debug("session: " + JSON.stringify(flat_sessions));
			if(err)
			{
				logger.error("Redis error. Cannot get session key sets for jot " + jot.jotid +
						". Error: " + err);
				callback('notify_error');
			}
			else
			{
				for(var i=0;i<sessions.length;i++)
				{
					for(var j=0;j<sessions[i].length;j++)
					{
						if(sessions[i][j] != sessionid)//don't include the originating session since updates are done locally
							flat_sessions.push(sessions[i][j]);
					}
				}
				jot_notify_1(userid, jotInfo, flat_sessions, callback);
			}
		}
	);
}

function jot_notify_1(userid, jotInfo, sessions, callback) 
{
	var redisNotify = redisClient(RedisType.NOTIFY);
	//note: we are setting isOwnerEntry for everyone - clients should ignore isOwnerEntry
	//if not owner.
	var note = {type: jotInfo.action, jotid: jotInfo.jotid, userid: userid};
	var multi = redisNotify.multi();
	
	var expiry = config.SESSION_EXPIRY;
	
	
    logger.debug("accept notify Qs for jot: " + jotInfo.jotid + " = " + JSON.stringify(sessions));
	
    var notetxt = JSON.stringify(note);
	
	for(var i =0;i<sessions.length;i++)
	{
		var key = RedisPrefix.NOTIFY_Q + sessions[i];
		multi.rpush(key, notetxt);
		multi.expire(key, expiry);
		multi.publish(RedisPrefix.CHANNEL + sessions[i], 'action');
	}
	
	multi.exec(function(err, entries)
			{
				var error = false;
				if(err)
				{
					logger.error("Redis error. Cannot send notification for " + 
							     JSON.stringify(notify) + ". Error: " + err);
					error = "notify_error";
				}
				callback(error);
			});
	
}


