var React = require('react');
var canUseDOM = require('react/lib/ExecutionEnvironment').canUseDOM;
var Support = require('../lib/support');
var classList = Support.classList;
var getAttrs = Support.getAttrs;
var bus = require('../lib/eventbus');

var supportsHistory = function(){
  /*! taken from modernizr
   * https://github.com/Modernizr/Modernizr/blob/master/LICENSE
   * https://github.com/Modernizr/Modernizr/blob/master/feature-detects/history.js
   */
  var ua = navigator.userAgent;
  if ((ua.indexOf('Android 2.') !== -1 ||
      (ua.indexOf('Android 4.0') !== -1)) &&
      ua.indexOf('Mobile Safari') !== -1 &&
      ua.indexOf('Chrome') === -1) {
    return false;
  }
  return (window.history && 'pushState' in window.history);
};

var addListener = (function(){
  if(window.addEventListener){
    return function(eventName, handler){
      window.addEventListener(eventName, handler, false);
    };
  }
  return function(eventName, handler){
    window.attachEvent('on'+eventName, handler);
  };
})();

var _encode = function(path){
  return encodeURI(path).replace(/%20/g, '+');
};

var _decode = function(path){
  return decodeURI(path.replace(/\+/g, ' '));
};

var HistoryHandler = function(options){
  if(window.location.pathname.length<2 && window.location.hash){
    var path = window.location.hash.replace(/^#/, '');
    window.history.replaceState({ path: path }, '', _encode(path));
  }
  addListener('popstate', this.pageChanged.bind(this));
};

HistoryHandler.prototype.push = function(path){
  window.history.pushState({path: path}, '', _encode(path));
  this.pageChanged();
};

HistoryHandler.prototype.pop = function(){
  window.history.back();
};

HistoryHandler.prototype.replace = function(path){
  window.history.replaceState({ path: path }, '', _encode(path));
  this.pageChanged();
};

HistoryHandler.prototype.page = function(){
  return _decode(window.location.pathname + window.location.search);
};

HistoryHandler.prototype.makeLink = function(path){
  return path;
};

HistoryHandler.prototype.pageChanged = function(){
  var page = this.page();
  bus.emit('page::change', page);
};

var HashHandler = function(){
  if((!this.page()) && window.location.pathname.length>1){
    var path = window.location.pathname;
    window.location = '/#'+(path.substr(0,1)==='/'?path:'/'+path);
  }
  addListener('hashchange', this.pageChanged.bind(this));
};

HashHandler.prototype.push = function(path){
  window.location.hash = _encode(path);
};

HashHandler.prototype.pop = function(){
  History.back();
};

HashHandler.prototype.replace = function(path){
  window.location.replace(window.location.pathname + '#' + _encode(path));
};

HashHandler.prototype.page = function(path){
  var parts = (path||window.location.href).split('#');
  return _decode(parts.slice(1).join('#'));
};

HashHandler.prototype.makeLink = function(path){
  return '#'+path;
};

HashHandler.prototype.pageChanged = function(){
  var page = this.page();
  bus.emit('page::change', page);
};

var getHandler = function(options){
  if((!canUseDOM) || supportsHistory){
    return new HistoryHandler(options);
  }
  return new HashHandler(options);
};

var historyHandler = (function(){
  var historyHandler = false;
  return function(options){
    return historyHandler || (historyHandler = getHandler(options));
  };
})();

var Router = function(opts){
  var options = this.options = opts||{};
  this.pages = {};
  this.mappers = [];
  if(options.pages instanceof Array){
    this.add.apply(this, options.pages);
  }
  if((options.pages instanceof Object)&&(!(options.pages instanceof Array))){
    this.add(options.pages);
  }
};

Router.prototype.addPage = function(route, Page){
  var reGetTokens = /{([^/}]+)?}/g;
  var keys = [];
  var src = '^'+route.replace(reGetTokens, function(match, token){
    keys.push(token);
    return '([^/?}]+)';
  })+'$';
  var mapKey = new RegExp(src);
  var page = this.pages[route] = React.createFactory(Page);
  this.mappers.push({
      route: route,
      regEx: mapKey,
      params: keys,
      page: page
    });
  return this;
};

Router.prototype.setPage = function(toPage){
  this.handler.push(toPage);
};

Router.prototype.add = function(){
  if(arguments.length === 1){
    var pages = arguments[0];
    var keys = Object.keys(pages);
    keys.forEach(function(key){
      var Page = pages[key];
      this.addPage(key, Page);
    }.bind(this));
  }
  if(arguments.length !== 1){
    var i=0, l = arguments.length - (arguments.length % 2);
    for(; i<l; i=i+2){
      this.addPage(arguments[i], arguments[i+1]);
    }
  }
  return this;
};

Router.prototype.get = function(pageName){
  var route= (pageName||'').split('?').shift();
  var page = this.pages[route];
  var params, args, matchLength = 0;
  if(!page){
    this.mappers.forEach(function(mapper){
      if(params = mapper.regEx.exec(route)){
        if(params.length>matchLength){
          page = mapper.page;
          args = mapper.params.reduce(function(res, key, index){
            res[key] = params[index+1];
            return res;
          }, {});
          matchLength = params.length;
        }
      }
    }.bind(this));
  }
  return {
      view: page||this.pages[this.options.defaultPage||'/home']||this.pages.default,
      params: args
    };
};

var isNormalClick = function(e){
  var button = e.buttons || e.which || e.button;
  if(e.metaKey || e.ctrlKey){
    return false;
  }
  // Check for chrome and its "Special" behavior
  if(('buttons' in e) && (e.buttons === undefined)){
    return button === 0;
  }
  // Now for everyone else, oddly including IE
  return button === 1;
};

RouteLink = React.createClass({
  changePage: function(e){
    if(isNormalClick(e||event)){
      e.preventDefault();
      historyHandler().push(this.props.to);
    }
  },
  isRemote: function(link, hasTarget){
    if(!!hasTarget){
      return true;
    }
    if((link.split(/[\?#]/)[0]||'').match(/^[a-z0-9]+:\/\//)){
      return true;
    }
    return false;
  },
  makeLink: function(from, isRemote){
    if(isRemote){
      return from;
    }
    return historyHandler().makeLink(this.props.to);
  },
  render: function(){
    var classNames = classList(this, {
      });
    var isRemoteLink = this.isRemote(this.props.to, this.props.target);
    var link = this.makeLink(this.props.to, isRemoteLink);
    var props = getAttrs(this.props, ['className', 'to']);
    if(!isRemoteLink){
      props.onClick = this.changePage;
    }
    return(
      <a {...props} className={classNames} href={link}>
        {this.props.children}
      </a>
    );
  }
});

module.exports = {
  router: new Router(),
  Router: Router,
  RouteLink: RouteLink
};
