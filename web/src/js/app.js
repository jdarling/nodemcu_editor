var React = require('react');
var Support = require('../lib/support');

var params = Support.params();

var Layout = require('./layout.jsx');

var LayoutFactory = React.createFactory(Layout);

params.pageName=params.page||location.pathname;
React.render(LayoutFactory(params), document.body);
