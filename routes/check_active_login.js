exports.index = function(req, resp, next)
{
	if(req.user != null && req.user.name)//user is logged in and registered.
	{
		//resp.redirect("/?reason=already_logged_in");
		resp.redirect("/myjots");
	}else
		next();
}
