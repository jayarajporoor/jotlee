exports.index = function(req, res)
{
	if(req.user == null)
	{
		res.send('Unauthorized', 401);
		logger.warn("unauthorized getcurrentuser req");
	}else
	{
		var reply = {name: req.user.name, displayName: req.user.displayName, id: req.user.internalId, email: req.user.email, 
				     extName: req.user.extName};
		res.set("Content-Type", "application/json");
		res.send(JSON.stringify(reply));
	}
}
