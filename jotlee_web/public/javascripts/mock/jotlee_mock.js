var isMocking = false;

var pollResp = {
	    type: 'rpoll',
	    recentJots:[],
	    upcomingJots: [],
	    currentUser: {name: 'test', displayName: "Test User", id: 0}
	  };

$(function(){
	if(!utils_qs['mocking'])
	{
		return;
	}else
		isMocking = true;
	
	$.mockjax({
	url: '/jot/poll',
    responseTime: 750,
    response: mockPollResponse
   });
	
	$.mockjax({
		url: '/user/teams',
	    responseTime: 750,
	    response: mockTeamsResponse
	   });
	
});

function mockPollResponse(req) {
	var data = JSON.parse(req.data);
	pollResp.recentJots = [];
	pollResp.upcomingJots = false;
	if(data.firstPoll)
	{
		jot_name_cache_put('testb', 'Test User B', 1)
    	pollResp.upcomingJots = [];    		
		var m = new moment();
		m.utc();
		var jot ={"jotid":1, "jot":"@jayaraj @ambadi test jot served by mockjax @1240",
				  "receivedTime":m.format("YYYY-MM-DD HH:mm:ss Z"),
				  "expiryTime":m.format("YYYY-MM-DD HH:mm:ss Z"),
				  "activityEndTime":m.format("YYYY-MM-DD HH:mm:ss Z"),
				  "hasAccepted":1,
				  "status":"A",
				  "ownerid":0,
				  "users":{"0":{"status":"A","hasAccepted":1},"1":{"status":"C","hasAccepted":1}}};
		pollResp.recentJots.push(jot);
		for(var i=0;i< 10;i++)
		{
			var jot1 = $.extend({}, jot);
			jot1.jotid = i+2;
			pollResp.recentJots.push(jot1);
		}
		//pollResp.upcomingJots.push(jot);
	}
	this.responseText = JSON.stringify(pollResp);
}

function mockTeamsResponse(req)
{
	var resp = {teams: {1: {name: "jotlee", desc: "Jotlee Core", users:[1]}, 2: {name: "sskzm91", desc: "SSKZM 91", users:[2]}}, 
			    users: {1: {name: "jayaraj", displayName: "Jayaraj Poroor"}, 
			    		2: {name: "jrajp2184", displayName: "Jay"}} 
	           };	
	this.responseText = JSON.stringify(resp);
}