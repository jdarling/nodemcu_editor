var React = require('react');
var Loader = require('../lib/loader');
var Support = require('../lib/support');
var sockets = require('../lib/socket');

var noop = function(){};

var sampleSource = `-- a simple http server
srv=net.createServer(net.TCP)

srv:listen(80,function(conn)
  conn:on("receive",function(conn,payload)
    print(payload)
    conn:send("<h1> Hello, NodeMCU.</h1>")
  end)
end)`;

var sampleSource = `Account = { balance = 0 }
function Account:new (o)
  o = o or {}	-- create object if user does not provide one
  setmetatable(o, self)
  self.__index = self
  return o
end

function Account.withdraw (self, v)
  self.balance = self.balance - v
end

function Account.deposit (self, v)
  self.balance = self.balance + v
end

a = Account:new{balance = 0}
a:deposit(100.00)
print(a.balance)	--> 100

b = Account:new()
print(b.balance)	--> 0
`;


var Select = require('react-select');

var fileList = {
  'foo1': 'foo1.js',
  'foo2': 'foo2.js',
  'bar': {
    'bars child 1': 'bar/bars_child.js',
    'bars child 2': 'bar/bars_child.js'
  }
};

var colony = require('colony-compiler');

var Bootstrap = require('react-bootstrap');
var Navbar = Bootstrap.Navbar;
var Nav = Bootstrap.Nav;
var NavItem = Bootstrap.NavItem;
var DropdownButton = Bootstrap.DropdownButton;
var MenuItem = Bootstrap.MenuItem;
var TabbedArea = Bootstrap.TabbedArea;
var TabPane = Bootstrap.TabPane;
var Grid = Bootstrap.Grid;
var Row = Bootstrap.Row;
var Col = Bootstrap.Col;
var ListGroup = Bootstrap.ListGroup;
var ListGroupItem = Bootstrap.ListGroupItem;

var Ace  = require('./ace.jsx');

var ConsoleOutput = React.createClass({
  componentWillUpdate: function() {
    var node = this.getDOMNode();
    this.shouldScrollBottom = node.scrollTop + node.offsetHeight === node.scrollHeight;
  },
  componentDidUpdate: function() {
    if (this.shouldScrollBottom) {
      var node = this.getDOMNode();
      node.scrollTop = node.scrollHeight
    }
  },
  render: function(){
    var lines = (this.props.lines||'').split('\n').map(function(line, index){
      return <p key={index}>{line}</p>;
    });
    return (
      <div className="output">{{lines}}</div>
    );
  }
});

var Console = React.createClass({
  getInitialState: function(){
    return {
      buffer: ''
    };
  },
  componentDidMount: function(){
    sockets.on('serial::data', function(data){
      this.setState({
        buffer: this.state.buffer+data
      });
    }.bind(this));
  },
  terminalTextChange: function(e){
    return this.setState({
        inputText: e.target.value
      });
  },
  processTerminalKey: function(e){
    var command = React.findDOMNode(this.refs.command).value||'';
    if(e.charCode === 13){
      return runScript(command, function(){
        return this.setState({
            inputText: ''
          });
      }.bind(this));
    }
  },
  render: function(){
    var inputText = this.state.inputText;
    return (
      <div className="console">
        <ConsoleOutput lines={this.state.buffer} />
        <input className="command" id="terminalCommand" name="terminalCommand" ref="command"
          value={inputText}
          onChange={this.terminalTextChange}
          onKeyPress={this.processTerminalKey} />
      </div>
    );
  }
});

var FileBrowser = React.createClass({
  handleClick: function(e){
    var target = e.target;
    var info = (target.getAttribute('value')||'').split(':');
    var action = info[0];
    var value = info[1];
    switch(action){
      case('toggle'):
        var node = React.findDOMNode(this.refs[value]);
        node.style.display = !node.style.display?'none':'';
        break;
      case('load'):
        this.props.onLoadFile(value);
        break;
      default:
        return;
    }
    e.stopPropagation();
  },
  render: function(){
    /*
    var buildList = function(from, prefix){
      var p = prefix || '';
      var result = Object.keys(from).map(function(key, index){
          var value = from[key];
          var type = typeof(value);
          if(type==='string'){
            return <ListGroupItem key={p+'_'+index} value={'load:'+value}>{key}</ListGroupItem>;
          }
          return <ListGroupItem bsStyle='warning' value={'toggle:'+p+'_'+index}>{key}
                   <ListGroup ref={p+'_'+index} key={p+'_'+index}>{buildList(value, p+'_'+index)}</ListGroup>
                 </ListGroupItem>;
        }.bind(this));
      return result;
    }.bind(this);
    var items = buildList(fileList);
    */
    var items = (this.props.items||[]).map(function(item, index){
      return <ListGroupItem key={index} value={'load:'+item.fileName}>{item.fileName}</ListGroupItem>;
    });

    return (
      <div onClick={this.handleClick}>
        <ListGroup>
          <ListGroupItem bsStyle='info'>File Browser</ListGroupItem>
          {items}
        </ListGroup>
      </div>
    );
  }
});

var runScript = function(script, callback){
  sockets.emit('serial::write', script, callback);
  //return Loader.post('/api/v1/serial/put', {data: script}, callback||noop);
};

var SCRIPT_COMMANDS = {
  'Refresh Listing': function(){
    this.loadFiles();
    return false;
  },
  'Run': '{selection}',
  'Reset': 'node.restart();',
  'Save': function(options){
    var src = options.source.split('\n');
    var script = src.map(function(line){
      return 'file.writeline('+JSON.stringify(line)+');';
    }).join('\n');
    script = `file.open(".__ide.lua", "w");
      ${script}
      file.close();`;
    runScript(script, function(){
      this.loadFiles();
    }.bind(this));
    return false;
  },
  'Run Saved': 'dofile(".__ide.lua");',
  'Get IP': '=wifi.sta.getip();',
  'Heap Info': '=node.heap();',
  'Chip ID': '=node.chipid();',
  'List Files': 'for k,v in pairs(file.list()) do l = string.format("%-15s",k) print(l.."   "..v.." bytes") end',
  'Scan for AP\'s': `wifi.setmode(wifi.STATION);
    wifi.sta.getap(function(t)
    if t then
      print("Visible Access Points:");
      for k,v in pairs(t) do
        l = string.format("%-10s",k);
        print(l.."  "..v);
      end
    else
      print("Try again");
    end
    end)`,
};

var Layout = React.createClass({
  getInitialState: function(){
    return {
      files: [],
      source: '',
    };
  },
  loadFiles: function(){
    var source = this.refs.editor.editor.getValue();
    Loader.get('/api/v1/files', function(err, listing){
      if(listing){
        return this.setState({
          source: source,
          files: listing
        });
      }
    }.bind(this));
  },
  componentDidMount: function(){
    this.loadFiles();
  },
  runScript: function(scriptName){
    return function(){
      var editor = this.refs.editor.editor;
      var src = editor.getValue();
      var selection = editor.getSelectedText()||src;
      var script = SCRIPT_COMMANDS[scriptName]||scriptName;
      if(typeof(script)==='string'){
        var opts = {
          source: src,
          selection: selection,
        };
        return runScript(script.replace(/\{([a-z0-9]+)\}/ig, function(full, token){
          return opts[token];
        }));
      }
      if(typeof(script)==='function'){
        var source = script.call(this, {
          source: src,
          selection: selection,
          editor: editor,
        });
        if(source!==false){
          return runScript(source);
        }
      }
    }.bind(this);
  },
  loadFile: function(fileName){
    var editor = this.refs.editor.editor;
    Loader.get('/api/v1/file/'+fileName, function(err, source){
      this.setState({
        source: source
      });
    }.bind(this));
  },
  render: function(){
    var editor = <Ace
            ref="editor"
            mode="lua"
            theme="github"
            width="100%"
            value={this.state.source||sampleSource} />;
    var nav = Object.keys(SCRIPT_COMMANDS).map(function(title, index){
      return <NavItem eventKey={index} key={index} onClick={this.runScript(title)}>{title}</NavItem>;
    }.bind(this));

    return (
      <Grid>
        <Row>
          <Navbar>
            <Nav>
              {nav}
            </Nav>
          </Navbar>
        </Row>
        <Row>
          <Col sm={12} md={2}>
            <FileBrowser editor={editor} onLoadFile={this.loadFile} items={this.state.files} />
          </Col>
          <Col sm={12} md={10}>
            {editor}
          </Col>
        </Row>
        <Row>
          <TabbedArea>
            <TabPane eventKey={0} tab='Terminal'>
              <Console>ESP8266 Lua Terminal</Console>
            </TabPane>
          </TabbedArea>
        </Row>
      </Grid>
    );
  }
});

module.exports = Layout;
