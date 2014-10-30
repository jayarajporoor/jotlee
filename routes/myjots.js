exports.myjots = function(req, res){
 //console.log("jotlee: cookies: " + JSON.stringify(req.cookies));
  //console.log("jotlee: session: " + JSON.stringify(req.session));
  if(req.user != null)
  {
	  if(req.user.name)
	  {
		  var f = path.join(config.views, "myjots.html");
		  logger.debug(f);
		  res.sendfile(f);
	  }
	  else
		  res.redirect('/settings');
   }else
      res.redirect("/");
};