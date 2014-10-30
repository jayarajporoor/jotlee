var jot_nameCache_by_name = {};//name_lc: {displayName : 'x', userid : y, userName: 'z'}
var jot_nameCache_by_id = {};
function jot_name_cache_put(n, v, id)
{
	var rec = {userName:n, displayName:v, userid: id};
	jot_nameCache_by_name[n.toLowerCase()] = rec;
	jot_nameCache_by_id[id] = rec; 
}

function jot_name_cache_get(n)
{
	return jot_nameCache_by_name[n.toLowerCase()];
}

function jot_name_cache_get_by_id(id)
{
	return jot_nameCache_by_id[id];
}

function jot_name_cache_put_me(n, v, id)
{
	var rec = {userName:n, displayName:v, userid: id};
	jot_nameCache_by_name['me'] = rec;
	jot_nameCache_by_id[id] = rec; 
}

function jot_name_cache_pull_by_name(toPull, parsedJot, reqId, callback, nRetries)
{
	var maxRetries = 5;
	var v = JSON.stringify(toPull);	
	$.ajax( {
		type: "POST",
		url : "/user/translate_names",
		contentType: "application/json",
		data : v,
		statusCode: {
			401 : function(){window.location = '/';}
		}
		} ).done(function(reply)
			{
				for(var k in reply)
				{					
					jot_nameCache_by_name[k] = reply[k];
					jot_nameCache_by_id[reply[k].userid] = reply[k]; 
				}
				for(var i =0;i<parsedJot.displayNames.length;i++)
				{
					if(parsedJot.displayNames[i].charAt(0) == '@')
					{
						var n = parsedJot.displayNames[i].substring(1).toLowerCase();
						if(jot_nameCache_by_name[n])
						{
							parsedJot.displayNames[i] = jot_nameCache_by_name[n].displayName;
							parsedJot.userids.push(jot_nameCache_by_name[n].userid);
						}
						else
							parsedJot.displayNames[i] = "<span style='color:red'>" + 
											parsedJot.displayNames[i].substring(1) + 
											"</span>";
					}
				}
				callback(parsedJot, reqId, true);				
			}
		).
		fail(function(xhr, status, err) {
			if(xhr.status == 401)
				window.location = "/";
			else
			{
				if(nRetries < maxRetries)
				{
					callback(parsedJot, reqId, false);					
					setTimeout(
	            		function(){jot_name_cache_pull_by_name(toPull, parsedJot, reqId, callback, nRetries+1);}
	            		, 5000);					
				}else
				{
					for(var i =0;i<parsedJot.displayNames.length;i++)
					{
						if(parsedJot.displayNames[i].charAt(0) == '@')
						{
							parsedJot.displayNames[i] = "<span style='color:red'>" + 
										parsedJot.displayNames[i].substring(1) + 
											  "</span>";
						}
					}
					callback(parsedJot, reqId, true);
				}
			}
		});	
}


function jot_name_cache_translateNames(parsedJot, reqId, callback)
{
	var names = parsedJot.people;
	parsedJot.displayNames = [];
	parsedJot.userids = [];
	var notFound = [];
	for(var i =0;i< names.length; i++)
	{
		if(jot_nameCache_by_name[names[i].toLowerCase()])
		{
			var v = jot_nameCache_by_name[names[i]].displayName;
			var id = jot_nameCache_by_name[names[i]].userid;			
			parsedJot.displayNames.push(v);
			parsedJot.userids.push(id);
		}else
		{
			parsedJot.displayNames.push('@'+names[i]);
			notFound.push(names[i]);
		}
	}
	
	if(notFound.length > 0)
	{
		callback(parsedJot, reqId, false);		
		jot_name_cache_pull_by_name(notFound, parsedJot, reqId, callback, 0);
	}else
		callback(parsedJot, reqId, true);
}


function jot_name_cache_pull_by_id(toPull, parsedJot, reqId, callback, nRetries)
{
	var maxRetries = 5;
	var v = JSON.stringify(toPull);	
	$.ajax( {
		type: "POST",
		url : "/user/translate_ids",
		contentType: "application/json",
		data : v,
		statusCode: {
			401 : function(){window.location = '/';}
		}
		} ).done(function(reply)
			{
				for(var k in reply)
				{					
					jot_nameCache_by_name[k] = reply[k];
					jot_nameCache_by_id[reply[k].userid] = reply[k]; 
				}
				
				for(var i =0;i<toPull.length;i++)
				{
					var cacheEntry = jot_nameCache_by_id[toPull[i]];
					if(cacheEntry)
					{
						if(parsedJot.users[toPull[i]])
							parsedJot.users[toPull[i]].displayName = cacheEntry.displayName;
						
						if(toPull[i] == parsedJot.ownerid)
							parsedJot.ownerInfo = {displayName: cacheEntry.displayName, 
												   userName: cacheEntry.userName};						
					}
				}
				callback(parsedJot, reqId, true);				
			}
		).
		fail(function(xhr, status, err) {
			if(xhr.status == 401)
				window.location = "/";
			else
			{
				if(nRetries < maxRetries)
				{
					callback(parsedJot, reqId, false);					
					setTimeout(
	            		function(){jot_name_cache_pull_by_id(toPull, parsedJot, reqId, callback, nRetries+1);}
	            		, 5000);					
				}else
				{
					callback(parsedJot, reqId, true);
				}
			}
		});	
}

function jot_name_cache_translateUserids(parsedJot, reqId, callback)
{
	parsedJot.displayNames = [];
	var users = parsedJot.users;
	var notFound = [];

	for(var userid in users)
	{
		if(jot_nameCache_by_id[userid])
		{
			var n = jot_nameCache_by_id[userid].displayName;		
			users[userid].displayName  = n;
		}else
		{
			notFound.push(userid);
		}
	}

	if(jot_nameCache_by_id[parsedJot.ownerid])
	{
		var n = jot_nameCache_by_id[parsedJot.ownerid].displayName;		
		var m = jot_nameCache_by_id[parsedJot.ownerid].userName;		
		parsedJot.ownerInfo = {displayName: n, userName: m};		
	}else
	if($.inArray(parsedJot.ownerid, notFound) < 0)
		notFound.push(parsedJot.ownerid);
	
	if(notFound.length > 0)
	{
		callback(parsedJot, reqId, false);		
		jot_name_cache_pull_by_id(notFound, parsedJot, reqId, callback, 0);
	}else
		callback(parsedJot, reqId, true);
}