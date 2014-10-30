var friendsBoxActive = false;
var newFriendPrompt = "Type in friend's jotlee name";
$(function()
{
	$('#friendsclose').click(
			function()
			{
				$('#friendsbox').hide();
				$('#friendsdata').remove();
				friendsBoxActive = false;
			});
	
	$('#friendslink').click(
		function()
		{
			if(friendsBoxActive)
				return;
			if(tlistsBoxActive)
			{
				$('#tlistsmsg').text('To open friends window please close the todo lists window.');
				setTimeout(function(){$('#tlistsmsg').text('');}, 3000);				
				return;
			}			
			$('#friendsbox').show();
			friendsBoxActive = true;
			load_friends(display_friends, 0);
		});	
});

function display_friends(friends)
{
	var html = '<br /> <div>&nbsp;&nbsp; <input type="text" id="newfriend" size="30" value="'+ newFriendPrompt +'"/>' +
	           "<input type='button' id='addfriend' value='Add Friend'/> <span id='addfriendmsg' style='color:red'></span></div>" + 
	           "<br /><div>&nbsp;&nbsp;Your Friends:</div><table id='friendstable' cellspacing='5px'>";
	for(var i=0;i< friends.length;i++)
	{
		var friend = friends[i];
		html += display_friend(friend);
	}
	
	html += "</table>";
	
	html = "<div id='friendsdata'>" + html + "</div>";
	$('#friendsbox').append(html);
	$('#newfriend').click(function(event)
			{
				if($('#newfriend').val() == newFriendPrompt)
					$('#newfriend').val('');
			});

	$('#addfriend').click(function(event)
			{
				add_friend();
			});

}

function display_friend(friend)
{
	autoAcceptHtml = friend.autoAccept ? " [auto accept]" : "";
	jot_name_cache_put(friend.username, friend.displayName, friend.userid);
	var html = "<tr><td>" + friend.displayName + "</td> <td>@" + friend.username + "</td>" +
	        " <td>" + autoAcceptHtml + "</td>" + 
	        "</tr>"; 
	return html;
}

function add_friend()
{
	$('#addfriendmsg').text('');
	
	var friendname = $.trim($('#newfriend').val());
	if(friendname == '')
		return;
	var re = /[^a-zA-Z0-9_]/g;
    if(re.test(friendname))
	{
	    $('#addfriendmsg').text('Invalid characters in friend name');
	    return;
	}
        
    add_friend_0(friendname, 0, on_new_friend);
}

function on_new_friend(friend)
{
	var html = display_friend(friend);
	$('#friendstable').append(html);
}

function add_friend_0(friendname, nRetries, callback)
{
	var maxRetries = 5;
	var msgTxt = JSON.stringify({friendname: friendname});
	$.ajax( {
		type: "POST",
		url : "/user/addfriend",
		contentType: "application/json",
		data : msgTxt,
		statusCode: {
			401 : function(){window.location = '/';}
		}
		} ).done(function(msg)
			{
				if(msg.error)
				{
					var err = "Error adding friend: " + msg.error;
					if(msg.error == "friend_exists")
						err = "Friend already exists";
					$('#addfriendmsg').text(err);
				}
				else
				{
					$('#addfriendmsg').text('');
					callback(msg.friend);
				}
				
			}
		).
		fail(function(xhr, status, err) {
			if(xhr.status == 401)
				window.location = "/";
			else
			{
				if(nRetries < maxRetries)
				{
					nDots = ".";
					for(var i=0;i<nRetries;i++)
						nDots += '.';
					$('#addfriendmsg').text('[Communication error. retrying' + nDots +']');				
					setTimeout(
	            		function(){add_friend_0(friendname, nRetries+1, callback);}
	            		, 5000);
				}else
				{
					$('#addfriendmsg').text('Communication Error.');
				}
			}
		});	
}

function load_friends(callback, nRetries)
{
	var maxRetries = 5;
	$.ajax( {
		type: "GET",
		url : "/user/friends",
/*		contentType: "application/json",
		data : msgTxt,*/
		statusCode: {
			401 : function(){window.location = '/';}
		}
		} ).done(function(msg)
			{
				if(msg.error)
					$('#friendsmsg').text('Error retrieving friends list: ' + msg.error);
				else
				{
					$('#friendsmsg').text('');
					callback(msg.friends);
				}
				
			}
		).
		fail(function(xhr, status, err) {
			if(xhr.status == 401)
				window.location = "/";
			else
			{
				if(nRetries < maxRetries)
				{
					nDots = ".";
					for(var i=0;i<nRetries;i++)
						nDots += '.';
					$('#friendsmsg').text('[communication error. retrying' + nDots +']');				
					setTimeout(
	            		function(){load_friends(callback, nRetries + 1);}
	            		, 5000);
				}else
				{
					$('#friendsmsg').text('Communication Error');
				}
			}
		});
}
