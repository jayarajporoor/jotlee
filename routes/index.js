
/*
 * GET home page.
 */

exports.index = function(req, res){
	
    res.sendfile(path.join(config.views, "index.html"));
};