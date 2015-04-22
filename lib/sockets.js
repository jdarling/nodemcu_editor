var SocketIO = require('socket.io');
var logger = require('../lib/logger');
var utils = require('../lib/utils');
var config = utils.defaults(require('./config')['socket.io'], {route: '/api/v1/'});
var io;

var Sockets = function(){
  var self = this;
  self._listeners = [];
};

Sockets.prototype.init = function(server){
  var self = this;
  var io = SocketIO.listen(server, config);
  io.sockets.on('connection', function(socket){
    socket.on('message', function(msg){
      logger.log('Message: ', msg);
      socket.broadcast.emit('message', msg);
    });
    self._listeners.forEach(function(listener){
      socket.on(listener.event, (function(handler){
        return function(data, fn){
          handler(data, socket, fn);
        };
      })(listener.handler));
    });
  });
  self.io = function(callback){
    return callback(io);
  };
};

Sockets.prototype.io = function(callback){
  setImmediate(function(){
    this.io(callback);
  }.bind(this));
};

Sockets.prototype.on = function(event, handler){
  var self = this;
  self._listeners.push({
    event: event,
    handler: handler
  });
};

Sockets.prototype.broadcast = function(event, msg){
  var self = this;
  self.io(function(io){
    io.sockets.emit(event, msg);
  });
};

module.exports = Sockets;
