var subscriptions = {};//channel name : {callback fn, timestamp}

var redis=null;
exports.init = function()
{
	redis = redisClient(RedisType.NOTIFY_SUBSCRIBE);
	redis.on('message', process_message);
	setTimeout(process_timeout, (config.NOTIFY_TIMEOUT/2)*1000);
}

exports.notify_add = function(ch, callback)
{
	subscriptions[ch] = {callback: callback, ts: new Date().valueOf()};
	redis.subscribe(ch);
}

exports.notify_remove = function(ch)
{
	if(subscriptions[ch])
	{
		redis.unsubscribe(ch);		
		delete subscriptions[ch];
	}
}

function process_message(channel, message)
{
	logger.debug("Message: " + message + " on " + channel);
	
	if(subscriptions[channel])
	{
		subscriptions[channel].callback(message);
		redis.unsubscribe(channel);
		delete subscriptions[channel];		
	}	
}

function process_timeout()
{
	var now = new Date().valueOf();
	
	for(var ch in subscriptions)
	{
		if ( (now - subscriptions[ch].ts) >= config.NOTIFY_TIMEOUT)
		{
			logger.debug("Timeout. removing notify channel: " + ch);
			subscriptions[ch].callback('timeout');
			delete subscriptions[ch];			
		}
	}
	
	setTimeout(process_timeout, (config.NOTIFY_TIMEOUT/2)*1000);	
}