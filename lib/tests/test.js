var test = {abc: 0, def: 1, efg: 2};

var x = test.def;


switch(x)
{
  case test.abc: console.log('abc');break;
  case test.def: console.log('def');break;
}
