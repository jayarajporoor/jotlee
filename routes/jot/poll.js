exports.index = function(req, res)
{
	if(req.user == null || !req.user.name)
	{
		res.send('Unauthorized', 401);
		logger.warn("unauthorized poll");
	}else
	{
		var msg = req.body;
		var reply = {type: 'rpoll', recentJots: [], accepts:[]};
		
		if(msg.type == 'fetch_upcoming')
		{
			fetch_upcoming_from_db(msg.count, req.user.internalId, msg.since, 
					function(upcomingJots)
					{
						reply.type = 'fetch_upcoming';
						reply.upcomingJots = upcomingJots;
						res.set("Content-Type", "application/json");
						var content = JSON.stringify(reply);
						logger.debug("since: " + JSON.stringify(msg.since));
						logger.debug("fetch_upcoming: " + content);
						res.send(content);
					});						
			return;
		}

		if(msg.firstPoll)
		{
			reply.currentUser = {name: req.user.name, displayName: req.user.displayName, id: req.user.internalId, 
					            email: req.user.email};
			var sync = new events.EventEmitter();
			update_session_key_set(req,
				function(err)
				{
					if(err)
					{
						reply.error = "server_err";						
						//reply after a delay						
						setTimeout(function(){
							res.send(JSON.stringify(reply));
						}, 5000);
						sync.emit('recent_fetched', 'error');//this will clear the recent_fetched handler
						return;//don't fetch_recent_from_db
					}
					
					fetch_recent_from_db(10, req.user.internalId, 
							function(recentJots)
							{
								reply.recentJots = recentJots;
								/*if(reply.recentJots.length > 0)
									reply.sinceJotIdFromNotifyQ = reply.recentJots[reply.recentJots.length-1].jotid;
								else*/ 
								reply.sinceJotIdFromNotifyQ = -1;
								sync.emit('recent_fetched', false);
							}
						);
				});
			sync.on('recent_fetched', function(err)
				{
					if(err)
						return;
					
					fetch_upcoming_from_db(10, req.user.internalId, null, 
							function(upcomingJots)
							{
								reply.upcomingJots = upcomingJots;
								res.set("Content-Type", "application/json");
								var content = JSON.stringify(reply);
								res.send(content);
							});
				});
		}else
		{
			var sessionid = utils.get_session_id_fast(req);
			if(!sessionid)
			{
				logger.error("Couldn't get session id for user: " + user.internalId);
				//reply after some time.
				reply.error = "server_error";
				setTimeout(function(){
						res.send(JSON.stringify(reply));
					}, 5000);
			}else
			{
				var redisSession = redisClient(RedisType.SESSION);
				var redisNotify  = redisClient(RedisType.NOTIFY);
				var sessionKeySet = RedisPrefix.SESSION_KEY_SET + req.user.internalId;				
				redisSession.expire(sessionKeySet, config.SESSION_EXPIRY);
				var notifyQ = RedisPrefix.NOTIFY_Q + sessionid;
				redisNotify.expire(notifyQ, config.SESSION_EXPIRY);

				var notifyAction = {fetch: false, skipped : false};
				
				req.on('close', function()
						{
							logger.debug("poll: connection closed unexpectedly");
							notifyAction.fetch = false;
						});
				req.on('end', function()
						{
							notifyAction.fetch = false;
						});

				var reply = {type: 'rpoll', recentJots: [], accepts:[], cancels: [], dones: [], 
						     sinceJotIdFromNotifyQ: msg.sinceJotIdFromNotifyQ};
				
				notify.notify_add(RedisPrefix.CHANNEL + sessionid,
						function(chMsg)
						{
							logger.debug("message received on: " + sessionid + " channel. fetch: " + notifyAction.fetch);
							if(notifyAction.fetch)//fetch only if is safe and required to do so
							{
								if(chMsg == 'jot' || chMsg == 'action')
									fetch_and_send_updates(msg, reply, req.user.internalId, sessionid, res, notifyAction, true);
								else
								if(chMsg == 'timeout')
								{
									reply.sinceJotIdFromNotifyQ = -1;
									res.send(JSON.stringify(reply));
								}
								else
								{
									logger.error("unknown message on channel for session: " + sessionid);
									//send empty response for now
									res.send(JSON.stringify(reply));
								}
							}else
								notifyAction.skipped = true;
						});
				fetch_and_send_updates(msg, reply, req.user.internalId, sessionid, res, notifyAction, false);
			}
		}
	}
}

function fetch_and_send_updates(msg, reply, userid, sessionid, res, notifyAction, respondAnyway)
{
	var sinceJotId = msg.sinceJotIdFromNotifyQ;
	
	var notifyQ = RedisPrefix.NOTIFY_Q + sessionid;
	fetch_jots(userid, notifyQ, sinceJotId, reply, 
			function()
			{
				if(reply.recentJots.length > 0 || reply.accepts.length > 0 || notifyAction.skipped || respondAnyway)
				{
					logger.debug("fetch jots done for session: " + sessionid + ", sinceJotidFromNotifyQ:" + sinceJotId + ", fromNotify: " + respondAnyway);					
					res.set("Content-Type", "application/json");
					res.send(JSON.stringify(reply));
					notify.notify_remove(RedisPrefix.CHANNEL + sessionid);
				}else
				{
					logger.debug("fetch did not return anything for user: " + userid + ", session: " + sessionid + ". Waiting for notify.");
					msg.sinceJotIdFromNotifyQ = -1; //the Q must be empty now - need to clear
					//otherwise a jot add followed by accept/cancel/done won't work
					notifyAction.fetch = true;
				}
			});
}

function fetch_jots(userid, notifyQ, sinceJotId, reply, callback)
{
	var maxFetch = 10;
	var largeIndex = 10000;
	
	var redisNotify = redisClient(RedisType.NOTIFY);

	logger.debug("sinceJotId in request: " + sinceJotId);
	
	if(!sinceJotId)
		sinceJotid = -1;//an invalid jotid
	
	redisNotify.lrange(notifyQ, 0, largeIndex, function(err, sJotInfos)
			{
				if(err)
				{
					logger.error("redis error lrange on notify queue failed for: " + notifyQ + ", error:" + err);
					reply.error = "DB error";
					callback();
					return;
				}
				
				//no need we're doing rpush now: sJotInfos = sJotInfos.reverse();
				
				logger.debug("sJotInfos:" + JSON.stringify(sJotInfos));
								
				var sinceIndex = -1;
				for(var i=0;i<sJotInfos.length;i++)
				{
					var jotInfo = JSON.parse(sJotInfos[i]);
					sJotInfos[i] = jotInfo;
					if( (jotInfo.jotid == sinceJotId) && (sinceIndex < 0) )
						sinceIndex = i;
				}
				
				logger.debug("sinceJotid: " + sinceJotId + ", sinceIndex: " + sinceIndex);

				var nJots = sJotInfos.length;
				var nToBeRemoved = sinceIndex + 1;

				var ctx = new events.EventEmitter();
				ctx.toBeFetched = nJots - nToBeRemoved;
				if(ctx.toBeFetched > maxFetch)
					ctx.toBeFetched = maxFetch;

				var resetSinceId = true;
				var c = 0;
				for(var k=sinceIndex+1; k < nJots;k++)
				{					
					if(c >= ctx.toBeFetched)
						break;
					c++;
					var jotInfo = sJotInfos[k];
					logger.debug("Got jotInfo: " + JSON.stringify(sJotInfos[k]) + " from notifyQ: " + notifyQ);					
					if(jotInfo.type =='jot' && jotInfo.jotid)
					{
						fetch_cached_jot(jotInfo, reply, ctx);
					}else
					if(jotInfo.type == 'accept')
					{
						ctx.toBeFetched--; //one less to fetch from cache
						resetSinceId = false;
						if(jotInfo.userid == userid)
						{
							if(!reply.pendingJots)
								reply.pendingJots = [];							
							reply.pendingJots.push(jotInfo.jotid);
						}
						logger.debug("jot pushed to accepts list: " + jotInfo.jotid);
						reply.accepts.push({jotid: jotInfo.jotid, userid:  jotInfo.userid});
					}else
					{
						ctx.toBeFetched--; //other types of actions perhaps
						resetSinceId = false;
						if(jotInfo.type == 'cancel')
						{
							logger.debug("jot pushed to cancels list: " + jotInfo.jotid);							
							reply.cancels.push({jotid:jotInfo.jotid, userid: jotInfo.userid});
						}
						else
						if(jotInfo.type == 'done')
							reply.dones.push({jotid:jotInfo.jotid, userid: jotInfo.userid});
						
					}
					if(jotInfo.jotid)
						reply.sinceJotIdFromNotifyQ = jotInfo.jotid; //keep updating till last.
					else
					{
						logger.error("Invalid entry in notify Q. No jotid found: " + JSON.stringify(jotInfo));
						//TODO - perhaps clear the Q?
					}
			
				}				
				
				ctx.on('done_fetch', function(){
					ctx.removeAllListeners('done_fetch');					
					update_notify_Q(notifyQ, nToBeRemoved, ctx);
				});
				
				ctx.on('done_update_q', function(){
					ctx.removeAllListeners('done_update_q');					
					if(reply.pendingJots && reply.pendingJots.length > 0)
					{
						fetch_pending_jots(userid, reply, callback);
					}else					
						callback();
				});
				
				if(ctx.toBeFetched <= 0)
				{
					if(resetSinceId)
					{
						logger.debug("Setting sinceJotId to -1");						
						reply.sinceJotIdFromNotifyQ = -1;
					}
					ctx.emit('done_fetch');
				}

			});
}

function update_notify_Q(notifyQ, nPop, ctx)
{
	
	if(nPop <= 0)
	{
		ctx.emit('done_update_q');
		return;
	}
	
	var redisNotify = redisClient(RedisType.NOTIFY);
	
	redisNotify.lpop(notifyQ,function(err)
			{
				if(err)
				{
					logger.error("redis Error: cannot do rpop from notifyQ: " + notifyQ);
				}
				update_notify_Q(notifyQ, nPop-1, ctx);
			});
}

function fetch_cached_jot(jotInfo, reply, ctx)
{
	var jotid = jotInfo.jotid;
	var redisJot = redisClient(RedisType.JOT);
	var jotkey = RedisPrefix.JOT + jotid;
	redisJot.get(jotkey, function(err, jotxt)
			{
				if(err)
				{
					logger.error("Redis Error - getting jot: " + jotid);
					reply.error = "DB error";
				}else
				if(jotxt)
				{
					jot = JSON.parse(jotxt);
					jot.hasAccepted = jotInfo.autoAccept;
					jot.status = 'A'; //this is a new jot which is active by default
					//jot.isOwnerEntry = jotInfo.isOwnerEntry;
					reply.recentJots.push(jot);
				}else
				{
					jot = {jotid: jotid, dataPending: true};
					reply.recentJots.push(jot);
					if(!reply.pendingJots)
						reply.pendingJots = [];
					reply.pendingJots.push(jotid);
				}
				ctx.toBeFetched--;
				if(ctx.toBeFetched <=0)
				{
					ctx.emit('done_fetch');
				}
			});
}


function fetch_pending_jots(userid, reply, callback)
{
	var db = easydb();
	
//	logger.debug("reply: " + JSON.stringify(reply));
	
	db.query(function()
		{
			return { query: "select jots.jotid, jots.jot, jots.expiry_time, jots.ownerid, " + 
							"jots.activity_end_time, jots.is_periodic, jots.periodid, " + 
							"jot_users.received_time, jot_users.status, jot_users.has_accepted from jots " + 
				            " inner join jot_users on jots.jotid = jot_users.jotid " +
				            " where (jot_users.userid = ?) and jots.jotid in (?)",
				     params: [userid, reply.pendingJots]
			};
		})
	   .success(function(rows)
		{
		   var periodics = {};
		   var periodids = [];
		   var jotids = [];
		   var jots_by_ids = {};
		   for(var i =0;i<rows.length;i++)
		   {
			  var m = moment_from_db_date(rows[i].expiry_time);
			  m.utc();
			  var n = moment_from_db_date(rows[i].activity_end_time);
			  n.utc();
			  var p = moment_from_db_date(rows[i].received_time);
			  p.utc();
			  jotids.push(rows[i].jotid);
			  var jot = {jotid: rows[i].jotid, 
					     jot: rows[i].jot,
					     receivedTime: p.format("YYYY-MM-DD HH:mm:ss Z"),
					     expiryTime: m.format("YYYY-MM-DD HH:mm:ss Z"),
					     activityEndTime: n.format("YYYY-MM-DD HH:mm:ss Z"),
					     hasAccepted: rows[i].has_accepted[0],
					     status: rows[i].status,
					     //isOwnerEntry: rows[i].is_owner_entry,
					     ownerid: rows[i].ownerid,
					     users : {}
					     };
			  jots_by_ids[jot.jotid] = jot;
			  
			  var found = false;
			  for(var j=0;j< reply.recentJots.length;j++)
			  {
				  if(reply.recentJots[j].jotid == jot.jotid)//replace the pending jot
				  {
					  reply.recentJots[j] = jot;
					  found = true;
				  }
			  }
			  
			  if(!found)
			  {
				  logger.error("BUG: Couldn't find pending jot");
			  }

			  if(rows[i].is_periodic)
			  {
				  periodids.push(rows[i].periodid);
				  periodics[rows[i].periodid] = jot;
			  }
		   }
		   
		   if(periodids.length > 0)
		   {
			   db
			   .query(function()
				{					   
					return {query: "select periodid, type, day_or_date, offset_or_month, hour, min from periods where " +
					               " periodid in ( ? )",
					        params: periodids};
				 })
			   .success(function(rows)
			   {
				   for(var i =0;i< rows.length; i++)
				   {
					   var v = {type: rows[i].type, day_or_date: rows[i].day_or_date, 
							   offset_or_month: rows[i].offset_or_month, hour: rows[i].hour, min: rows[i].min};
					   periodics[rows[i].periodid].isPeriodic = true;
					   periodics[rows[i].periodid].periodDesc = v;
				   }
			   });
		   }
		   
		   if(jotids.length > 0)
		   {
			   db
			   .query(function()
					 {
				   		return {query: "select jotid, userid, has_accepted, status, is_owner_entry from jot_users where jotid in ( ? )",
					   	   params : [jotids]};
					 })
			   .success(function(rows)
					 {
				   		for(var i =0;i<rows.length;i++)
				   		{
				   			if(rows[i].is_owner_entry[0] != 1)
				   				jots_by_ids[rows[i].jotid].users[rows[i].userid] = 
				   					{status:rows[i].status, hasAccepted: rows[i].has_accepted[0]};
				   		}
					 });
		   }
		})
		.done(function()
			{
				delete reply.pendingJots;
				callback();
			})
		.error(function(err)
			{
				reply.error = "db_error";
				callback();
			})
		.execute();
		
}


function fetch_recent_from_db(limit, userid, callback)
{
   var recentJots = [];

	var db = easydb();
	
	db.query(function()
		{
			return { query: "select jots.jotid, jots.jot, jots.expiry_time, jots.ownerid, " + 
							"jots.activity_end_time, jots.is_periodic, jots.periodid, " + 
							"jot_users.received_time, jot_users.status, jot_users.has_accepted  from jots " + 
				            " inner join jot_users on jots.jotid = jot_users.jotid " +
				            " where (jot_users.userid = ?) order by jot_users.received_time DESC limit " + limit,
				     params: [userid]
			};
		})
	   .success(function(rows)
		{
		   var periodics = {};
		   var periodids = [];
		   var jotids = [];
		   var jots_by_ids = {};
		   for(var i =0;i<rows.length;i++)
		   {
			  var m = moment_from_db_date(rows[i].expiry_time);
			  m.utc();
			  var n = moment_from_db_date(rows[i].activity_end_time);
			  n.utc();
			  var p = moment_from_db_date(rows[i].received_time);
			  p.utc();
			  jotids.push(rows[i].jotid);
			  var jot = {jotid: rows[i].jotid, 
					     jot: rows[i].jot,
					     receivedTime: p.format("YYYY-MM-DD HH:mm:ss Z"),
					     expiryTime: m.format("YYYY-MM-DD HH:mm:ss Z"),
					     activityEndTime: n.format("YYYY-MM-DD HH:mm:ss Z"),
					     hasAccepted: rows[i].has_accepted[0],
					     status: rows[i].status,
					     ownerid: rows[i].ownerid,
					     //isOwnerEntry: rows[i].is_owner_entry[0],
					     users: {}
					     };
			  jots_by_ids[jot.jotid] = jot;
			  recentJots.push(jot);

			  if(rows[i].is_periodic)
			  {
				  periodids.push(rows[i].periodid);
				  periodics[rows[i].periodid] = jot;
			  }
		   }
		   
		   if(periodids.length > 0)
		   {
			   db
			   .query(function()
				{					   
					return {query: "select periodid, type, day_or_date, offset_or_month, hour, min from periods where " +
					               " periodid in ( ? )",
					        params: [periodids]};
				 })
			   .success(function(rows)
			   {
				   for(var i =0;i< rows.length; i++)
				   {
					   var v = {type: rows[i].type, day_or_date: rows[i].day_or_date, 
							   offset_or_month: rows[i].offset_or_month, hour: rows[i].hour, min: rows[i].min};
					   periodics[rows[i].periodid].isPeriodic = true;
					   periodics[rows[i].periodid].periodDesc = v;
				   }
			   });
		   }
		   
		   if(jotids.length > 0)
		   {
			   db
			   .query(function()
					 {
				   		return {query: "select jotid, userid, has_accepted, status, is_owner_entry from jot_users where jotid in ( ? )",
					   	   params : [jotids]};
					 })
			   .success(function(rows)
					 {
				   		for(var i =0;i<rows.length;i++)
				   		{
				   			if(rows[i].is_owner_entry[0] != 1)
				   			{
				   				jots_by_ids[rows[i].jotid].users[rows[i].userid] = 
				   						{status: rows[i].status, hasAccepted: rows[i].has_accepted[0]};
				   			}
				   		}
					 });
		   }
		})
		.done(function()
			{			   
				callback(recentJots.reverse());
			})
		.error(function(err)
			{
				callback(recentJots.reverse());
			})
		.execute();
		
}

function update_session_key_set(req, callback) //updates session key set - also clears notifyQ for the session
{
	var redisSession = redisClient(RedisType.SESSION);
	var sessionid = utils.get_session_id_fast(req);;
	if(!sessionid)
	{
		logger.error("Couldn't retrieve sessionid from cookies: " + JSON.stringify(req.cookies));
		//try loading from database...
		callback("session_id_fetch_error");
		return;
	}
	var sessionKeySet = RedisPrefix.SESSION_KEY_SET + req.user.internalId;
	var notifyQ = RedisPrefix.NOTIFY_Q + sessionid;
	
	redisSession.smembers(sessionKeySet, 
			function(err, sessions)
			{
				if(err)
				{
					logger.error("Couldn't retrieve session key set for user: " + req.user.internalId + 
									"error: " + err);
					callback(err);
					return;
				}
				var multi = redisSession.multi();
				for(var i =0;i < sessions.length;i++)
				{
					multi.exists(RedisPrefix.SESSION + sessions[i]);
				}
				
				multi.exec(function(err, exists)
					{
						if(err)
						{
							logger.error("Couldn't check if session record exists for user: " + req.user.internalId + 
											", error: " + err);
							callback(err);
							return;
						}
						
						var multi2 = redisSession.multi();
						for(var i=0;i<sessions.length;i++)
						{
							if(!exists[i])
								multi2.srem(sessionKeySet, sessions[i]);
						}
						
						multi2.sadd(sessionKeySet, sessionid);
						multi2.expire(sessionKeySet, config.SESSION_EXPIRY);
						multi2.del(notifyQ);//clear the notifyQ since we are going to load from the DB.
						
						multi2.exec(function(err, result)
							{
								if(err)
								{
									logger.error("Couldn't update session key set for user: " + req.user.internalId + 
											   ", error: " + err);
								}
								callback(err);
							});
					}
				);
			}
	);
}

function fetch_upcoming_from_db(limit, userid, since, callback)
{
   var upcomingJots = [];
   
   if(!since)
   {
	   since = {};
	   var m = new moment();
	   m.utc();
	   m.subtract('minutes', 1);	   
	   since.time = m.format("YYYY-MM-DD HH:mm:ss");
	   since.jotids = [];
   }else
   {
	   logger.debug("Since structure: " + JSON.stringify(since));
	   since.time = new moment(since.time, "YYYY-MM-DD HH:mm:ss Z");
	   since.time.utc();
	   since.time = since.time.format("YYYY-MM-DD HH:mm:ss");
   }
   
   limit = limit + since.jotids.length;//we need to fetch more

	var db = easydb();
	
	db.query(function()
		{
			return { query: "select jots.jotid, jots.jot, jots.expiry_time, jots.ownerid, " + 
							" jots.activity_end_time, jots.is_periodic, jots.periodid, " + 
							" jot_users.received_time, jot_users.has_accepted  from jots " + 
				            " inner join jot_users on jots.jotid = jot_users.jotid " +
				            " where (jot_users.userid = ? and jots.expiry_time >= ? and " + 
				            " jot_users.has_accepted=1 and jot_users.status='A' and jot_users.is_owner_entry = 0) " + 
				            " order by jots.expiry_time ASC limit " + limit,
				     params: [userid, since.time]
			};
		})
	   .success(function(rows)
		{
		   var periodics = {};
		   var periodids = [];
		   var jotids = [];
		   var jots_by_ids = {};
		   for(var i =0;i<rows.length;i++)
		   {
			  var duplicate = false;
			  for(var k=0;k<since.jotids.length;k++)
			  {
				  if(since.jotids[k] == rows[i].jotid)
				  {
					 duplicate = true;
					 break;
				  }
			  }
			  
			  if(duplicate)
				  continue;
			  
			  var m = moment_from_db_date(rows[i].expiry_time);
			  m.utc();
			  var n = moment_from_db_date(rows[i].activity_end_time);
			  n.utc();
			  var p = moment_from_db_date(rows[i].received_time);
			  p.utc();
			  jotids.push(rows[i].jotid);
			  var jot = {jotid: rows[i].jotid, 
					     jot: rows[i].jot,
					     receivedTime: p.format("YYYY-MM-DD HH:mm:ss Z"),
					     expiryTime: m.format("YYYY-MM-DD HH:mm:ss Z"),
					     activityEndTime: n.format("YYYY-MM-DD HH:mm:ss Z"),
					     hasAccepted: rows[i].has_accepted[0],
					     ownerid: rows[i].ownerid,
					     status: 'A', //we are only selecting active entries
					     users: {}
					     };
			  jots_by_ids[jot.jotid] = jot;
			  upcomingJots.push(jot);

			  if(rows[i].is_periodic)
			  {
				  periodids.push(rows[i].periodid);
				  periodics[rows[i].periodid] = jot;
			  }
		   }
		   
		   if(periodids.length > 0)
		   {
			   db
			   .query(function()
				{					   
					return {query: "select periodid, type, day_or_date, offset_or_month, hour, min from periods where " +
					               " periodid in ( ? )",
					        params: [periodids]};
				 })
			   .success(function(rows)
			   {
				   for(var i =0;i< rows.length; i++)
				   {
					   var v = {type: rows[i].type, day_or_date: rows[i].day_or_date, 
							   offset_or_month: rows[i].offset_or_month, hour: rows[i].hour, min: rows[i].min};
					   periodics[rows[i].periodid].isPeriodic = true;
					   periodics[rows[i].periodid].periodDesc = v;
				   }
			   });
		   }
		   
		   if(jotids.length > 0)
		   {
			   db
			   .query(function()
					 {
				   		return {query: "select jotid, userid, status, has_accepted, is_owner_entry " + 
				   			           " from jot_users where jotid in ( ? )",
					   	   params : [jotids]};
					 })
			   .success(function(rows)
					 {
				   		for(var i =0;i<rows.length;i++)
				   		{
				   			if(rows[i].is_owner_entry[0] != 1)
				   				jots_by_ids[rows[i].jotid].users[rows[i].userid] = 
				   						{status: rows[i].status, hasAccepted: rows[i].has_accepted};
				   		}
					 });
		   }
		})
		.done(function()
			{			   
				callback(upcomingJots);
			})
		.error(function(err)
			{
				callback(upcomingJots);
			})
		.execute();
		
}


function moment_from_db_date(d)
{
	return new moment(d);
}