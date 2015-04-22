var logger = {
  info: function(){
    console.log.apply(console, arguments);
  },
  error: function(){
    console.log.apply(console, arguments);
  }
};

module.exports = logger;
