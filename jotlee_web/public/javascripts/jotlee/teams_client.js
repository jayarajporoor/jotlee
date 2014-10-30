var newTeamMemberPrompt = "Type in team member's jotlee name";
var newTeamPrompt = "Type in team name";
var teamsTimerId = null;

$(function()
{
	$('#teamsclose').click(
			function()
			{
				$('#teamsbox').hide();
				$('#teamsdata').remove();
				activePopup.name = activePopup.desc = "";
				if(teamsTimerId)
				{
					clearTimeout(teamsTimerId);
					teamsTimerId = null;
				}
			});
	
	$('#teamslink').click(
		function()
		{
			if(activePopup.name == "teams")
				return;
			else if(activePopup.name != "")
			{
				$("#" + activePopup.name + "msg").text('To open teams window please close the ' +  activePopup.desc + ' window.');
				setTimeout(function(){$('#tlistsmsg').text('');}, 3000);				
				return;
			}			
			$('#teamsbox').show();
			activePopup.name = "teams";
			activePopup.desc = "teams";
			load_teams(display_teams, 0);
		});	
});

function display_teams(msg)
{

	$('#teamsbox').append("<div id='teamsdata'></div>");
	
	for(var k in msg.teams)
	{
		var t = "<div class='teamhead' id='team_"+ k + "'>" + 
		        "<span id='team_state_" + k + "'>+ </span>"+ 
		        msg.teams[k].desc + " (" + msg.teams[k].name + ")"+ "</div>";
		var u = "";
		for(var i = 0;i< msg.teams[k].users.length;i++)
		{
			u += "<div style='padding-left:1em'>" + msg.teams[k].users[i] + "</div>";
		}
		u = "<div id='team_users_" + k + "'>" + u + "</div>";
		
		t += u;
		
		$('#teamsdata').append(t);
		
		$('#team_users_' + k).hide();
		
		(function(teamid)
		{
			$('#team_' + teamid).click(
				function()
				{
					var users = $('#team_users_' + teamid);
					if($(users).is(":visible"))
					{
						$('#team_state_' + teamid).text('+');
						$(users).hide();
					}else
					{
						$('#team_state_' + teamid).text('-');
						$(users).show();					
					}
				}
			);
		})(k);
	}	

}


function load_teams(callback, nRetries)
{
	var maxRetries = 5;
	$.ajax( {
		type: "GET",
		url : "/user/teams",
		contentType: "application/json",
		statusCode: {
			401 : function(){window.location = '/';}
		}
		} ).done(function(msg)
			{
				if(msg.error)
					$('#teamsmsg').text('Error retrieving teams list: ' + msg.error);
				else
				{
					$('#teamsmsg').text('');
					callback(msg);
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
					$('#teamsmsg').text('[communication error. retrying' + nDots +']');				
					teamsTimerId = setTimeout(
	            		function(){load_teams(callback, nRetries + 1);}
	            		, 5000);
				}else
				{
					$('#teamsmsg').text('Communication Error');
				}
			}
		});
}
