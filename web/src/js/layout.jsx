var React = require('react');
var Loader = require('../lib/loader');
var Support = require('../lib/support');
var sockets = require('../lib/socket');
var bus = require('../lib/eventbus');

var noop = function(){};

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
var Modal = Bootstrap.Modal;
var ModalTrigger = Bootstrap.ModalTrigger;
var Input = Bootstrap.Input;
var Button = Bootstrap.Button;
var Glyphicon = Bootstrap.Glyphicon;

var Ace  = require('./ace.jsx');

var ConfirmDialog = React.createClass({
  doClose: function(accepted){
    this.props.onClose(accepted);
    this.props.onRequestHide();
  },
  doNo: function(){
    (this.props.onNo || noop)();
    this.doClose(false);
  },
  doNo: function(){
    (this.props.onYes || noop)();
    this.doClose(true);
  },
  render: function(){
    var message = this.props.message || 'Are you sure?';
    var yes = this.props.yes || 'Yes';
    var no = this.props.no || 'No';
    return (
      <Modal {...this.props} bsStyle='primary' title='Modal heading' animation={true}>
        <div className='modal-body'>
          <p>{message}</p>
        </div>
        <div className='modal-footer'>
          <Button onClick={this.doNo}>{no}</Button>
          <Button onClick={this.doYes}>{yes}</Button>
        </div>
      </Modal>
    );
  }
});

var FileNameDialog = React.createClass({
  saveClicked: function(){
    var fileName = this.refs.fileName.getValue();
    (this.props.onSave || noop)(fileName);
    if(this.props.event){
      bus.emit(this.props.event, {fileName: fileName});
    }
    this.props.onRequestHide();
  },
  render: function(){
    var namePrompt = this.props.namePrompt || 'File Name: ';
    var save = this.props.save || 'Save';
    var placeholder = this.props.placeholder || '';
    var fileName = this.props.fileName || '';
    return (
      <Modal {...this.props} bsStyle='primary' title='Modal heading' animation={true}>
        <div className='modal-body'>
          <Input
            type='text'
            defaultValue={fileName}
            placeholder={placeholder}
            label={namePrompt}
            hasFeedback
            ref='fileName' />
        </div>
        <div className='modal-footer'>
          <Button onClick={this.saveClicked}>{save}</Button>
        </div>
      </Modal>
    );
  }
});

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
  'Save As': {
    component: <ModalTrigger modal={<FileNameDialog event="execute::Save" />}>
                 <NavItem>Save As</NavItem>
               </ModalTrigger>
  },
  'Save': function(options){
    bus.emit('wait::start');
    var src = options.source.trim().split(/(\r\n|\n)/);
    var script = src.map(function(line){
      return 'file.write('+JSON.stringify(line)+');';
    }).join('\n');
    script = `file.open("${options.fileName}", "w");
      ${script}
      file.close();`;
    runScript(script, function(){
      this.loadFiles(function(){
        bus.emit('wait::end');
        this.loadFile(options.fileName);
      }.bind(this));
    }.bind(this));
    return false;
  },
  'Run Saved': 'dofile("{fileName}");',
  'Get IP': '=wifi.sta.getip();',
  'Heap Info': '=node.heap();',
  'Chip ID': '=node.chipid();',
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

var Spinner = React.createClass({
  render: function(){
    var spinner = this.props.active?<span><i className="glyphicon glyphicon-refresh"></i>Working...</span>:'';
    return (
      <span {...this.props}>{spinner}</span>
    );
  }
});

var Layout = React.createClass({
  getInitialState: function(){
    return {
      files: [],
      source: '',
      workingFile: '.__ide.lua',
      working: 0,
    };
  },
  loadFiles: function(callback){
    bus.emit('wait::start');
    var source = this.refs.editor.editor.getValue();
    Loader.get('/api/v1/files', function(err, listing){
      bus.emit('wait::end');
      if(listing){
        this.setState({
          source: source,
          files: listing
        });
      }
      return (callback||noop)();
    }.bind(this));
  },
  startWait: function(){
    this.setState({
      working: this.state.working+1
    });
  },
  endWait: function(){
    this.setState({
      working: this.state.working>0?this.state.working-1:0
    });
  },
  componentDidMount: function(){
    bus.on('wait::start', this.startWait);
    bus.on('wait::end', this.endWait);
    Object.keys(SCRIPT_COMMANDS).forEach(function(command){
      var handler = this.getRunScript(command);
      bus.on('execute::'+command, function(args){
        console.log('execute::'+command, args);
        handler(args);
      });
    }.bind(this));
    this.loadFiles(function(){
      this.loadFile('.__ide.lua');
    }.bind(this));
  },
  getRunScript: function(scriptName){
    var script = SCRIPT_COMMANDS[scriptName]||scriptName;
    var type = typeof(script);
    switch(type){
      case('function'):
        var handler = script.bind(this);
        break;
      case('object'):
        if(script.handler){
          var handler = script.handler.bind(this);
          break;
        }
        var handler = noop;
        break;
      case('string'):
        var handler = function(opts){
          runScript(script.replace(/\{([a-z0-9]+)\}/ig, function(full, token){
            return opts[token];
          }));
        }.bind(this);
        break;
      default:
        var handler = noop;
    }

    return function(params){
      var editor = this.refs.editor.editor;
      var src = editor.getValue();
      var selection = editor.getSelectedText()||src;
      var opts = Support.defaults(params||{}, {
        source: src,
        selection: selection,
        editor: editor,
        fileName: this.state.workingFile,
      });
      handler(opts);
    }.bind(this);
  },
  loadFile: function(fileName){
    bus.emit('wait::start');
    var editor = this.refs.editor.editor;
    Loader.get('/api/v1/file/'+fileName, function(err, source){
      this.setState({
        workingFile: fileName,
        source: source
      });
      bus.emit('wait::end');
    }.bind(this));
  },
  render: function(){
    var editor = <Ace
            ref="editor"
            mode="lua"
            theme="github"
            width="100%"
            value={this.state.source} />;
    var nav = Object.keys(SCRIPT_COMMANDS).map(function(title, index){
      var value = SCRIPT_COMMANDS[title];
      if(value.component){
        return value.component;
      }
      return <NavItem eventKey={index} key={index} onClick={this.getRunScript(title)}>{title}</NavItem>;
    }.bind(this));

    return (
      <div>
        <Spinner active={this.state.working} className="working" />
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
      </div>
    );
  }
});

module.exports = Layout;
