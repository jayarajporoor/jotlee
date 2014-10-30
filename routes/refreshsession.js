exports.index = function (req, res) {
    res.send("<html><head><title>session refreshed</title><body><h1>refreshed</h1></body></html>"); 
	//session refreshing disabled for now - required only if session affinity is required.
	//if need to be enabled then session key set must also be updated along with this.
}

function refresh_session(req, res)
{    //Save user from previous session (if it exists)
    var passport = req.session.passport;

   //Regenerate new session & store user from previous session (if it exists)
   req.session.regenerate(function (err) {
	   console.log("regenerate. user with passport: " + JSON.stringify(passport));
	   //console.log(JSON.stringify(req.cookies));
       req.session.passport = passport;
       res.send("<html><head><title>session refreshed</title><body><h1>refreshed</h1></body></html>");
   });
	
}
