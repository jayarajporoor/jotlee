$(function()
  {
	$('#tlistsclose').click(
			function()
			{
				$('#tlistsbox').hide();
				$('#tlistsdata').remove();
				activePopup.name = activePopup.desc = "";
			});
	
	$('#tlistslink').click(
		function()
		{
			if(activePopup.name == "tlists")
				return;
			else
			if(activePopup.name != "")
			{
				var msgId = '#' + activePopup.name + 'msg';
				$(msgId).text('To open todo lists window, please close the ' + activePopup.desc + ' window.');
				setTimeout(function(){$(msgId).text('');}, 3000);
				return;
			}
			$('#tlistsbox').show();
			activePopup.name = "tlists";
			activePopup.desc = "Todo lists";
		});	
  });
