exports.logout = function (req, res) {
		    //Save user from previous session (if it exists)
			req.session.destroy(function (err) {
					if(err)
						console.log("cannot destroy session: " + err);
					else
						res.redirect("/");
				}
			);
}
