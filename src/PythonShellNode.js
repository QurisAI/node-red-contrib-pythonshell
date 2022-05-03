var fs = require("fs");
var events = require("events");
const { once } = require("events");

function PythonshellInNode(config) {
  if (!config.pyfile){
    throw 'pyfile not present';
  }
  this.pythonExec = config.python3 ? "python3" : "python";
  this.pyfile = config.pyfile;
  this.virtualenv = config.virtualenv;

  if (!fs.existsSync(this.pyfile)) {
    throw `pyfile ${this.pyfile} not exist`;
  }

  if (this.virtualenv && !fs.existsSync(this.virtualenv)){
    throw 'configured virtualenv not exist, consider remove or change';
  }

  this.continuous = config.continuous;
  this.pydir = this.pyfile.substring(0, this.pyfile.lastIndexOf('/'));
  this.pyfile = this.pyfile.substring(this.pyfile.lastIndexOf('/') + 1, this.pyfile.length);
  this.args = config.args
  this.spawn = require('child_process').spawn;
  this.onStatus = ()=>{}
  this.eventEmitter = new events.EventEmitter();
}

PythonshellInNode.prototype.onInput = async function(msg, out, err) {
  // Every new data results in stopping and possibly restarting the script execution
  if (this.py != null)
  {
    this.onClose()
    await once(this.eventEmitter, 'py-closed');

    // If Received this kind of message, and script was running, don't restart
    if ((msg.payload == 'pythonshell@StartOrStop') || (msg.payload == 'pythonshell@Stop')) {
      return
    }
  }

  if (msg.payload == 'pythonshell@Stop')
  {
    return
  }

  var spawnCmd = (this.virtualenv ? this.virtualenv + '/bin/' : '') + this.pythonExec

  // If arguments is set in the config always use it, otherwise try to use args from msg
  let args = this.args || msg.args || ''
  args = args.split(' ').filter(i=>i)

  console.log(`Running PythonShell ${spawnCmd} -u ${this.pyfile} with ${args}`);
  this.py = this.spawn(spawnCmd, ['-u', this.pyfile, ...args], {
    cwd: this.pydir
    // detached: true
  });

  this.onStatus({fill:"green",shape:"dot",text:"Standby"})

  var py = this.py;
  var dataString = '';
  var errString = '';

  py.stdout.on('data', data => {
    clearTimeout(this.standbyTimer)

    this.onStatus({fill:"green",shape:"dot",text:"Processing data"})

    let dataStr = data.toString();

    dataString += dataStr;

    if (dataString.endsWith("\n")){
      if (this.continuous){
        for (let line of dataString.split("\n").filter(i=>i)) {
          out({payload: line});
        }
        dataString = ''
      }
    }

    this.standbyTimer = setTimeout(()=>{
      this.onStatus({fill:"green",shape:"dot",text:"Standby"})
    }, 2000)

  });

  py.stderr.on('data', data => {
    let dataStr = String(data)
    if (!errString.includes(dataStr))
    {
      errString += String(data);
      this.onStatus({fill:"red",shape:"dot",text:"Error: " + errString})
    }
  });

  py.stderr.on('error', console.log)
  py.stdout.on('error', console.log)
  py.stdin.on('error', console.log)
  py.on('error', console.log)

  py.on('close', code =>{
    if (code){
      err('exit code: ' + code + ', ' + errString);
      this.onStatus({fill:"red",shape:"dot",text:"Exited: " + code})
    } else if (!this.continuous){
      out({payload: dataString.trim()});
      this.onStatus({fill:"green",shape:"dot",text:"Done"})
    } else {
      this.onStatus({fill:"yellow",shape:"dot",text:"Script Closed"})
    }
    this.py = null
    setTimeout(()=>{
      this.onStatus({})
    }, 2000)
    this.eventEmitter.emit('py-closed')
  });
};



PythonshellInNode.prototype.onClose = function() {
  if (this.py){
    this.py.kill()
    this.py = null
  }
};

PythonshellInNode.prototype.setStatusCallback = function(callback) {
  this.onStatus = callback
};


module.exports = PythonshellInNode
