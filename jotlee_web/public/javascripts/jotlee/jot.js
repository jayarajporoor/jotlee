function jot_format_period(parsedJot)
{
	var dayNames =["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
	var pdesc = parsedJot.periodDesc;	
	
	var txt = "";
	var ampm = "am";
	var hour12 = pdesc.hour % 12;
	if(pdesc.hour > 12)
		ampm = "pm";
	if(pdesc.type == 'd')
	{
		txt = "Every day";
	}else
	if(pdesc.type == 'w')
	{
		txt = "Every " + dayNames[pdesc.day_or_date];
	}else
	if(pdesc.type == 'm')
	{
		txt = "Every month on " + pdesc.day_or_date; 
	}else
	if(pdesc.type == 'y')
	{
		txt = "Every year on " + monthNames[pdesc.offset_or_month] + " " + pdesc.day_or_date;
	}
	
	var min = pdesc.min.toString();
	if(pdesc.min < 9)
		min = "0" + min;
	txt = txt + " at " + hour12 + ":" + min + " " + ampm;
	
	return  txt;
}

function jot_format_duration(parsedJot)
{
	var dur = parsedJot.parsedDuration;
	
	var txt = "";
	var foundField = false;
	
	if(dur.days > 0)
	{
		txt = dur.days + " day(s)";
		foundField = true;
	}
	
	if(dur.hours > 0)
	{
		if(foundField) txt += ", ";
		txt += dur.hours + " hour(s)";
		foundField = true;
	} 

	if(dur.mins > 0)
	{
		if(foundField) txt += ", ";
		txt += dur.mins + " min(s)";
		foundField = true;
	}
	if(!foundField)
		return "";
	else
		return txt;
}

function jot_fill_duration_from_activityEndTime(jot)
{
	jot.parsedDuration = {days:0, hours:0, mins: 0};	
	var n = new moment(jot.activityEndTime, "YYYY-MM-DD HH:mm:ss Z");
	jot.hasDuration = true;
	var delta  = n.diff(jot.expiryMoment);
	jot.parsedDuration.days = Math.floor(delta / (24*60*60*1000));
	delta = delta - jot.parsedDuration.days*24*60*60*1000;
	jot.parsedDuration.hours = Math.floor(delta/(60*60*1000));

	delta = delta - jot.parsedDuration.hours * 60 * 60 * 1000;
	jot.parsedDuration.mins =  Math.floor(delta / (60*1000));	
}

function jot_populate_fields_on_receive(jot)
{
	jot.expiryMoment = new moment(jot.expiryTime, "YYYY-MM-DD HH:mm:ss Z");
	jot.receivedMoment = new moment(jot.receivedTime, "YYYY-MM-DD HH:mm:ss Z");
	
	if(jot.duration)//rename
		jot.parsedDuration = jot.duration;
	else
	if(jot.activityEndTime && (jot.expiryTime != jot.activityEndTime) )
	{
		jot_fill_duration_from_activityEndTime(jot);
	}
}


function jot_skim(jot)
{
	var n = jot.lastIndexOf('@');
	var s =  jot.substring(0, n);
	var res = "";
	var append = true;
	for(var i =0;i<s.length;i++)
	{
		var c = s.charAt(i);
		if(c == '@')
			append = false;
		if(c == ' ')
			append = true;
		if(append)
			res += c;
	}
	return res;
}


function jot_split(jot)
{
	var re = /[a-zA-Z0-9@#_]+/g;

	var jotFields = {jot:jot, duration:[], time: [], tags: [], people: []};
	var v = jot.match(re);

	var timeStartIdx = false;
	var durationStartIdx = false;

	for(var i=v.length-1; i >= 0;i--)
	{
		v[i] = v[i].toLowerCase();
		if(timeStartIdx === false)
		{
			if(v[i].length > 0 && v[i].charAt(0) == '@')
				timeStartIdx = i;
			else
			if( (v[i] == "for" || v[i] == "fr") && v.length > i + 1)
			{
				durationStartIdx = i + 1;
			}			
		}
	}
	
	var w = v;
	if(durationStartIdx)
	{
		jotFields.duration= v.slice(durationStartIdx);
		w = v.slice(0, durationStartIdx - 1);
	}
	
	if (w[timeStartIdx] == '@')
		timeStartIdx++;
	else
		w[timeStartIdx] = w[timeStartIdx].substring(1);//remove @

	jotFields.time = w.slice(timeStartIdx);
	
	for(var i=0;i< timeStartIdx; i++)
	{
		if(w[i].charAt(0) == '@')
		{
			var s = w[i].substring(1);
			if(s != '' && jotFields.people.indexOf(s) < 0)
				jotFields.people.push(s);
		}else
		if(w[i].charAt(0) == '#')
		{
			var s = w[i].substring(1);
			if( s != '' && jotFields.tags.indexOf(s) < 0)
				jotFields.tags.push(s);
		}
	}
	
	return jotFields;

}

var days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
var lNext = ['next', 'nxt'];
var lWeek = ['week', 'wk'];
var lMonth = ['month', 'mnth', 'mth'];
var lDay = ['day', 'dy', 'da'];
var lYear = ['year', 'yr'];

var lEvery = ['every', 'evry', 'evy', 'evr'];

var lToday = ['today', 'tdy', 'td', 'tod'];

var months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep','oct', 'nov', 'dec'];

var ampm = ["a", "am", "morning", "morn", "p", "pm", "evening", "eve"];
var pmStartIdx = 4;

var am = ["a", "am", "morning", "morn"];
var pm = ["p", "pm", "evening", "eve"];

var dateIndicators = ["th", "st", "rd"];


function jot_get_suffix(s)
{
	var r = "";
	for(var i=0;i< s.length;i++)
	{
		if(s.charAt(i) >= 'a' && s.charAt(i) <= 'z')
			r = r + s.charAt(i);
	}
	return r;
}

function jot_parseHourMin(s, hm)
{
	var v = parseInt(s);
	var possibleMin = v % 100;
	var possibleHour = (v - possibleMin)/100;
	if(possibleHour == 0)
	{
		possibleHour = v;
		possibleMin = 0;
	}
	
	if(s.length >= 3 && s.charAt(1) >= '0' && s.charAt(1) <= '9' && 
			s.charAt(2) >= '0' && s.charAt(2) <= '9')
		hm.min = possibleMin % 60;
	hm.hour = possibleHour % 12;
}

function jot_parseTime(jotFields)
{
	var m = moment();
	var j;
	var deltaDays=0;
	var deltaMonths = 0;
	var day = false;
	var nextWeek = false;
	var hasAbsMonth = false;
	var hm = { hour : false, min: false};
	var year = false;
	var timeOrDate = false;
	var date = false;
	var mayNeedToAdjustHour = false;
	var ampmSpecified = false;
	var monthCorrected = false;
	var gotMonthIn = false;
	var daySpecified = false;
	var period = false;
	
	var t = jotFields.time;
	
	var mm = m.clone();
	
	for(var i=0;i<t.length;i++)
	{
		if(lEvery.indexOf(t[i].substring(0,5)) >= 0)
		{
			var next = ((i + 1) < t.length) ? t[i+1] : '';
						
			var suffix = t[i].substring(5);
			if( (lDay.indexOf(next)>=0) || lDay.indexOf(suffix) >= 0)
			{
				period = 'd';
			}else
			if(days.indexOf(next.substring(0,3)) >= 0)
			{
				period = 'w';
			}else
			if(lMonth.indexOf(next)>=0 || lMonth.indexOf(suffix) >= 0)
			{
				period = 'm';
				t[i+1] = months[m.month()];
			}else
			if(months.indexOf(next.substring(0,3))>=0 || lYear.indexOf(next) >= 0)
			{
				period = 'y';
			}
			continue;
		}
		
		if(t[i].substring(0,3) == 'tom')
		{
		    deltaDays++;
		    daySpecified = true;
		}
		else
		if(lDay.indexOf(t[i]) >=0 && (t.length > i + 2) && t[i+1].indexOf('aft') >= 0 && t[i+2].substring(0,3) == 'tom')
		{
			daySpecified = true;
			deltaDays+=2;
			i+=2;
		}
		else
		if(lToday.indexOf(t[i]) >= 0)
		{
			daySpecified = true;
		}
		else
		if(lNext.indexOf(t[i]) >= 0 && (t.length > i+1))
		{	
			//console.log('-1');
			i+=1;
			if(lWeek.indexOf(t[i]) >= 0)
			{
				nextWeek = true;
				if(day)
				{
					deltaDays = (7 - m.day()) + day;
					day = false;
				}
			}
			else if(lMonth.indexOf(t[i])>=0)
			{
				deltaMonths = 1;
			}			
			else if ((j=days.indexOf(t[i].substring(0,3))) >= 0)
			{			
				 deltaDays = (7-m.day()) + j;
			}
			
		}else
		if((j=days.indexOf(t[i].substring(0,3))) >= 0)
		{
			day = j;
			if(nextWeek)
			{
				deltaDays = (7 - m.day()) + day;
				day = false;
			}			
		}else
		if((j=months.indexOf(t[i].substring(0,3))) >= 0)
		{
			gotMonthIn = i;
			hasAbsMonth = true;
			var n = m.month();
			if(j < n)
			{
				deltaMonths = (12 - n) + j;
				monthCorrected = true;
			}else
				deltaMonths = j - n;
		}else
		if(t[i].charAt(0) >= '0' && t[i].charAt(0) <= '9')
		{
			var suffix = jot_get_suffix(t[i]);
			
			if((j=t[i].indexOf(":")) >= 0 || (t[i].indexOf(".") >= 0))
			{
				//console.log("1");
				var v = (j >= 0 ? t[i].split(":") : t[i].split("."));
				hm.hour = parseInt(v[0]) % 12;
				hm.min = parseInt(v[1]) % 60;
				if(v[1].indexOf("p") >= 0)
					hm.hour += 12;
				else
				if(t.length > i+1 && pm.indexOf(t[i+1]) >= 0 )
				{
					i++;
					hm.hour += 12;
				}else
				if(hm.hour < m.hour())
				{
					mayNeedToAdjustHour = true;
				}
			}else
			if((j=ampm.indexOf(suffix))>=0)
			{
				//console.log("4");
				hm.min = 0;				
				jot_parseHourMin(t[i], hm);
				if(j >= pmStartIdx)
					hm.hour += 12;
			}else
			if(dateIndicators.indexOf(suffix)>=0)
			{
				//console.log("5");				
				date = parseInt(t[i]);
			}else
			if((j=parseInt(t[i])) >= 2000)
			{
				year = j;
			}else
			if(gotMonthIn === i-1)
			{
				date = parseInt(t[i]);
			}else
			if(t.length > i+1 && (j=ampm.indexOf(t[i+1])) >= 0)
			{
				//console.log("2");	
				hm.min = 0;
				jot_parseHourMin(t[i], hm);
				if(j >= pmStartIdx)
					hm.hour += 12;
				i++;				
			}else				
			if(hm.hour !== false)
			{
				date = parseInt(t[i]);
			}else			
			if(t.length >  i+1 && t[i+1].charAt(0) >= '0' && t[i+1].charAt(0) <= '9')
			{
				//console.log("3");
				jot_parseHourMin(t[i], hm);
				
				if(hm.min === false && dateIndicators.indexOf(suffix) < 0)
				{
					i++;
					suffix = jot_get_suffix(t[i]);					
					hm.min  = parseInt(t[i]) % 60;
				}
				
				if(pm.indexOf(suffix) >= 0)
				{
					hm.hour += 12;
				}else
				if(t.length > i+1 &&  pm.indexOf(t[i+1]) >= 0)
				{
					i++;
					hm.hour += 12;
				}else
				if(hm.hour < m.hour())
					mayNeedToAdjustHour = true;
			}else
			if(daySpecified)
			{
				hm.min = 0;
				jot_parseHourMin(t[i], hm);
				mayNeedToAdjustHour = true;
			}else
			{
				//console.log("6");				
				timeOrDate = {hour:0, min:0, date:0};
				timeOrDate.date = parseInt(t[i]);
				jot_parseHourMin(t[i], timeOrDate);
			}			
		}
	}
	
	if(day)
	{
		if(day < m.day())
			deltaDays = (7-m.day()) + day;
		else
			deltaDays = day - m.day();
	}
	
	if(hasAbsMonth && (date ===false))
	{
		date = timeOrDate.date;
		timeOrDate = false;
	}
	
	if(timeOrDate && (hm.hour === false))
	{
		hm.min = timeOrDate.min;
		hm.hour = timeOrDate.hour;
		if(hm.hour < m.hour())
			mayNeedToAdjustHour = true;
	}
	
	if(year)
	{
		m.year(year);
		if(monthCorrected)
			deltaMonths -= 12;
	}
	m.month(m.month() + deltaMonths);

	if(!hasAbsMonth)
		m.day(m.day() + deltaDays);

	if(date !== false)
		m.date(date);
	if(hm.hour !== false)
		m.hour(hm.hour);
	if(hm.min !== false)
		m.minute(hm.min);
	m.second(0);
	m.millisecond(0);
	mm.second(0);
	mm.millisecond(0);
	if((m.valueOf() < mm.valueOf()) && mayNeedToAdjustHour)
	{
		m.hour(m.hour() + 12);
	}
		
	jotFields.expiryMoment = m;
	
	jotFields.periodDesc = {};
	if(period)
	{
		jotFields.isPeriodic = true;
		jotFields.periodDesc.type = period;
		jotFields.periodDesc.hour = hm.hour;
		jotFields.periodDesc.min = hm.min;
		if(period == 'w')
		{
			jotFields.periodDesc.day_or_date = day;
		}else
		if(period == 'm')
		{
			if(m.valueOf() < mm.valueOf())
			{
				m.month(m.month()+1);
			}
			jotFields.periodDesc.day_or_date = date;
		}else
		if(period == 'y')
		{
			if(m.valueOf() < mm.valueOf())
			{
				m.year(m.year()+1);
			}			
			jotFields.periodDesc.day_or_date = date;
			jotFields.periodDesc.offset_or_month = m.month();
		}
	}
	else
		jotFields.isPeriodic = false;
	
	
}

function jot_parseDuration(parsedJot)
{
	var suffix;
	
	var d = parsedJot.duration;
	parsedJot.hasDuration = false;
	
	parsedJot.parsedDuration = {};
	var dur = parsedJot.parsedDuration;
	dur.hours = 0;
	dur.mins = 0;
	dur.days = 0;
	
	if(d.length >= 2)//special treatment for half hour
	{
		if( (d[0] == 'half' || d[0] == 'hlf') && (d[1].charAt(0) == 'h') )
		{
			dur.mins = 30;
			parsedJot.hasDuration = true;			
			return;
		}
	}	
	
	for(var i =0;i<d.length; i++)
	{		
		var val = d[i];
		suffix = jot_get_suffix(val);
		
		if(suffix == '' && d.length > i + 1)
		{
			i++;
			suffix = d[i];
		}
		
		switch(suffix.charAt(0))
		{
			case 'h': dur.hours = parseInt(val); parsedJot.hasDuration = true; break;
			case 'd': dur.days = parseInt(val); parsedJot.hasDuration = true; break;
			case 'm': dur.mins = parseInt(val); parsedJot.hasDuration = true; break;
		}
	}

}


function jot_Parse(jot)
{
	var jotFields = jot_split(jot);
	
	jot_parseTime(jotFields);
	
	jot_parseDuration(jotFields);

	return jotFields;
	
}

if(typeof window == 'undefined')
{
	exports.jot_Parse = jot_Parse;
}