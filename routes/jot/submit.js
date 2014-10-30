exports.index  = function(req, res)
{
	if(req.user == null)
	{
		res.send('Unauthorized', 401);
		logger.warn("unauthorized jot submit");
		return;
	}	
	var msg = req.body;
	if(msg.type == 'jot')
	{
		logger.debug(msg);	
		//TODO: sanitize input first
		
		var autoAccept = {};		
		autoAccept[req.user.internalId] = true; 

		jot_add(req.user, msg, autoAccept, function(rmsg, ownerIsIncluded)
			{
				res.set("Content-Type", "application/json");
				res.send(JSON.stringify(rmsg));
				if(!rmsg.error)
					jot_notify(req.user, msg, autoAccept, ownerIsIncluded);
			});
	}else
	{ 
		var reply = {error:"unknown_msg"};
		res.send(JSON.stringify(reply));
	}	
}


function jot_add(user, msg, autoAccept, callback)
{
	rmsg = {error: false};
	var db = easydb();
	
	var now = new moment();
	now.utc();
	var expiry = new moment(msg.expiryTime, "YYYY-MM-DD HH:mm:ss Z");
	expiry.utc();
	var endTime = expiry.clone();
	endTime.date(endTime.date() + msg.duration.days);
	endTime.hour(endTime.hour() + msg.duration.hours);		
	endTime.minute(endTime.minute() + msg.duration.mins);		

	db
	.query(function()
		{
			return {query: "select friendid, auto_accept from friends where userid=? and friendid in " +
				           "(?)", 
				params: [user.internalId, msg.userids]};
		})
	.success(function(rows)
		{
			//quietly replace the userids...
			if(msg.userids.indexOf(user.internalId) >= 0)
				msg.userids = [user.internalId];
			else
				msg.userids = [];
			for(var i =0;i<rows.length;i++)
			{
				msg.userids.push(rows[i].friendid);
				autoAccept[rows[i].friendid] = rows[i].auto_accept[0];
			}
		});
	var isPeriodic = msg.isPeriodic ? 1 : 0;
	var allowRejot = msg.allowRejot ? 1 : 0;
	var periodid = null;
	if(isPeriodic)
	{
		db
		.query( function()
			{
				return {
					query:"insert into periods(type, day_or_date, offset_or_month, hour, min) " +
					       "values(?, ?, ?, ?, ?)",
					params:[msg.periodDesc.type, msg.periodDesc.day_or_date, msg.periodDesc.offset_or_month,
					        msg.periodDesc.hour, msg.periodDesc.min]
				};
			})
		 .success( function(rows)
			{
			 	periodid = rows.insertId;
			}
		  );
	}
	
    var jot_users_insert_suffix = "";
    var jot_users_insert_values = [];

	rmsg.jotid = null;
	rmsg.jot = msg.jot;
	rmsg.creationTime = now.format("YYYY-MM-DD HH:mm:ss Z");
	rmsg.localid = msg.localid;

    var ownerIsIncluded = true;
	
	 db
	.query( function()
		{
			return {query: "insert into jots(ownerid, creation_time, jot, type, expiry_time, allow_rejot, " + 
				           "status, activity_end_time, is_periodic, periodid)" + 
				           "values (?, UTC_TIMESTAMP(), ?, 'R', ?, ?, 'A', ?, ?, ?)", 
				     params: [user.internalId, msg.jot, expiry.format("YYYY-MM-DD HH:mm:00"), 
				              allowRejot, endTime.format("YYYY-MM-DD HH:mm:00"), isPeriodic, 
				              periodid] 
				};
		})
	.success(function(rows)
		{
			rmsg.jotid = rows.insertId;
			msg.jotid = rows.insertId;
			msg.ownerid = user.internalId;
		    var sqlNow =now.format("YYYY-MM-DD HH:mm:ss");
		    
		    msg.receivedTime = now.format("YYYY-MM-DD HH:mm:ss Z");
		    		    
		    if(msg.userids.indexOf(user.internalId) < 0)
		    {
		    	msg.userids.push(user.internalId);
		    	ownerIsIncluded = false;
		    }

		    for(var i =0;i< msg.userids.length;i++)
		    {
		    	if(i > 0)
		    		jot_users_insert_suffix += ", ";
		    	if(msg.userids[i] == user.internalId)
		    	{
		    		if(ownerIsIncluded)
		    			jot_users_insert_suffix += "(?, ?, ?, 0, 1)";
		    		else
		    			jot_users_insert_suffix += "(?, ?, ?, 1, 1)";		    			
		    	}
		    	else
		    	if(autoAccept[msg.userids[i]])
		    		jot_users_insert_suffix += "(?, ?, ?, 0, 1)";
		    	else
		    		jot_users_insert_suffix += "(?, ?, ?, 0, 0)";
		    	jot_users_insert_values.push(msg.userids[i]);
		    	jot_users_insert_values.push(rmsg.jotid);
		    	jot_users_insert_values.push(sqlNow);
		    }			
		})
	.query(function()
		{		
			return {
				query: "insert into jot_users(userid, jotid, received_time, is_owner_entry, has_accepted) values " +
						jot_users_insert_suffix,
				params : jot_users_insert_values
			};
		})
	.done(function()
		{
			rmsg.error = false;
			rmsg.type = 'jotadd';
			callback(rmsg, ownerIsIncluded);
		})
	.error(function(err)
		{
			logger.error("Error adding jot: " + JSON.stringify(msg));
			rmsg.error = "DB error";
			callback(rmsg, false);
		})
	.execute({transaction:true});	
}

/*
function jot_notify(user, jot, autoAccept, ownerIsIncluded)
{
	var redisSession = redisClient(RedisType.SESSION);	
	
	var recipients = [];

	recipients = jot.userids;
			
	var multi = redisSession.multi();
	
	for(var i =0;i < recipients.length;i++)
	{
		multi.ttl(RedisPrefix.USER + recipients[i]);
	}
	
	
	multi.exec(function(err, entries)
		{
			var notify = [];
			
			for(var i =0;i<recipients.length;i++)
			{
				if(entries[i] > 0)  
				{				
					notify.push(recipients[i]);
				}
			}
			
			if(notify.length > 0)
			{
				//now that we got the list of users to notify we can remove the owner if 
				//owner is not a jot recipient.
				var k = jot.userids.indexOf(user.internalId);
				if(k >= 0 && !ownerIsIncluded)
					jot.userids.splice(k, 1);
				jot_notify_0(jot, notify, autoAccept);
			}
		}
	);
	
}*/

function jot_notify(user, jot, autoAccept, ownerIsIncluded)
{
	//simpler notify - try notifying everyone on the userid list
	//if they're not logged in sessionkeyset will be empty
	var redisSession = redisClient(RedisType.SESSION);	
	
	var notify = [];

	for(var i =0;i<jot.userids.length;i++)
		notify.push(jot.userids[i]);

	if(notify.length > 0)
	{
		//now that we got the list of users to notify we can remove the owner if 
		//owner is not a jot recipient.
		var k = jot.userids.indexOf(user.internalId);
		if(k >= 0 && !ownerIsIncluded)
			jot.userids.splice(k, 1);
		jot_notify_0(jot, notify, autoAccept);
	}		
}

function jot_notify_0(jot, notify, autoAccept) //add jot to cache
{
	jot.localid = null;
	var redisJot = redisClient(RedisType.JOT);
	
	//replace userids list with users object.
	jot.users = {};
	for(var i =0;i< jot.userids.length;i++)
	{
		var userinfo = {status: 'A', hasAccepted: autoAccept[jot.userids[i]]};
		jot.users[jot.userids[i]] = userinfo;
	}
	delete jot.userids;
	var key = RedisPrefix.JOT + jot.jotid;
	//console.log(JSON.stringify('notify:' + notify));
    redisJot.setex(
	        key,
	    	config.JOT_CACHE_EXPIRY,
	    	JSON.stringify(jot)
	      , function(err)
	    	{
	        	if(err) 
	        		logger.error("Redis error. Cannot update jot cache for " + jot.jotid + 
	        				      ". Error: " + err);	        	
	        	else
	        		jot_notify_1(jot, notify, autoAccept);
	    	}
	);
}

function jot_notify_1(jot, notify, autoAccept)//convert userids to sessionids
{
	var redisSession = redisClient(RedisType.SESSION);
	var multi = redisSession.multi();
	
	for(var i =0;i<notify.length;i++)
	{
		multi.smembers(RedisPrefix.SESSION_KEY_SET + notify[i]);
	}
	
	multi.exec(
		function(err, sessions)
		{
			var flat_sessions = [];
			var autoAcceptBySession = [];
			
			//logger.debug("session: " + JSON.stringify(flat_sessions));
			if(err)
				logger.error("Redis error. Cannot get session key sets for jot " + jot.jotid +
						". Error: " + err);
			else
			{
				for(var i=0;i<sessions.length;i++)
				{
					for(var j=0;j<sessions[i].length;j++)
					{
						flat_sessions.push(sessions[i][j]);
						autoAcceptBySession.push(autoAccept[notify[i]]);
					}
				}
				jot_notify_2(jot, flat_sessions, autoAcceptBySession);
			}
		}
	);
}

function jot_notify_2(jot, sessions, autoAcceptBySession) 
{
	var redisNotify = redisClient(RedisType.NOTIFY);
	//note: we are setting isOwnerEntry for everyone - clients should ignore isOwnerEntry
	//if not owner.
	var note = {type: 'jot', jotid: jot.jotid, autoAccept: false};
	var multi = redisNotify.multi();
	
	var expiry = config.SESSION_EXPIRY;
	
	
	logger.debug("notify Qs for jot: " + jot.jotid + " = " + JSON.stringify(sessions));
	
	for(var i =0;i<sessions.length;i++)
	{
		note.autoAccept = autoAcceptBySession[i];
		var notetxt = JSON.stringify(note);
		var key = RedisPrefix.NOTIFY_Q + sessions[i];
		multi.rpush(key, notetxt);
		multi.expire(key, expiry);
		multi.publish(RedisPrefix.CHANNEL + sessions[i], 'jot');
	}
	
	multi.exec(function(err, entries)
			{
				if(err)
					logger.error("Redis error. Cannot send notification for " + 
							     JSON.stringify(notify) + ". Error: " + err);
			});
	
}

exports.jot_add = jot_add;
