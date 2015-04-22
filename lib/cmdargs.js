module.exports = function(expTbl){
  var args = {_: []};
  var arg = function(idx){
    return process.argv[idx]||'';
  };
  var processArg = function(idx){
    var key = arg(idx);
    var isArg = key.substr(0,1)==='-';
    if(isArg){
      if(key.substr(1,1)!=='-'){
        key = expTbl[key.substr(1,1)];
      }
      if(key && key.substr(1,1)==='-'){
        key = key.substr(2);
      }
      if(!key){
        console.log('Unknown argument "'+(arg(idx).replace(/^[\-]+/, '').substr(0, 1))+'" skipped.');
        return 1;
      }
      var val = arg(idx+1);
      if((!val || (val.substr(0,1)==='-'))){
        args[key] = true;
        return 1;
      }
      if(args[key]){
        if(!(args[key] instanceof Array)){
          args[key] = [args[key]];
        }
        args[key].push(val);
        return 2;
      }
      args[key] = val;
      return 2;
    }
    args._.push(key);
    return 1;
  };
  var i = 2, l = process.argv.length, key;
  for(;i<l;){
    i += processArg(i);
  }
  return args;
};
