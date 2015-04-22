var logger = require('../lib/logger');
var fs = require('fs');
var Hapi = require('hapi');
var util = require('util');
var utils = require('./utils');
var path = require('path');
var config = require('./config');
var baseDir = path.join(__dirname, '../');
var apiConfig = utils.defaults(config.api, {route: '/api/v1/'});
var pluginsPath = path.join(baseDir, config.pluginsPath||'plugins/');
var async = require('async');
var pjson = require('../package.json');
var webconfig = config.static = utils.defaults({port: 8080, host: '0.0.0.0', site: '/web/site'}, config.web);
var async = require('async');

var Sockets = require('../lib/sockets');
var sockets = new Sockets();

var PORT = webconfig.port;
var HOST = webconfig.host;

var server = new Hapi.Server();

server.connection({host: HOST, port: PORT});

server.on('internalError', function(e){
  logger.error(e);
});

var started = function(){
  sockets.init(server.listener);
  logger.info(pjson.name+' website started on http://'+HOST+':'+PORT);
};

var loadPlugins = function(plugins, callback){
  async.each(plugins, function(name, next){
    if(name !== '.' && name !== '..'){
      logger.info('Loading plugin: ', name);
      var f = require(path.join('../plugins/', name));
      return f({
        hapi: server,
        sockets: sockets,
        logger: logger,
        config: config[name]
      }, next);
    }
    return next();
  }, function(){
    callback();
  });
};

var plugins = config.plugins || false;
if(!plugins){
  return fs.readdir(path.join(__dirname, '../plugins/'), function(err, list){
    if(err){
      return logger.error(err);
    }
    return loadPlugins(list, function(){
      server.start(started);
    });
  });
}

loadPlugins(plugins, function(){
  server.start(started);
});

module.exports = server;
