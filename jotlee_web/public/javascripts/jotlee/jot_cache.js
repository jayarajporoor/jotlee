var jot_cache_recent_max_size = 10;
var jot_cache_older_max_size = 100;
var jot_cache_upcoming_max_size = 10;

//cache order: most recent at the end
var jot_cache_recent = [];

var jot_cache_older = [];

var jot_cache_upcoming = [];
var jot_cache_future = [];

function jot_cache_get_recent()
{
	return jot_cache_recent;
}

function jot_cache_get_recent_by_id(jotid)
{
	for(var i=0;i< jot_cache_recent.length;i++)
	{
		if(jot_cache_recent[i].jotid == jotid)
			return jot_cache_recent[i];
	}
	return null;
}

function jot_cache_get_upcoming_by_id(jotid)
{
	for(var i=0;i< jot_cache_upcoming.length;i++)
	{
		if(jot_cache_upcoming[i].jotid == jotid)
			return jot_cache_upcoming[i];
	}
	return null;
}

function jot_cache_get_upcoming()
{
	return jot_cache_upcoming;
}


function jot_cache_recent_is_empty()
{
	return jot_cache_recent.length == 0;
}

function jot_cache_update_upcoming(upcoming_jots, callback)
{
	var pastThreshold = 1000*60;//include jots expired within a minute
	if(!callback)
	{
		//jot_cache_upcoming.length == 0 must be true.
		jot_cache_upcoming = upcoming_jots;//initial load - no need for callback
		return [];
	}
	
	var userid = jot_name_cache_get('me').userid;
	
	var now = jotlee_now();
	
	for(var i=0;i<upcoming_jots.length;i++)
	{
		var jot = upcoming_jots[i];

		var diffNow = now.diff(jot.expiryMoment);
		if(diffNow > pastThreshold)
			continue;
		
		for(var j=0;j<jot_cache_upcoming.length;j++)
		{
			if(jot_cache_upcoming[j].jotid == upcoming_jots[i].jotid)
			{
				upcoming_jots[i].hasDuplicateInUpcoming = true;
			}
		}
		
		if(upcoming_jots[i].hasDuplicateInUpcoming)
			continue;
		
		var done = false;

		if(!jot.hasAccepted)
			return [];
		if(!jot.users[userid])//owner has received his own jot
			return [];
		if(jot.status != 'A') //only active jots are allowed in the upcoming section
			return [];		
		for(var k=jot_cache_upcoming.length-1;k >=0;k--)
		{
			var diff = jot.expiryMoment.diff(jot_cache_upcoming[k].expiryMoment);
			if(diff > 0)
			{
				if(k < (jot_cache_upcoming_max_size - 1))
				{   //add only if we need to
					callback(jot, jot_cache_upcoming[k].jotid);
					if(k >= (jot_cache_upcoming.length - 1))
						jot_cache_upcoming.push(jot);
					else
						jot_cache_upcoming.splice(k+1, 0, jot);
				}
				done = true;
				break;//don't forget to get out
			}
		}
		
		if(!done)
		{
			callback(jot, false);//prepend
			jot_cache_upcoming.unshift(jot);
		}
	}
	
	var removed_jotids = [];
	var k = jot_cache_upcoming.length - jot_cache_upcoming_max_size;
	while(k > 0)
	{
		var jot = jot_cache_upcoming.pop();
		removed_jotids.push(jot.jotid);
		k--;
	}
	return removed_jotids;
}

function jot_cache_update_recent(recent_jots)
{
	var removed_jotids = [];

	for(var i =0;i< recent_jots.length;i++)
	{
		for(var j=0;j<jot_cache_recent.length;j++)
		{
			if(jot_cache_recent[j].jotid == recent_jots[i].jotid)
			{
				recent_jots[i].hasDuplicateInRecent = true;
			}
		}
		if(!recent_jots[i].hasDuplicateInRecent)		
			jot_cache_recent.push(recent_jots[i]);
	}
	
	var k = jot_cache_recent.length - jot_cache_recent_max_size;
	
	while(k > 0)
	{
		var entry = jot_cache_recent.shift();
		removed_jotids.push(entry.jotid);
		jot_cache_older.push(entry);
		k--;
	}

	k =  jot_cache_older.length - jot_cache_older_max_size;
	
	while(k > 0)
	{
		jot_cache_older.shift();
		k--;
	}
		
	return removed_jotids;
}