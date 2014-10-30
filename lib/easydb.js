function EasyDb() {
	this.queries = [];
	this.successH = [];
	this.errorH = null;	
	this.alwaysH = null;
	this.client   = null;
	this.transaction = false;
	this.doneH = null;
}

EasyDb.prototype.query = function(q) {
	if(this.successH.length < this.queries.length)
		this.successH.push(null);
	this.queries.push(q);
	this.lastCallWasQuery = true;
	return this;
}

EasyDb.prototype.success = function(s) {
	this.successH.push(s);
	return this;
}

EasyDb.prototype.error = function(e)
{
	this.errorH = e;
	return this;
}

EasyDb.prototype.always = function(a)
{
	this.alwaysrH = a;
	return this;
}

EasyDb.prototype.done = function(d)
{
	this.doneH = d;
	return this;
}


EasyDb.prototype.clear = function()
{
	if(this.alwaysH)
		this.alwaysH();
	pool.release(this.client);
	this.transaction = false;
	this.client = null;
}


EasyDb.prototype.cancel = function()
{//cancel pending queries.
	this.queries = [];
	this.successH = [];
}

function _execute_queries(easyDb)
{
	if(easyDb.queries.length == 0)
	{
		if(easyDb.transaction)
		{
			easyDb.client.query("COMMIT",
				function(err, rows)
				{
					if(err)
					{
						logger.error("COMMIT failed: " + err);
						easyDb.errorH(err);
					}else
					{
						if(easyDb.doneH)
							easyDb.doneH();
					}
					easyDb.clear();
				}
			);
		}else
		{
			if(easyDb.doneH)
				easyDb.doneH();
			easyDb.clear();
		}
		return;
	}
	
	var queryF = easyDb.queries.shift();
	
	var query  = queryF(); //generate query
	easyDb.client.query(query.query, query.params,
		function(err, rows)
		{
			if(err)
			{
				logger.error("Query failed: " + query.query + ", params: " + JSON.stringify(query.params) + " error: " + err);
				if(easyDb.errorH)
					easyDb.errorH(err);
				if(easyDb.transaction)
				{
					easyDb.transaction = false;
					easyDb.client.query("ROLLBACK", 
						function(err, rows)
						{
							if(err)
							{
								logger.error("cannot rollback transaction %s", err);
							}
							easyDb.clear();
						}
					);
				}else
				{
					easyDb.clear();
				}
			}else
			{
				var successF = easyDb.successH.shift();
				if(successF)
					successF(rows);
				_execute_queries(easyDb);
			}
		}
	);

}

EasyDb.prototype.execute = function(options)
{
	if(!options)
		options = {};
	var easyDb = this;
	global.pool.acquire(
		function(err, client){
			if (err) {
				logger.error("cannot acquire pool instance %s", err);
				if(easyDb.errorH)
					easyDb.errorH(err);
				easyDb.clear();
			 }else
			 {
				 easyDb.client = client;
				 easyDb.transaction = options.transaction ? options.transaction : false;
				 if(easyDb.transaction)
				 {
					 client.query("START TRANSACTION", 
					    function(err, rows)
						{
						 	if(err)
						 	{
						 		logger.error("start transaction failed: %s", err);
						 		if(easyDb.errorH)
						 			easyDb.errorH(err);
						 		easyDb.clear();
						 	}else
						 	{
						 		_execute_queries(easyDb);
						 	}
						}
					  );
				 }else
					 _execute_queries(easyDb);
			 }
		}
    );
}

module.exports = function() {
    return new EasyDb();
}
