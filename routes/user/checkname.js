exports.index = function(req, res){
 //console.log("jotlee: cookies: " + JSON.stringify(req.cookies));
  //console.log("jotlee: session: " + JSON.stringify(req.session));
  if(req.user != null)
  {
	  console.log("checkusername:" + JSON.stringify(req.body));

	  var db = easydb();
	  var userName_lc = req.body.userName.trim().toLowerCase();
	  var reply = {available:false, userName: req.body.userName, err: false};
	  
	  var re = /[^a-zA-Z0-9_]/g;
	  if(re.test(req.body.userName))
	  {
		  reply.err = "Username contains special characters";
		  res.send(JSON.stringify(reply));
		  return;
	  }
	  
	  
	  db
	  .query(function()
			  {
		  		return {query: "select userid from users where username_lc=?",params:[userName_lc]};
			  })
	   .success(function(rows)
			   {
		   			if(rows.length == 0) reply.available = true;		   			
			   })
	   .done(function()
			 {
		   		res.header("Content-Type:", "application/json");
		   		res.send(JSON.stringify(reply));           		   	
			 })
	   .error(function()
			  {
		   		   reply.err = "DB error";
		   	       res.header("Content-Type:", "application/json");
		   		   res.send(JSON.stringify(reply));           		   			   			
			  })
		.execute();
	    
  }else
      res.send("Unauthorized", 401);
};