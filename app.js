//Basic global config defaults. sesionExpiry is used by connect-redis module 

global.path 			= require('path');

global.config = {SESSION_EXPIRY: 10*60,
		         NOTIFY_TIMEOUT: 5*60, //around half of session expiry
		         JOT_CACHE_EXPIRY: 60,
		         SESSION_KEY: 'XSESSIONID',
		         SESSION_SECRET: 'amritamma',
		         mobileAppServer: false,
		         public_html: path.join(path.join(__dirname, "jotlee_web"), "public"),
		         views: path.join(path.join(path.join(__dirname, "jotlee_web"), "public"), "views")
		         };


/**
 * Module dependencies.
 */

var   express 			= require('express')
    , routes 			= require('./routes')
    , user 				= require('./routes/user')
    , myjots 			= require('./routes/myjots')
    , logout 			= require("./routes/logout")
    , refreshsession 	= require('./routes/refreshsession')
    , switchuid 		= require('./routes/switchuid')
    , settings 			= require('./routes/settings')
    , checkusername 	= require('./routes/user/checkname')
    , createuser 		= require('./routes/user/create')
    , translate_names 	= require('./routes/user/translate_names')    
    , translate_ids 	= require('./routes/user/translate_ids')    
    , getdate 			= require("./routes/getdate")
    , jotsubmit 		= require('./routes/jot/submit')
    , jotpoll 			= require('./routes/jot/poll')    
    , jotaction 		= require('./routes/jot/action')    
    , http 				= require('http')
    , __ 				= require('underscore')    
    , passport 			= require('passport')
    , GoogleStrategy 	= require('passport-google').Strategy
    , FacebookStrategy 	= require('passport-facebook').Strategy
    , TwitterStrategy 	= require('passport-twitter').Strategy
    , check_active_login= require('./routes/check_active_login')
    , friends 			= require('./routes/user/friends')
    , addfriend			= require('./routes/user/addfriend')
    , getcurrentuser    = require('./routes/user/getcurrent');
    ;

global.connect			= require('connect');
global.notify			= require('./routes/jot/notify');
global.events			= require('events');

var RedisStore 			= require('connect-redis')(express);
var redis 				= require("redis");
var winston 			= require('winston');
var mysql 				= require('mysql');
var poolModule 			= require('generic-pool');

global.moment 			= require('moment');
global.easydb 			= require('./lib/easydb');

var shuttingDown = false;

var REDIS_SERVER = '';
var REDIS_PORT = 0;
var REDIS_PASSWORD = "";

global.logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({ level: 'debug', timestamp: true }),
    ]
  });

global.utils = {};

global.utils.get_session_id_fast = function(req)
{
	//connect.utils.parseSignedCookies(req.cookies) not used.
	var cookie = req.cookies[config.SESSION_KEY];
	if(!cookie) return false;
	
	var j = cookie.indexOf("s:");
	if(j >= 0)
	{
		var k = cookie.indexOf(".");
		return cookie.substring(j+2, k);
	}else
		return cookie;
}

if(process.env.MOBILE_APP_SERVER)
{
	 global.config.mobileAppServer = 
		 (process.env.MOBILE_APP_SERVER.toLowerCase() == "yes") ? true : false;
}

var successPage = "/myjots";
if(config.mobileAppServer)
{
	successPage = "/success.html";
}

if(process.env.VCAP_SERVICES)
{
    vcap = JSON.parse(process.env.VCAP_SERVICES);
}

var MYSQL_SERVER = '';
var MYSQL_PORT = 0;
var MYSQL_PASSWORD = '';
var MYSQL_USER = '';
var MYSQL_DB = 'jotlee';

if(vcap)
{
	logger.debug(vcap);
	for(key in vcap)
	{
		if(key.indexOf("redis") > -1)
		{
			REDIS_SERVER = vcap[key][0].credentials.hostname;
			REDIS_PORT =  vcap[key][0].credentials.port;
			REDIS_PASSWORD = vcap[key][0].credentials.password;
		}else
		if(key.indexOf("mysql") > -1)
		{
			MYSQL_SERVER = vcap[key][0].credentials.hostname;
			MYSQL_PORT   = vcap[key][0].credentials.port;
			MYSQL_USER = vcap[key][0].credentials.username;
			MYSQL_PASSWORD = vcap[key][0].credentials.password;
			MYSQL_DB = vcap[key][0].credentials.name;
		}
	}
}


//Create a MySQL connection pool with
//a max of 10 connections, a min of 2, and a 30 second max idle time

global.pool = poolModule.Pool({
name     : 'mysql',
create   : function(callback) {   
   var c = mysql.createConnection(
  		 {
  			 host : MYSQL_SERVER,
  			 user : MYSQL_USER,
  			 password : MYSQL_PASSWORD,
  			 database : MYSQL_DB,
  			 timezone: "+0000"
  		 });
   c.connect();
   //logger.debug("pool create: connected");
   callback(null, c);
   // parameter order: err, resource
   // new in 1.0.6
/*   c.query("SET SESSION sql_mode='STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE'", function(err, res)
   {
	   if(err)
		   logger.error("SQL SET sql_mode error: " + err + " result: " + JSON.stringify(res));
   	    callback(err, c);
 	 });*/
},
destroy  : function(client) { client.end(); },
max      : 10,
// optional. if you set this, make sure to drain() (see step 3)
min      : 1, 
// specifies how long a resource can stay idle in pool before being removed
idleTimeoutMillis : 30000,
// if true, logs via console.log - can also be a function
log : false 
});

global.RedisType = {SESSION:0, JOT: 1, NOTIFY: 2, NOTIFY_SUSCRIBE: 3};
global.RedisPrefix = {USER: 'jl:', JOT: 'jot:', NOTIFY_Q: 'note:', SESSION_KEY_SET: 'skeys:', 
		              SESSION: 'sid:', CHANNEL: 'chn:'};

var defaultRedisClient = redis.createClient(REDIS_PORT, REDIS_SERVER);

var subscribeRedisClient = redis.createClient(REDIS_PORT, REDIS_SERVER);

defaultRedisClient.auth(REDIS_PASSWORD, function(err)
		{
			if(err)
				logger.error("Redis auth failed: " + err + " for: " + REDIS_SERVER + " at " + REDIS_PORT);
		});


subscribeRedisClient.auth(REDIS_PASSWORD, function(err)
		{
			if(err)
				logger.error("Redis auth failed: " + err + " for: " + REDIS_SERVER + " at " + REDIS_PORT);
		});


global.redisClient = function(type)
{
	if(type == RedisType.NOTIFY_SUBSCRIBE)
		return subscribeRedisClient;
	else
		return defaultRedisClient;
}


//var BASE = "http://192.168.160.92:8080";
//var BASE = "http://jotelee.aws.af.cm";
var BASE = process.env.BASE_URL;
var COOKIE_DOMAIN='jotlee.com';
	
passport.use(new GoogleStrategy({
    returnURL: BASE + '/auth/google/return',
    realm: BASE + "/",
    stateless: true,
    passReqToCallback: true
  },
  function(req, identifier, profile, done) {
	  var user={};
	  user.id = "gg:"+ identifier;
	  user.auth = "google";
	  user.displayName = profile.displayName;
	  user.email = profile.emails[0].value;
	  user.name = false;
	  user.extName = "";

	  logger.debug("gg prof: " + JSON.stringify(profile));
	  var db = easydb();
	  
	  db
	  .query(function()
			  {
		  		return {query: "select users.userid, users.username, users.display_name, " + 
		  					    "users.email, users.username_lc " + 
		  						"from ext_auth inner join users on ext_auth.userid=users.userid where "+
		  						"ext_auth.authid=? and ext_auth.provider=?", 
		  				params: [identifier, 'gg']};
			  })
	   .success(function(rows)
			   {
		   			if(rows.length > 0)
		   			{
	        			user.id = RedisPrefix.USER + rows[0].userid;
	        			user.internalId = rows[0].userid;
	        			user.name = rows[0].username;
	        			user.displayName = rows[0].display_name;
	        			user.email = rows[0].email;		   				
		   			}
			   })
	   .done(function()
			 {
           			done(null, user);
			 })
	   .error(function(err)
			  {
		   			var err = "DB error: " + err;
           			done(err, user);           		   			   			
			  })
		.execute();	  
  }
));

//var FACEBOOK_APP_ID = "477483935671127";
//var FACEBOOK_APP_SECRET = "00e9b554e266e9ba5d12140651ad59b8";

var FACEBOOK_APP_ID = 	"548559371872679";
var FACEBOOK_APP_SECRET = "44a90e7541e6b98fa3283225b2bc519e";

passport.use(new FacebookStrategy({
    clientID: FACEBOOK_APP_ID,
    clientSecret: FACEBOOK_APP_SECRET,
    callbackURL: BASE + "/auth/facebook/callback",
    passReqToCallback: true,
    stateless:true
  },
  function (req, accessToken, refreshToken, profile, done) {
	  var user = {};
	  logger.debug("facebook prof: " + JSON.stringify(profile));
	  user.auth = "facebook";
	  user.id = "fb:" + profile.id;
	  user.displayName = profile.displayName;
	  user.extName =  profile.username;
	  user.name = false;
	  user.email = "";

	  var db = easydb();
	  
	  db
	  .query(function()
			  {
		  		return {query: "select users.userid, users.username, users.display_name, " + 
		  					    "users.email, users.username_lc " + 
		  						"from ext_auth inner join users on ext_auth.userid=users.userid where "+
		  						"ext_auth.authid=? and ext_auth.provider=?", 
		  				params: [profile.id, 'fb']};
			  })
	   .success(function(rows)
			   {
		   			if(rows.length > 0)
		   			{
	        			user.id = RedisPrefix.USER + rows[0].userid;
	        			user.internalId = rows[0].userid;
	        			user.name = rows[0].username;
	        			user.displayName = rows[0].display_name;
	        			user.email = rows[0].email;		   				
		   			}
			   })
	   .done(function()
			 {
           			done(null, user);
			 })
	   .error(function(err)
			  {
		   			var err = "DB error: " + err;
           			done(err, user);           		   			   			
			  })
		.execute();	  

    }
  )
);

var TWITTER_CONSUMER_KEY = "npVXRCTElmTaPU5RT8zw";
var TWITTER_CONSUMER_SECRET = "zSZShRLwNckj7LEGHEn7VolArLDg8GhTOFcZuuaW30";

passport.use(new TwitterStrategy({
    consumerKey: TWITTER_CONSUMER_KEY,
    consumerSecret: TWITTER_CONSUMER_SECRET,
    callbackURL: BASE + "/auth/twitter/callback",
    passReqToCallback: true,
    stateless:true
  },
  function(req, token, tokenSecret, profile, done) {
	  var user = {};
	  logger.debug("twitter prof:" + JSON.stringify(profile));
	  user.auth = "twitter";
	  user.id = "tw:" + profile.id;
	  user.displayName = profile.displayName;
	  user.extName = profile.username;
	  user.name = false;
	  user.email = "";
	  var db = easydb();
	  
	  db
	  .query(function()
			  {
		  		return {query: "select users.userid, users.username, users.display_name, " + 
		  					    "users.email, users.username_lc " + 
		  						"from ext_auth inner join users on ext_auth.userid=users.userid where "+
		  						"ext_auth.authid=? and ext_auth.provider=?", 
		  				params: [profile.id, 'tw']};
			  })
	   .success(function(rows)
			   {
		   			if(rows.length > 0)
		   			{
	        			user.id = RedisPrefix.USER + rows[0].userid;
	        			user.internalId = rows[0].userid;
	        			user.name = rows[0].username;
	        			user.displayName = rows[0].display_name;
	        			user.email = rows[0].email;		   				
		   			}
			   })
	   .done(function()
			 {
           			done(null, user);
			 })
	   .error(function(err)
			  {
		   			var err = "DB error: " + err;
           			done(err, user);           		   			   			
			  })
		.execute();	  

  }
));

passport.serializeUser(function(user, done) {
	  //logger.debug("serialize user: " + JSON.stringify(user));
	  redisClient(RedisType.SESSION).setex(user.id, config.SESSION_EXPIRY, JSON.stringify(user));
	  done(null, user.id);
	});

	passport.deserializeUser(function(id, done) {
		//logger.debug("deserialize user: " + id);
		var redisdb = redisClient(RedisType.SESSION);
		redisdb.get(id, function(err, value)
		{
			if(err)
			{
				logger.error("deserialize user error" + JSON.stringify(err));
				done(err, {});
			}
			else
			{
				redisdb.expire(id, config.SESSION_EXPIRY);				
				//logger.debug("got user:" + value);
				done(null, JSON.parse(value));
			}
		});

	});

notify.init();

var app = express();

var server = http.createServer(app);

/*var c = connect.utils.parseSignedCookies({"connect.sid":"s:bupjHThZxtNLkZUgsyiJ1SUa.GLoXFAMyed4dR6ufVSyT0A8/OF6zgWG5jw63NFrVHes"}, 'amritamma');
console.log(JSON.stringify(c));*/

// all environments
app.set('port', process.env.PORT || 8080);
app.set('views', config.views);
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.query());
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser()); 
app.use(express.session({ key: config.SESSION_KEY, secret: config.SESSION_SECRET, 
	                     cookie : {httpOnly:false, maxAge: null, path: '/'},//, domain: COOKIE_DOMAIN
						store: new RedisStore({ prefix: RedisPrefix.SESSION, client: redisClient(RedisType.SESSION) })
						}));
app.use(function(req, res, next){
	  var sock = req.socket;
	  sock.removeAllListeners('timeout');
	  sock.setTimeout(15*1000);
	  sock.on('timeout', function() {
		  if(shuttingDown)
		  {
			  logger.debug("Socket timeout in shutdown mode. closing...");
			  sock.destroy();
		  }
	  });
	 if(!shuttingDown)
	 {		 
		 return next();
	 }
	 else
	 {
		 logger.debug("Got request in shutdown mode: closing connection....");
		 res.setHeader("Connection", "close");
		 res.send(502, "Server is in the process of restarting");
		 req.socket.destroy();
	 }
});

/*
  //use with domain option for cookies:
   app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Origin',      req.headers.origin);
    res.header('Access-Control-Allow-Methods',     'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers',     'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');
    next();
  });*/
app.use(passport.initialize());
app.use(passport.session());

app.use(function (req, res, next) {
    res.locals({
        get user() { // as a getter to delay retrieval until `res.render()`
            return req.user;
        },

        isAuthenticated: function () {
            return req.user != null;
        }
    })

    next();
});
app.use(app.router);
app.use(express.static(config.public_html));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

//app.get('/', routes.index);

app.get('/auth/google', check_active_login.index);

app.get('/auth/google', passport.authenticate('google'));
app.get('/auth/google/return', 
		  passport.authenticate('google', { successRedirect: successPage,
		                                    failureRedirect: '/login' }));

app.get('/auth/facebook', check_active_login.index);
app.get('/auth/facebook', passport.authenticate('facebook'));

app.get('/auth/facebook/callback', 
		  passport.authenticate('facebook', { successRedirect: successPage,
		                                      failureRedirect: '/login' }));

app.get('/auth/twitter', check_active_login.index);
app.get('/auth/twitter', passport.authenticate('twitter'));
app.get('/auth/twitter/callback', 
		  passport.authenticate('twitter', { successRedirect: successPage,
		                                     failureRedirect: '/login' }));
app.get('/login', routes.index);
app.get('/myjots', myjots.myjots);
app.get('/settings', settings.index);
app.all('/refreshsession', refreshsession.index);
app.all('/switchuid', switchuid.index);
app.get("/logout", logout.logout);
app.post('/user/create', createuser.index);
app.post('/user/checkname', checkusername.index);
app.post('/user/translate_names', translate_names.index);
app.post('/user/translate_ids', translate_ids.index);
app.all('/user/friends', friends.index);
app.all('/user/addfriend', addfriend.index);
app.all('/user/getcurrent', getcurrentuser.index);
app.post('/jot/submit', jotsubmit.index);
app.post('/jot/poll', jotpoll.index);
app.post('/jot/action', jotaction.index);

app.all('/getdate', getdate.index);



server.on('connection', function(socket) {
	  console.log("A new connection was made by a client.");
	  socket.setTimeout(5 * 60 * 1000); 
	});

server.listen(app.get('port'), function(){
  logger.info('Express server listening on port %s', app.get('port'));
});


function gracefulExit()
{
	if(shuttingDown)
	{
		logger.info("Shutdown already in progress");
	//	return; //TODO add return
	}
	logger.info("Received kill signal (SIGTERM), shutting down gracefully.");
	shuttingDown = true;
	server.close(function(){
		logger.info("Closed out remaining connections.");
		pool.drain(function() {
		    pool.destroyAllNow();
			logger.info("Drained the pool.");		    
			process.exit();
		});
	});

	setTimeout(function(){
		logger.info( "Could not close connections in time, forcefully shutting down");
		process.exit(1);
	}, 60*1000 );
}
process.on('SIGTERM', gracefulExit).on('SIGINT', gracefulExit);

logger.info("Done initializing...");
