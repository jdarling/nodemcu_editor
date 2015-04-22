var React = require('react');
var Loader = require('../lib/loader');
var Support = require('../lib/support');
var sockets = require('../lib/socket');

var Select = require('react-select');

var fileList = {
  'foo1': 'foo1.js',
  'foo2': 'foo2.js',
  'bar': {
    'bars child 1': 'bar/bars_child.js',
    'bars child 2': 'bar/bars_child.js'
  }
};

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
      return Loader.post('/api/v1/serial/put', {data: command}, function(){
        return this.setState({
            inputText: ''
          });
      }.bind(this));
    }
  },
  render: function(){
    var inputText = this.state.inputText;
    var lines = this.state.buffer.split('\n').map(function(line, index){
      return <p key={index}>{line}</p>;
    });
    return (
      <div className="console">
        <div className="output">{{lines}}</div>
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
        console.log('editor: ', this.props.editor);
        console.log('editor.value: ', this.props.editor.value);
        console.log('editor.props.value: ', this.props.editor.props.value);
        console.log(value);
        //this.props.editor.props.value = value;
        this.props.editor.setProps({
            value: value
          });
        break;
      default:
        return;
    }
    e.stopPropagation();
  },
  render: function(){
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

/*
file.open(".__ide.lua", "r")
print(file.read())
file.close()
dofile(".__ide.lua")
print(wifi.sta.getip())
*/
var noop = function(){};
var runScript = function(script, callback){
  return Loader.post('/api/v1/serial/put', {data: script}, callback||noop);
};

var Layout = React.createClass({
  runScript: function(){
    var script = JSON.stringify(this.refs.editor.editor.getValue());
    script = `file.open(".__ide.lua", "w");
file.write(${script});
file.close();

file.open(".__ide.lua", "r");
=file.read();
file.close();

dofile(".__ide.lua");`;
    runScript(script);
  },
  dumpCode: function(){
    var script = `file.open(".__ide.lua", "r");
=file.read();
file.close();`;
    runScript(script);
  },
  resetNode: function(){
    runScript('node.restart();');
  },
  getIp: function(){
    runScript('=wifi.sta.getip();');
  },
  scanForAP: function(){
    runScript(`wifi.setmode(wifi.STATION);
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
end)`);
  },
  render: function(){
    var sampleSource = `-- a simple http server
srv=net.createServer(net.TCP)
srv:listen(80,function(conn)
    conn:on("receive",function(conn,payload)
    print(payload)
    conn:send("<h1> Hello, NodeMCU.</h1>")
    end)
end)`;
    var editor = <Ace
            ref="editor"
            mode="lua"
            theme="github"
            width="100%"
            value={sampleSource} />;
    return (
      <Grid>
        <Row>
          <Navbar>
            <Nav>
              <NavItem eventKey={0} onClick={this.runScript}>Run</NavItem>
              <NavItem eventKey={1} onClick={this.resetNode}>Reset</NavItem>
              <NavItem eventKey={2} onClick={this.dumpCode}>Dump Code</NavItem>
              <NavItem eventKey={3} onClick={this.getIp}>Get IP</NavItem>
              <NavItem eventKey={3} onClick={this.scanForAP}>Scan for AP's</NavItem>
            </Nav>
          </Navbar>
        </Row>
        <Row>
          <Col sm={12} md={2}>
            <FileBrowser editor={editor} />
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
