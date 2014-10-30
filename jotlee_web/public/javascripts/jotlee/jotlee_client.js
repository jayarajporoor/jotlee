var recentlyExpiredCount = 0;
window.jotlee_time = null;
window.sinceJotIdFromNotifyQ = -1;
var firstPoll = true;
var TabStatus = {CHECKING: 0, LIVE: 1, DISABLED: 2};
var tabStatus = TabStatus.CHECKING;
var liveCounter = 0;
var liveCounterCheckMax = 2;

var activePopup = {name: "", desc: ""};

function myjotReset()
{
	if( $("#myjot").val() == 'Just jot here')
		$('#myjot').val('@me').select();    			
}

function searchReset()
{
	if( $("#search").val() == 'search for jots...')
		$('#search').val('');    			
}

function jot_format_time(m, now)
{
	var diff = 3;
	var ydiff = false;
	if(now.date() == m.date() && now.month() == m.month() && now.year() == m.year())
		diff = 0;
	else
	{
		var now0 = now.clone();
		now0.add(1, 'days');
		if(now0.date() == m.date() && now0.month() == m.month() && now0.year() == m.year())
			diff = 1;		
	}
	
	if(now.year() != m.year())
		ydiff = true;
	
	if(diff == 0)
		return  m.format("h:mm a") + " Today";
	else
	if(diff == 1)
		return m.format("hh:mm a") + " Tomorrow";
	else
	{
		if(ydiff)
			return m.format("hh:mm a dd Do MMM (YYYY)");
		else
			return m.format("hh:mm a ddd Do MMM");
	}
}

function jot_submit(jot, localid, nretries)
{
	var maxRetries = 5;
	var statusId = 'sts_' + localid;
	$('#' + statusId).text("[sending to server...]");
	jot.expiryMoment.utc();
	
	var allowRejot = false;
	//translate @me to username
	
	var username = jot_name_cache_get('me').userName;
	
	jot.jot = jot.jot.replace("@me ", '@' + username + ' ');

	var msg =
	{
		type: 'jot',
		localid: localid,
		jot: jot.jot,
		userids: jot.userids,
		tags: jot.tags,//TODO send tagids
		expiryTime: jot.expiryMoment.format("YYYY:MM:DD HH:mm:00 Z"),
		duration: jot.parsedDuration,
		isPeriodic: jot.isPeriodic,
		periodDesc: jot.periodDesc,
		allowRejot: allowRejot
	};
	jot.expiryMoment.local();//important - change back to local
	var msgTxt =JSON.stringify(msg);

	$.ajax( {
		type: "POST",
		url : "/jot/submit",
		contentType: "application/json",
		data : msgTxt,
		statusCode: {
			401 : function(){window.location = '/';}
		}
		} ).done(function(msg)
			{
				if(msg.error)
					$('#'+statusId).html('[<span style="color:red">error</span>]');
				else
				{
					jot.receivedTime = msg.creationTime;
					jot.jotid = msg.jotid;
					jot.localid = msg.localid;
					$('#'+msg.localid).remove();
					/*var removedJotIds = jot_cache_update_recent([jot]);

					for(var i=0;i<removedJotIds.length;i++)
					{
						$('#jid_' + removedJotIds[i]).remove();
					}*/
					//jot.hasAccepted = true;//it's one's own jot.
					//var now = jotlee_now();
					//jot_add_to_recent(jot, now);
				}
				
			}
		).
		fail(function(xhr, status, err) {
			if(xhr.status == 401)
				window.location = "/";
			else
			{
				if(nretries < maxRetries)
				{
					$('#'+statusId).text('[communication error. retrying....]');				
					setTimeout(
	            		function(){jot_submit(jot, localid, nretries+1);}
	            		, 5000);
				}else
				{
					$('#'+statusId).html('[<span style="color:red">comm error</span>]');
				}
			}
		});
	
	
}


function myjotEnter(event)
{
	var keyCode = event.keyCode || event.which;
	if(keyCode == 13)
	{	
		if(tabStatus != TabStatus.LIVE) return;
		
		var reqId = 1;
		event.preventDefault();
		var localid = "lid_" + new Date().getTime().toString();
		var jotxt = $('#myjot').val();
		jotxt = jotxt.replace(/\s+/g, ' '); //replace newlines with whitespace
		if(jotxt.replace(/\s+/g, '') == '') return;
		var jot = jot_Parse(jotxt);
		var jotxtId = "jotxt_" + localid;
		var skimmedJotId = 'skm_' + localid;
		var parsedPeopleId = "ppl_" + localid;
		var removeId = 'rm_' + localid;
		var approveId = 'apv_' + localid;
		var approveLinkId = 'lnk_apv_' + localid;
		var editId = 'edt_'  + localid;
		var statusId = 'sts_' + localid;
		var periodicId = 'prd_' + localid;
		var durationId = 'dur_' + localid;
		var approveEnabled =false;
		var expInfoId = 'exp_' + localid;
						
		var now = jotlee_now();
		
		var skimmedJot = jot_skim(jotxt);

		var html = 
			"<table  id='" + localid + "' class='approvepending' width='100%' style='padding-right:3px'>" + 
			"<tr><td><img  src='/images/question.jpeg'></td><td>" +
			"<span class='skimmedJot' id='" + skimmedJotId + "'>" + skimmedJot + "</span>" +
			"<span style='float:right'>" + 
			"at <span class='expiryinfo' id='" + expInfoId + "'>" + jot_format_time(jot.expiryMoment, now) + "</span>" +
			"<span class=expiryinfo' id='" + durationId + "'></span>"+
			"</span>" +
			"</td></tr>" +			
			"<tr><td>&nbsp;</td><td><div id='" + jotxtId + "'>" +
			jotxt  +
			"</div></td></tr><tr><td>&nbsp;</td><td>" +
			'<span style="float:left" id="' + statusId + '"></span>' +			
			"<span class='actionbuttons'>" +
			'<span class="disabledactionbutton" id="' + approveId + '">&nbsp;' + 
			 '<a class="buttonlink" href="#" id="' + approveLinkId + '">Create Jot</a>' + 
			 '&nbsp;</span>' +
            "&nbsp;&nbsp; <span class='actionbutton' id='" + removeId + "'>&nbsp;Abort&nbsp;</span>" +
            "&nbsp;&nbsp;<span class='actionbutton' id='" + editId + "'>&nbsp;Edit&nbsp;</span>" +			
			"</span></td></tr>" +
			"<tr> " + 
			"<td colspan='2' class='peopleinfo'>" +
            'To: <span id="' + parsedPeopleId + '"></span>' +  
			 "</td></tr>"+
			"</table>";
					
		 $('#pendingjots').prepend(html);
				
		/*if(parsedJot.isPeriodic)
		{
			$('#' + periodicId).html(jot_format_period(parsedJot));
		}*/
		
		if(jot.hasDuration)
		{
			$('#' + durationId).text(" for " + jot_format_duration(jot));
		}
		
		var retryDots = "";

		$('#myjot').val('@me').select();
				
		jot_name_cache_translateNames(jot, reqId, 
			function(pj, rid, done)
			{
				if(rid != reqId) return;
				
				var t = pj.displayNames.toString();
				if(done)
				{
					$('#'+approveId).removeClass("disabledactionbutton").addClass("actionbutton");
					approveEnabled = true;
					$('#'+approveLinkId).focus();				
				}else
					t = t + "[fetching names"+retryDots +"]";
				retryDots += ".";
				$('#'+parsedPeopleId).html(t);		
			}
		);
		
		$('#' + jotxtId).prop('contentEditable', true);
		
		$('#' + jotxtId).keypress(
				function(event)
				{
					var keyCode = event.keyCode || event.which;					
					if(keyCode == 13)
					{
						var now = jotlee_now();
						reqId++;
						approveEnabled = false;
						$('#'+approveId).removeClass("actionbutton").addClass("disabledactionbutton");
						retryDots = "";
						event.preventDefault();
						var t = $('#'+jotxtId).text();
						jot = jot_Parse(t);
						var skimmedJot = jot_skim(t);
						$('#' + skimmedJotId).text(skimmedJot);
						$('#'+expInfoId).text(jot_format_time(jot.expiryMoment, now) );
						/*if(parsedJot.isPeriodic)
						{
							$('#' + periodicId).html(jot_format_period(parsedJot));
						}else
							$('#' + periodicId).text('');*/
						if(jot.hasDuration)
						{
							$('#' + durationId).text(" for " + jot_format_duration(jot));
						}else
							$('#' + durationId).text('');
						
						jot_name_cache_translateNames(jot, reqId,  
							function(pj, rid, done)
							{
								if(rid != reqId) return;
								var t = pj.displayNames.toString();
								if(done)
								{
									$('#'+approveId).removeClass("disabledactionbutton").addClass("actionbutton");
									approveEnabled = true;
									//$('#'+approveId).focus();									
								}else
									t = t + "[fetching names"+retryDots +"]";
								retryDots +=".";
								$('#'+parsedPeopleId).html(t);		
							}
						);												
					}
				}
		);		
		
		$('#'+removeId).click(
				function(){$('#' + localid).remove();}
		);

		$('#'+editId).click(
				function(){$('#' + jotxtId).focus();}
		);
				
		$('#'+approveLinkId).click(
				function(event){
					event.preventDefault();
					if(approveEnabled)
						jot_submit(jot, localid, 0);
				}
		);		
		
	}
}


function doPoll()
{	
	var reqmsg = {type: 'poll', firstPoll: firstPoll, 
			      sinceJotIdFromNotifyQ: window.sinceJotIdFromNotifyQ};
	$.ajax( {
		type: "POST",
		url : "/jot/poll",
		contentType: "application/json",
		data : JSON.stringify(reqmsg),
		statusCode: {
			401 : function(){window.location = '/';}
		}
		} ).done(function(data)
				{
					onPollMessage(data);
					doPoll();
					//setTimeout(doPoll, 5000);
				}).
		fail(function(xhr, status, err) {
			if(xhr.status == 401)
				window.location = "/";
			else
			{
				$('#conn').text('error. reconnecting...');
				//reconnectProc refreshes the session (to work in case session affinity is enabled)
				//when session is refreshed simultaneously while another request is in progress
				//the user can get logged out. Hence do reconnect after some time.
	            setTimeout(reconnectProc, 5000);
			}
		});
	
}


function jot_action(jot, statusId, action, displayfn)
{
	var userids = [];
	
	if(!jot)
	{
		$('#' + statusId).html('<span style="color:red">[invalid jot]</span>');
		return;
	}

	for(var userid in jot.users)
		userids.push(userid);
	
	if(utils_inArray(jot.ownerid, userids) < 0)//notification needs to go to the owner also
		userids.push(jot.ownerid);
	
	$('#' + statusId).text(' [Contacting server...]');
	var reqmsg = {jotid: jot.jotid, userids: userids, action: action};
	$.ajax( {
		type: "POST",
		url : "/jot/action",
		contentType: "application/json",
		data : JSON.stringify(reqmsg),
		statusCode: {
			401 : function(){window.location = '/';}
		}
		} ).done(function(data)
				{
					var reply = data;
					if(reply.error)
						$('#' + statusId).html('<span style="color:red">[error]</span>');
					else
					{
						var myuserid = jot_name_cache_get('me').userid;
						$('#' + statusId).text('');
						var updates = [{jotid:jot.jotid, userid: myuserid}];
						displayfn(updates);
					}
				}).
		fail(function(xhr, status, err) {
			if(xhr.status == 401)
				window.location = "/";
			else
			{
				$('#' + statusId).html('<span style="color:red"> [network error]</span>');				
			}
		});
	
}


function jot_display_user(prefix, jotid, userid, userInfo)
{
	var selector = '#' + prefix + jotid + '_' + userid;
	if(userInfo.displayName)
		$(selector).text(userInfo.displayName);
	else
		$(selector).text(userid);	
	var cls = false;
	
	switch(userInfo.status)
	{
		case 'C': cls = 'usercanceled'; break;
		case 'D': cls = 'userdone' ; break;
		default: 
			if(userInfo.hasAccepted)
				cls = 'useraccepted';
			else
				cls = 'usernotaccepted';
	}
	if(cls)
		$(selector).removeClass('usernotaccepted useraccepted usercanceled userdone')
		.addClass(cls);	
}

function jot_display_users(prefix, jot)
{
	for(var userid in jot.users)
	{
		var udata = jot.users[userid];
		jot_display_user(prefix, jot.jotid, userid, udata);
	}
}



function jot_add_to_recent(jot, now)
{
	jot_add_generic("recent", jot, now);
}

function jot_add_to_upcoming(jot, now, afterJotid)
{
	jot_add_generic("upcoming", jot, now, afterJotid);
}

function jot_add_generic(box, jot, now, afterJotid)
{
	var prefix = "jid_";
	if(box == "upcoming")
		prefix = "ujid_";
	
	var durationTxt = "";
	var myuserid = jot_name_cache_get('me').userid;
	
	if(jot.hasDuration)
	{
		durationTxt = "<span class='expiryinfo'> for " + jot_format_duration(jot) + "</span>";
	}

	var cls = "accepted";
	if(!jot.hasAccepted && (jot.ownerid != userid) )
		cls = "acceptpending";
		
	var periodicTxt = "";
	if(jot.isPeriodic)
	{
		periodicTxt = jot_format_period(jot);
	}
 
	//m.local();
	var acceptTxt = "";
	var acceptId = "acp_" + prefix + jot.jotid;
	var actionStatusId = "sts_act_" + prefix + jot.jotid;
	
	var actionStatusTxt = "<span id='" + actionStatusId + "'></span>&nbsp;";
		
	if(jot.status == 'A' && !jot.hasAccepted && (jot.ownerid != userid) )
	{
		acceptTxt = " <span id='" + acceptId + "' class='actionbutton'>&nbsp;Accept&nbsp;</span>&nbsp;&nbsp;";
	}

	var cancelTxt = "";	
	var cancelId = "cnc_" + prefix + jot.jotid;
	
	var doneTxt = "";	
	var doneId = "done_" + prefix + jot.jotid;
	
	var actionsId = "actions_" + prefix + jot.jotid;
	
	
	if(jot.status == 'A' && jot.users[myuserid])
	{
		cancelTxt = " <span id='" + cancelId + "' class='actionbutton'>&nbsp;Cancel&nbsp;</span>&nbsp;&nbsp;";
		if(acceptTxt == "")
			doneTxt = " <span id='" + doneId + "' class='actionbutton'>&nbsp;Done&nbsp;</span>&nbsp;&nbsp;";		
	}
	
	//var namesId = "nm_" + prefix + jot.jotid;
	
	var skimmedJot = jot_skim(jot.jot);
	var receivedTimeId = "rtm_" + prefix + jot.jotid;
	var peopleHtml  ="";
	
	var firstUser = true;
	
	for(var userid in jot.users)
	{
		if(!firstUser)
			peopleHtml += ", ";		
		peopleHtml += "<span id='usr_" + prefix + jot.jotid + "_" + userid + "'>"+userid+"</span>";
		firstUser = false;		
	}
	
	var ownerInfo = "<a href='#' class='ownerlink' id='owner_" + prefix + jot.jotid + "'>" + jot.ownerid + "</a>";	
	
	if(acceptTxt != "")
		img = "/images/notaccepted.png";
	else
	if(jot.status == 'A')
		img = "/images/accepted.png";
	else
	if(jot.status == 'D')
		img = "/images/done.png";
	else
		img = "/images/canceled.png";
	
	var now = jotlee_now();
	
	var expInfoId = 'exp_' + prefix + jot.jotid;  

	var html = 
		"<table  id='" + prefix + jot.jotid + "' class='" + cls + "' width='100%' style='padding-right:3px'>" + 
		"<tr><td><img id='sts_img_" + prefix + jot.jotid + "' src='" + img + "'></td><td>" +
		"<span class='ownerinfo' style='float:left'>" + ownerInfo +  "</span> " +
		"<span style='float:right'>" +
		"<span class='expiryinfo' id='" + expInfoId + "'>" + jot_format_time(jot.expiryMoment, now) + "</span>" +
		durationTxt + 
		"</span>" +
		"</td></tr>" +			
		"<tr><td>&nbsp;</td><td><span class='skimmedjot'>" +
		skimmedJot  +
		"</span></td></tr><tr><td>&nbsp;</td><td>" +
		"<span class='actionbuttons' id='" + actionsId + "'>" + actionStatusTxt + acceptTxt  + cancelTxt + doneTxt + "</span></td></tr>" +
		"<tr id ='ppl_" + prefix + jot.jotid + "'> " + 
		"<td colspan='2' class='peopleinfo'>" +
		"<span style='float:left'>" + 
		peopleHtml + 
		 "</span> 	" + 
		 "<span class='receivedinfo' id='"+ receivedTimeId + "'>" + jot.receivedMoment.from(now) + "</span>" + 
		 "</td></tr>"+
		"</table>";

	if(box == "recent")
		$('#recentjots').prepend(html);
	else
	{
		if(afterJotid)
			$('#ujid_' + afterJotid).after(html);
		else
			$('#upcomingjots').prepend(html);		
	}
	$('#ppl_' + prefix + jot.jotid).hide();
	$('#' + prefix + jot.jotid).hover(
			function()
			{
				$('#ppl_' + prefix + jot.jotid).show();
			}, 
			function()
			{
				$('#ppl_' + prefix + jot.jotid).hide();
			}			
		);
		
	if(acceptTxt != "")
	{
		$('#'+acceptId).click(function(event)
				{
					event.preventDefault();
					jot_action(jot, actionStatusId, 'accept', jot_update_accepted);
				});
	}

	if(cancelTxt != "")
	{
		$('#'+cancelId).click(function(event)
				{
					event.preventDefault();
					jot_action(jot, actionStatusId, 'cancel', jot_update_canceled);
				});
	}

	if(doneTxt != "")
	{
		$('#'+doneId).click(function(event)
				{
					event.preventDefault();
					jot_action(jot, actionStatusId, 'done', jot_update_done);
				});
	}
	
	//TODO: problem - since all recent jots are displayed at once this results in name cache misses for
	//all the recent jots during initial load
	jot_name_cache_translateUserids(jot, 0, 
				function(jot, reqId, done)
				{
					jot_display_users('usr_' + prefix , jot);
					if(jot.ownerid == myuserid)
						$('#owner_' + prefix + jot.jotid).text("myself");						
					else					
					if(jot.ownerInfo)
						$('#owner_' + prefix + jot.jotid).text(jot.ownerInfo.displayName);
				});
	
}


function jot_update_canceled(cancels)
{
	jot_update_on_action(cancels, 'C');
}

function jot_update_done(dones)
{
	jot_update_on_action(dones, 'D');
}

function jot_update_on_action(jotInfos, status) //actions: done or canceled only
{
	var myuserid = jot_name_cache_get('me').userid;
	var upcomingCanceledOrDone = [];
	for(var i=0;i< jotInfos.length;i++)
	{
		var jot = jot_cache_get_recent_by_id(jotInfos[i].jotid);
		if(jot)
		{
			if(myuserid == jotInfos[i].userid)
			{
				jot.status = status;
				var actionStatusId = "#sts_act_jid_" + jot.jotid;				
				var acceptId = "#acp_jid_" + jot.jotid;
				var cancelId = "#cnc_jid_" + jot.jotid;
				var doneId = "#done_jid_" + jot.jotid;			
				$(acceptId).remove();
				$(cancelId).remove();
				$(doneId).remove();
				$(actionStatusId).text('');
				var statusImgId = "#sts_img_jid_" + jot.jotid;
				if(status == 'D')
					$(statusImgId).attr("src", "/images/done.png");
				else
				if(status == 'C')
					$(statusImgId).attr("src", "/images/canceled.png");
					
			}
			
			var userInfo = jot.users[jotInfos[i].userid];
			if(userInfo)
			{
				userInfo.status = status;
				jot_display_user('usr_jid_', jot.jotid, jotInfos[i].userid, userInfo);
			}
		}
		var ujot = jot_cache_get_upcoming_by_id(jotInfos[i].jotid);
		if(ujot)
		{
			if(myuserid == jotInfos[i].userid)
			{
				upcomingCanceledOrDone.push(ujot.jotid);
			}
			var userInfo = jot.users[jotInfos[i].userid];
			if(userInfo)
			{
				userInfo.status = status;
				jot_display_user('usr_ujid_', jot.jotid, jotInfos[i].userid, userInfo);
			}
			
		}
	}
	
	if(upcomingCanceledOrDone.length > 0)
	{
		var upcomingJots = jot_cache_get_upcoming();
		fetch_upcoming_jots(upcomingJots, upcomingCanceledOrDone.length);//must call before we remove items
		for(var i=0;i<upcomingCanceledOrDone.length;i++)
		{
			$('#ujid_' + upcomingCanceledOrDone[i]).remove();
			for(var k=0;k<upcomingJots.length;k++)
			{
				if(upcomingJots[k].jotid == upcomingCanceledOrDone[i])
				{
					upcomingJots.splice(k, 1);	
				}
			}
		}
	}

}

function jot_update_accepted(accepts)
{
	var myuserid = jot_name_cache_get('me').userid;
	
//	alert(JSON.stringify(accepts));
	
	for(var i=0;i< accepts.length;i++)
	{
		var jot = jot_cache_get_recent_by_id(accepts[i].jotid);
		if(jot)
		{
			if(myuserid == accepts[i].userid)
			{
				jot.hasAccepted = true;
				var acceptId = "acp_jid_" + jot.jotid;
				var actionsId = 'actions_jid_' + jot.jotid;
				var actionStatusId = "sts_act_jid_" + jot.jotid;
				var doneId = "done_jid_"  + jot.jotid;
				var doneTxt = " <span id='" + doneId + "' class='actionbutton'>&nbsp;Done&nbsp;</span>&nbsp;&nbsp;";
				$('#'+acceptId).remove();
				$('#'+actionsId).append(doneTxt);			
				$('#'+actionStatusId).text('');
				var statusImgId = 'sts_img_jid_' + jot.jotid;
				$('#'+statusImgId).attr("src", "/images/accepted.png");				
				$('#' + doneId).click(function(event)
					{
						event.preventDefault();
						jot_action(jot, actionStatusId, 'done', jot_update_done);
					});				
			}
			
			var userInfo = jot.users[accepts[i].userid];
			if(userInfo)
			{
				userInfo.hasAccepted = true;
				jot_display_user('usr_jid_', jot.jotid, accepts[i].userid, userInfo);
			}
		}
		var ujot = jot_cache_get_upcoming_by_id(accepts[i].jotid);
		if(ujot)
		{
			var userInfo = ujot.users[accepts[i].userid];
			if(userInfo)
			{
				userInfo.hasAccepted = true;
				jot_display_user('usr_ujid_', ujot.jotid, accepts[i].userid, userInfo);
			}
			
		}else
		if(jot)
		{
			var now = jotlee_now();
			var removedJotids = jot_cache_update_upcoming([jot], 
					function(jot, afterJotid)
					{							
						jot_add_to_upcoming(jot, now, afterJotid);
					});
			for(var i=0;i<removedJotids.length;i++)
				$('#ujid_' + removedJotids[i]).remove();

		}
		
	}
}

function onPollMessage(msg) 
{		
	if(msg.type == 'rpoll')
	{
		
		if(msg.error)
		{
			return;//better luck during next poll
		}
		
		if(firstPoll)
		{
			setCurrentUser(msg.currentUser);
		}
		
		firstPoll = false;
		
		if(msg.sinceJotIdFromNotifyQ)
		{
			window.sinceJotIdFromNotifyQ = msg.sinceJotIdFromNotifyQ;			
		}
		
		var removedJotIds = jot_cache_update_recent(msg.recentJots);		

		for(var i=0;i<removedJotIds.length;i++)
		{
			$('#jid_' + removedJotIds[i]).remove();
		}
		
		var now = jotlee_now();

		for(var i=0;i<msg.recentJots.length;i++)
		{
			var jot = msg.recentJots[i];
			if(jot.hasDuplicateInRecent)
				continue;
			jot_populate_fields_on_receive(jot);
			jot_add_to_recent(jot, now);
		}
		
		if(msg.upcomingJots)//only in the first poll do we get separate upcomingJots - 
			               //so we can simply display them all
		{
			jot_cache_update_upcoming(msg.upcomingJots);				
			
			for(var i=msg.upcomingJots.length-1;i >= 0;i--)
			{
				var jot = msg.upcomingJots[i];
				if(jot.hasDuplicateInUpcoming)
					continue;				
				jot_populate_fields_on_receive(jot);
				jot_add_to_upcoming(jot, now);				
			}
		}else
		{
			var removedJotids = jot_cache_update_upcoming(msg.recentJots, 
					function(jot, afterJotid)
					{							
						jot_add_to_upcoming(jot, now, afterJotid);
					});
			for(var i=0;i<removedJotids.length;i++)
				$('#ujid_' + removedJotids[i]).remove();
		}
		
		if(msg.accepts && msg.accepts.length > 0)
		{
			jot_update_accepted(msg.accepts);
		}
		
		if(msg.cancels && msg.cancels.length > 0)
		{
			jot_update_canceled(msg.cancels);
		}
		
		if(msg.dones && msg.dones.length > 0)
		{
			jot_update_done(msg.dones);
		}
		
	}
}


function reconnectProc()
{
	$('#conn').text('error. reconnecting...');
	$.ajax({type:'POST', url: '/refreshsession', data: 'dummy'})
        .success(function (data) {
       		$('#conn').text('connected');        	
       		doPoll();
        }).
		fail(function(xhr, status, err) {
			//console.debug("debug: %d, %s, %s", xhr.status, status, err);			
			if(xhr.status == 401)
				window.location = "/";
			else
	            setTimeout(reconnectProc, 5000);
		});        
}

function updateTimes()
{
	var expiredKeepTime = 1000*60*2;
	var jots = jot_cache_get_recent();
	
	var now = jotlee_now();
	for(var i =0;i<jots.length;i++)
	{
		var receivedTimeId = "rtm_jid_" + jots[i].jotid;
		var expInfoId = 'exp_jid_' + jots[i].jotid;
		$('#' + receivedTimeId).text(jots[i].receivedMoment.from(now));
		$('#' + expInfoId).text(jot_format_time(jots[i].expiryMoment, now));		
	}
	
	jots = jot_cache_get_upcoming();
	
	var doAlarm = false;
	var toRemove  = 0;
	
	for(var i =0;i<jots.length;i++)
	{
		var receivedTimeId = "rtm_ujid_" + jots[i].jotid;
		$('#' + receivedTimeId).text(jots[i].receivedMoment.from(now));
		var expInfoId = 'exp_ujid_' + jots[i].jotid;
		$('#' + expInfoId).text(jot_format_time(jots[i].expiryMoment, now));		
		var label = "Expires ";
		var delta = jots[i].expiryMoment.diff(now);
		if( delta < 0)
		{
			label = "Expired ";
			if(!jots[i].alarmDone)
			{
				doAlarm = true;
				jots[i].alarmDone = true;
			}else
			if(-delta >= expiredKeepTime)
			{
				$('#ujid_' + jots[i].jotid).remove();
				toRemove++;				
			}
		}
				
		var expiryTimeId = "exp_ujid_" + jots[i].jotid;
		$('#' + expiryTimeId).text(label + jots[i].expiryMoment.from(now));

	}
	
	if(toRemove > 0)
		fetch_upcoming_jots(jots, toRemove);//must call before we remove items 
	                                        //because if we remove the last item the expirytime info is lost
	
	recentlyExpiredCount += toRemove;
	
	if(recentlyExpiredCount > 0)
		$('#expiryinfo').text("[" + recentlyExpiredCount + " expired recently]");
	
	while(toRemove > 0)
	{
		jots.shift();
		toRemove--;
	}
		
	if(doAlarm)
	{
		$('#alarm').jPlayer('play');
	}
	
	setTimeout(updateTimes, 5*1000);

}


var lastExpiryInfo = {time:0, jotids:[]};

function fetch_upcoming_jots(curr_upcoming_jots, count)
{
	if(count <= 0) return;
	
	var since = false;
	
	if(curr_upcoming_jots.length > 0)
	{
		since = {};
		var jot = curr_upcoming_jots[curr_upcoming_jots.length-1];
		since.time = jot.expiryTime;
		
		if(lastExpiryInfo.time == jot.expiryTime)
		{
			lastExpiryInfo.jotids.push(jot.jotid);
		}else
		{
			lastExpiryInfo.jotids = [jot.jotid];
			lastExpiryInfo.time = jot.expiryTime;
		}
		
		since.jotids = lastExpiryInfo.jotids;
		
		for(var i=0;i<curr_upcoming_jots.length;i++)
		{
			jot = curr_upcoming_jots[i];
			if(jot.expiryTime == since.time)
				since.jotids.push(jot.jotid);
		}
	}
	
	var msg = {type: 'fetch_upcoming', since: since, count: count};
	
	fetch_upcoming_jots_doreq(msg, 0);
}

function fetch_upcoming_jots_doreq(msg, nRetries)
{
	$.ajax( {
		type: "POST",
		url : "/jot/poll",
		contentType: "application/json",
		data : JSON.stringify(msg),
		statusCode: {
			401 : function(){window.location = '/';}
		}
		} ).done(function(reply)
				{
					if(reply.upcomingJots && reply.upcomingJots.length > 0)
					{
						for(var i =0;i<reply.upcomingJots.length;i++)
						{
							jot_populate_fields_on_receive(reply.upcomingJots[i]);
						}
						var now = jotlee_now();
						
						var removedJotids = jot_cache_update_upcoming(reply.upcomingJots, 
								function(jot, afterJotid)
								{							
									jot_add_to_upcoming(jot, now, afterJotid);
								});
						for(var i=0;i<removedJotids.length;i++)
							$('#ujid_' + removedJotids[i]).remove();						
					}
				}).
		fail(function(xhr, status, err) {
			if(xhr.status == 401)
				window.location = "/";
			else
			{
	            setTimeout(
	            		function()
	            		{
	            			fetch_upcoming_jots_doreq(msg, nRetries + 1);
	            		}, 8000);
			}
		});
	
}

var prevTabTick = -1;
var clockSpan = null;
function doTick()
{		
	if(!window.jotlee_time)
		window.jotlee_time = moment();
	else
		window.jotlee_time.add('seconds', 1);
	
	if(tabStatus == TabStatus.CHECKING)
	{
		liveCounter++;
		var t = $.cookie('jotlee_tab_tick');
		if(prevTabTick != -1)
		{
			if(t != prevTabTick)
			{
				tabStatus = TabStatus.DISABLED;
				$('#conn').html("<font color='red'>Another Acive Tab Exists! This jotlee tab is disabled.</font>.");
			}
			prevTabTick = t;
		}else
			prevTabTick = t;
		if(liveCounter > liveCounterCheckMax && tabStatus == TabStatus.CHECKING)
		{
			$('#conn').text('connected');
			syncTime();//start time syncing.
			doPoll();//start polling
			updateTimes();			
			tabStatus = TabStatus.LIVE;
			liveCounter=0;
			clockSpan = $('#clock');
		}
	}
	
	if(tabStatus == TabStatus.LIVE)
	{
		$.cookie("jotlee_tab_tick", liveCounter);
		liveCounter++;
		if(clockSpan)
		{
			var t =  "["+window.jotlee_time.format("MMM-DD-YYYY (ddd) hh:mm:ss a") +"]";			
			clockSpan.text(t);
		}
	}
	
}

var syncStartedAt = null;
function syncTime()
{
	syncStartedAt = new moment();
	$.ajax( {
		type: "POST",
		url : "/getdate",
		contentType: "application/json",
		data : "{}",
		statusCode: {
			401 : function(){window.location = '/';}
		}
		} ).done(function(reply)
				{
					var now = new moment();
					var diff = now.diff(syncStartedAt)/1000;
					diff = Math.round(diff/2); //network latency by 2.
					var serverTime = new moment(reply.time, "YYYY-MM-DD HH:mm:ss Z");
					if(diff > 0)
						serverTime.add('seconds', diff);
					window.jotlee_time = serverTime;
					setTimeout(syncTime, 30000);
				}).
		fail(function(xhr, status, err) {
			if(xhr.status == 401)
				window.location = "/";
			else
			{
	            setTimeout(syncTime, 10000);
			}
		});
	
}


function jotlee_now()
{
	return window.jotlee_time ? window.jotlee_time : moment(); 
}

function setCurrentUser(user)
{
	$('#currentuser').text(user.name + " (" + user.displayName + ")");			
	jot_name_cache_put_me(user.name, user.displayName, user.id);
	jot_name_cache_put(user.name, user.displayName, user.id);			
}

function getCurrentUser()
{
	$.ajax( {
		type: "POST",
		url : "/user/getcurrent",
		contentType: "application/json",
		data : "{}",
		statusCode: {
			401 : function(){window.location = '/';}
		}
		} ).done(function(user)
				{
					setCurrentUser(user);
				}).
		fail(function(xhr, status, err) {
			if(xhr.status == 401)
				window.location = "/";
			else
			{
				//do nothing - rely on first poll to get the current user.
			}
		});
	
}

$(function () {
	$('#myjot').click(myjotReset).keypress(myjotEnter);
	$('#search').click(searchReset);
	getCurrentUser();

	setInterval(doTick, 1000);

    $("#alarm").jPlayer({
        ready: function () {
        $(this).jPlayer("setMedia", {
        mp3: "/resources/alarm.mp3"
        });
        },
        swfPath: "/javascripts/thirdparty/jplayer",
        supplied: "mp3"
        });
    $('#expiryinfo').click(
    		function(event)
    		{
    			$('#expiryinfo').text('');
    			recentlyExpiredCount = 0;
    		}
    		);
	$('#conn').text("initializing...");    
});



//ATTIC : OLD FUNCTION IMPLEMENTATIONS - TO BE REMOVED

/*
function jot_add_to_recent(jot, now)
{
	var durationTxt = "";
	var myuserid = jot_name_cache_get('me').userid;
	
	if(jot.hasDuration)
	{
		durationTxt = "; " + jot_format_duration(jot);
	}

	var cls = "accepted";
	if(!jot.hasAccepted && (jot.ownerid != userid) )
		cls = "acceptpending";
		
	var periodicTxt = "";
	if(jot.isPeriodic)
	{
		periodicTxt = "; " + jot_format_period(jot);
	}
 
	//m.local();
	var acceptTxt = "";
	var acceptId = "acp_jid_" + jot.jotid;
	var acceptStatusId = "sts_acp_jid_" + jot.jotid;
	if(jot.status == 'A' && !jot.hasAccepted && (jot.ownerid != userid) )
	{
		acceptTxt = " <a id='" + acceptId + "' href='#' class='simplelink'>accept</a>" +
		            "<span id='" + acceptStatusId + "'></span>";
	}

	var cancelTxt = "";	
	var cancelId = "cnc_jid_" + jot.jotid;
	var cancelStatusId = "sts_cnc_jid_" + jot.jotid;
	
	var doneTxt = "";	
	var doneId = "done_jid_" + jot.jotid;
	var doneStatusId = "sts_done_jid_" + jot.jotid;
	
	if(jot.status == 'A' && jot.users[myuserid])
	{
		cancelTxt = " <a id='" + cancelId + "' href='#' class='simplelink'>cancel</a>" +
		            "<span id='" + cancelStatusId + "'></span>";
		doneTxt = " <a id='" + doneId + "' href='#' class='simplelink'>done</a>" +
        "<span id='" + doneStatusId + "'></span>";		
	}
	
	var namesId = "nm_jid_" + jot.jotid;
	
	var skimmedJot = jot_skim(jot.jot);
	var receivedTimeId = "rtm_jid_" + jot.jotid;
	var peopleHtml  ="";
	
	var firstUser = true;
	
	for(var userid in jot.users)
	{
		if(!firstUser)
			peopleHtml += ", ";		
		peopleHtml += "<span id='usr_jid_" + jot.jotid + "_" + userid + "'>"+userid+"</span>";
		firstUser = false;		
	}
	
	$('#recentjots').prepend(
			"<div class='" + cls + "' id='jid_" + jot.jotid + "'>" +
			"<div class='skimmedjot'>" + skimmedJot +  "</div>" +			
			"<div class='jotdetails'>" +
			jot_format_time(jot.expiryMoment, true) +
			durationTxt + 
			periodicTxt +
			"<br/>" +
			"<span class='ownerbox' id='owner_jid_" + jot.jotid + "'></span>; " +			
			"People: <span id='" + namesId + "'>" + peopleHtml + "</span>" +							
			"; Received <span id='" + receivedTimeId + "'>" +  jot.receivedMoment.from(now) + "</span>. " +
			acceptTxt + cancelTxt + doneTxt + 
			"</div>" +
			"</div>"
			);
	if(acceptTxt != "")
	{
		$('#'+acceptId).click(function(event)
				{
					event.preventDefault();
					jot_action(jot, acceptStatusId, 'accept', jot_update_accepted);
				});
	}

	if(cancelTxt != "")
	{
		$('#'+cancelId).click(function(event)
				{
					event.preventDefault();
					jot_action(jot, cancelStatusId, 'cancel', jot_update_canceled);
				});
	}

	if(doneTxt != "")
	{
		$('#'+doneId).click(function(event)
				{
					event.preventDefault();
					jot_action(jot, doneStatusId, 'done', jot_update_done);
				});
	}
	
	//TODO: problem - since all recent jots are displayed at once this results in name cache misses for
	//all the recent jots during initial load
	jot_name_cache_translateUserids(jot, 0, 
				function(jot, reqId, done)
				{
					jot_display_users('usr_jid_', jot);
					if(jot.ownerid == myuserid)
						$('#owner_jid_' + jot.jotid).text("From: myself");						
					else					
					if(jot.ownerInfo)
						$('#owner_jid_' + jot.jotid).text("From: "+jot.ownerInfo.displayName);
				});
}
*/


/*
function jot_add_to_upcoming(jot, now, afterJotid)
{
	var durationTxt = "";
	var myuserid = jot_name_cache_get('me').userid;
	
	
	if(jot.hasDuration)
	{
		durationTxt = "; " + jot_format_duration(jot);
	}
	
	
	var periodicTxt = "";
	if(jot.isPeriodic)
	{
		periodicTxt = "; " + jot_format_period(jot);
	}
	m = moment(jot.receivedTime, "YYYY-MM-DD HH:mm:ss Z");
	//m.local();
	var namesId = "nm_ujid_" + jot.jotid;
	
	var skimmedJot = jot_skim(jot.jot);
	var receivedTimeId = "rtm_ujid_" + jot.jotid;
	var expireTimeId = 'exp_ujid_' + jot.jotid;
	var label = "Expires ";
	if(jot.expiryMoment.diff(now) < 0)
		label = "Expired ";
	
	var peopleHtml  ="";
	var firstUser = true;
	for(var userid in jot.users)
	{
		if(!firstUser)
			peopleHtml += ", ";		
		peopleHtml += "<span id='usr_ujid_" + jot.jotid + "_" + userid + "'>"+userid+"</span>";
		firstUser = false;
	}
	
	var cancelTxt = "";
	var cancelId = "cnc_ujid_" + jot.jotid;
	var cancelStatusId = "sts_cnc_ujid_" + jot.jotid;
	
	var doneTxt = "";
	var doneId = "done_ujid_" + jot.jotid;
	var doneStatusId = "sts_done_ujid_" + jot.jotid;
	
	if(jot.status == 'A' && jot.users[myuserid])
	{
		cancelTxt = " <a id='" + cancelId + "' href='#' class='simplelink'>cancel</a>" +
		            "<span id='" + cancelStatusId + "'></span>";
		doneTxt = " <a id='" + doneId + "' href='#' class='simplelink'>done</a>" +
        "<span id='" + doneStatusId + "'></span>";
		
	}
		
	var jotHtml = 
		"<div class='accepted' id='ujid_" + jot.jotid + "'>" +
		"<div class='skimmedjot'>" + skimmedJot + "</div>" +
		"<div class='jotdetails'>" +
		jot_format_time(jot.expiryMoment, true) +
		durationTxt + 
		periodicTxt +
		"<br/>" +
		"<span class='ownerbox' id='owner_ujid_" + jot.jotid + "'></span>; " +		
		"People: <span id='" + namesId + "'>" + peopleHtml + "</span>" +							
		"; Received <span id='" + receivedTimeId + "'>" +  m.from(now) + "</span>" +
		"; <span id='" + expireTimeId + "'>" + label + jot.expiryMoment.from(now) + "</span>. " +
		cancelTxt + doneTxt + 
		"</div>" +
		"</div>";
	
	if(afterJotid)
		$('#ujid_' + afterJotid).after(jotHtml);
	else
		$('#upcomingjots').prepend(jotHtml);
	//TODO: problem - since all recent jots are displayed at once this results in name cache misses for
	//all the upcoming jots during initial load

	jot_name_cache_translateUserids(jot, 0, 
				function(jot, reqId, done)
				{
					jot_display_users('usr_ujid_', jot);
					if(jot.ownerid == myuserid)
						$('#owner_ujid_' + jot.jotid).text("From: myself");						
					else
					if(jot.ownerInfo)					
						$('#owner_ujid_' + jot.jotid).text("From: "+jot.ownerInfo.displayName);					
				});
	
	if(cancelTxt != "")
	{
		$('#'+cancelId).click(function(event)
				{
					event.preventDefault();
					jot_action(jot, cancelStatusId, 'cancel', jot_update_canceled);
				});
	}

	if(doneTxt != "")
	{
		$('#'+doneId).click(function(event)
				{
					event.preventDefault();
					jot_action(jot, doneStatusId, 'done', jot_update_done);
				});
	}
	
}*/

/*function myjotEnter(event)
{
	var keyCode = event.keyCode || event.which;
	if(keyCode == 13)
	{	
		var reqId = 1;
		event.preventDefault();
		var localid = "lid_" + new Date().getTime().toString();
		var jotxt = $('#myjot').val();
		jotxt = jotxt.replace(/\s+/g, ' '); //replace newlines with whitespace
		if(jotxt.replace(/\s+/g, '') == '') return;
		var parsedJot = jot_Parse(jotxt);
		var jotxtId = "lid_jotxt_" + localid;
		var expiryTimeId = "lid_exp_" + localid;
		var parsedPeopleId = "lid_ppl_" + localid;
		var removeId = 'lid_rm_' + localid;
		var approveId = 'lid_apv_' + localid;
		var statusId = 'lid_sts_' + localid;
		var periodicId = 'lid_prd_' + localid;
		var durationId = 'lid_dur_' + localid;
		var approveEnabled =false;
		
		var expTime  = parsedJot.expiryMoment.calendar();
		var skimmedJot = jot_skim(parsedJot.jot);

  	 $('#pendingjots').prepend(  '<table class="approvepending" id="' + localid + '"><tr><td><img src="/images/question.jpeg" /></td>' +
				                 "<td style='width:100%'><span style='float:left'>" + skimmedJot + "</span>" + 
				                 "<span style='float:right' id='" + expiryTimeId + "'>" + expTime + "</span></td></tr>" +			                 
				                 '<tr><td>&nbsp;</td><td><span style="float:right"><span class="actionbutton" id="' + approveId + '">&nbsp;Create Jot&nbsp;</span>' +
				                 "&nbsp;&nbsp; <span class='actionbutton' id='" + removeId + "'>&nbsp;Abort&nbsp;</span>" +
				                 "&nbsp;&nbsp;<span class='actionbutton'>&nbsp;Edit&nbsp;</span>" +				                 
				                 '</span></td></tr><tr><td style="border-top: 1px dashed #c0c0c0" colspan="2">' +
				                 'To: <span id="' + parsedPeopleId + '"></span>' +				                 
				                 '</td></tr>' +
								 '</table>');
		
		$('#' + approveId).hover
		(
			function(e){ if(approveEnabled) $('#' + approveId).css('text-decoration', 'underline');},
			function(){$('#' + approveId).css('text-decoration', 'none');}			
		);									
		
		if(parsedJot.isPeriodic)
		{
			$('#' + periodicId).html(jot_format_period(parsedJot));
		}
		
		if(parsedJot.hasDuration)
		{
			$('#' + durationId).html(jot_format_duration(parsedJot));
		}
		
		var retryDots = "";

		$('#myjot').val('@me').select();
				
		jot_name_cache_translateNames(parsedJot, reqId, 
			function(pj, rid, done)
			{
				if(rid != reqId) return;
				
				var t = pj.displayNames.toString();
				if(done)
				{
					approveEnabled = true;
					$('#'+approveId).focus();				
				}else
					t = t + "[fetching names"+retryDots +"]";
				retryDots += ".";
				$('#'+parsedPeopleId).html(t);		
			}
		);
		
		$('#' + jotxtId).prop('contentEditable', true);
		
		
		$('#'+removeId).click(
				function(){$('#' + localid).remove();}
		);

		$('#'+approveId).click(
				function(event){
					event.preventDefault();
					if(approveEnabled)
						jot_submit(parsedJot, localid, 0);
				}
		);		
	}
}*/

