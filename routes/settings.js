exports.index = function(req, res){
 //console.log("jotlee: cookies: " + JSON.stringify(req.cookies));
  //console.log("jotlee: session: " + JSON.stringify(req.session));
  if(req.user != null)
  {
	  //req.local.user = req.user;
	  if(req.user.name)
		  res.redirect("/myjots");
	  else
		  res.sendfile(path.join(config.views, "settings.html"));
   }else
      res.redirect("/");
};