/**
 * Copyright 2014 Sense Tecnic Systems, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

var util = require("util");
var httpclient;
var PythonshellNode = require('./PythonShellNode');

module.exports = function(RED) {
  "use strict";

  function PythonshellInNode(n) {
    RED.nodes.createNode(this,n);

    var node = this;
    node.config = n; // copy config to the backend so that down bellow we can have a reference

    var pyNode = new PythonshellNode(RED, n);

    pyNode.setStatusCallback(node.status.bind(node))

    node.on("input",function(msg) {
      pyNode.onInput(msg, function(result){
        node.send(result);
      }, function(err){
        node.error(err, msg);
      });
    });

    node.on('close', ()=>pyNode.onClose());
  }

  RED.nodes.registerType("pythonshell in", PythonshellInNode);

  RED.httpAdmin.post("/pythonshell/:id", RED.auth.needsPermission("pythonshell.query"), function(req,res) {
    var node = RED.nodes.getNode(req.params.id);
    if (node != null) {
      try {
        node.receive({payload: 'pythonshell@StartOrStop'})
        res.sendStatus(200);
      } catch(err) {
          res.sendStatus(500);
          node.error(RED._("pythonshell.failed",{error:err.toString()}));
      }
    } else {
        res.sendStatus(404);
    }
  });

}
