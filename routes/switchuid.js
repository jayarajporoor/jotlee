exports.index = function (req, res) {
		    //Save user from previous session (if it exists)
		    var passport = req.session.passport;

		   //Regenerate new session & store user from previous session (if it exists)
		   req.session.regenerate(function (err) {
			   console.log("regenerate. user with passport: " + JSON.stringify(passport));
			   //console.log(JSON.stringify(req.cookies));
			   passport.user = "xyz";
		       req.session.passport = passport;
		       res.render('refreshsession', {});
		   });
}
